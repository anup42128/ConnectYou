import { supabase } from './lib/supabaseClient';
import { createIcons, icons } from 'lucide';

// --- STATE MANAGEMENT ---
let currentUserProfile = null;
let allUsers = [];
let selectedUserId = null;
let messageSubscription = null;

export async function renderChat(container, user) {
  // 1. Fetch current user's profile
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    console.error('Error fetching user profile:', error);
    container.innerHTML = `<div class="error-message">Could not load your profile. Please try again.</div>`;
    return;
  }
  currentUserProfile = profile;

  // 2. Render the main layout
  container.innerHTML = getChatLayoutHTML();
  createIcons({ icons }); // Initialize icons

  // 3. Get DOM elements
  const userListEl = document.getElementById('user-list');
  const chatWindowEl = document.getElementById('chat-window-content');
  const searchInput = document.getElementById('user-search-input');
  const logoutButton = document.getElementById('logout-btn');
  const sidebarEl = document.querySelector('.sidebar');

  // Load all users into memory, but render an empty list initially
  await loadAndRenderUsers(userListEl);

  // 4. Setup Event Listeners
  searchInput.addEventListener('input', (e) => handleSearch(e.target.value, userListEl));
  logoutButton.addEventListener('click', handleLogout);
  
  userListEl.addEventListener('click', async (e) => {
    const userCard = e.target.closest('.user-card');
    if (userCard && userCard.dataset.userId) {
      const newSelectedUserId = userCard.dataset.userId;
      if (newSelectedUserId === selectedUserId) return; // Avoid re-loading same chat

      selectedUserId = newSelectedUserId;
      
      // Update UI for active chat
      document.querySelectorAll('.user-card').forEach(card => card.classList.remove('active'));
      userCard.classList.add('active');

      await loadChatForUser(selectedUserId, chatWindowEl);
      
      // For mobile: hide sidebar, show chat
      sidebarEl.classList.remove('open');
    }
  });
}

// --- HTML TEMPLATES ---

function getChatLayoutHTML() {
  return `
    <div class="chat-layout">
      <!-- Sidebar -->
      <aside class="sidebar open">
        <header class="sidebar-header">
          <h2>Chats</h2>
          <button class="logout-button" id="logout-btn" title="Logout">
            <i data-lucide="log-out" class="icon"></i>
          </button>
        </header>
        <div class="search-container">
          <div class="search-wrapper">
            <i data-lucide="search" class="icon"></i>
            <input type="text" id="user-search-input" placeholder="Search for users...">
          </div>
        </div>
        <div class="user-list" id="user-list">
          <!-- Initially empty, populated by search -->
        </div>
      </aside>

      <!-- Chat Window -->
      <main class="chat-window" id="chat-window-content">
        ${getChatPlaceholderHTML()}
      </main>
    </div>
  `;
}

function getUserCardHTML(user) {
  const initial = user.full_name ? user.full_name.charAt(0).toUpperCase() : '?';
  return `
    <div class="user-card" data-user-id="${user.id}">
      <div class="avatar">${initial}</div>
      <div class="user-info">
        <div class="name">${user.full_name}</div>
        <div class="username">@${user.username}</div>
      </div>
    </div>
  `;
}

function getChatPlaceholderHTML() {
  return `
    <div class="chat-placeholder">
      <i data-lucide="message-circle" class="icon"></i>
      <h3>Select a chat</h3>
      <p>Search for a user and start a conversation.</p>
    </div>
  `;
}

function getChatWindowHTML(partner) {
  const initial = partner.full_name ? partner.full_name.charAt(0).toUpperCase() : '?';
  return `
    <header class="chat-header">
      <button class="back-button hidden" id="back-to-sidebar-btn">
        <i data-lucide="arrow-left" class="icon"></i>
      </button>
      <div class="avatar">${initial}</div>
      <div class="chat-header-info">
        <div class="name">${partner.full_name}</div>
        <div class="username">@${partner.username}</div>
      </div>
    </header>
    <div class="messages-container" id="messages-container">
      <div class="loading-scaffold"><div class="spinner"></div></div>
    </div>
    <div class="message-form-container">
      <form id="message-form">
        <input id="message-input" placeholder="Type a message..." autocomplete="off"></input>
        <button type="submit" class="btn btn-primary" id="send-btn">
          <i data-lucide="send" class="icon"></i>
        </button>      
      </form>
    </div>
  `;
}

// --- DATA FETCHING & RENDERING ---

async function loadAndRenderUsers(userListEl) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .neq('id', currentUserProfile.id); // Exclude current user

  if (error) {
    console.error('Error fetching users:', error);
    userListEl.innerHTML = `<p class="error-message">Could not load users.</p>`;
    return;
  }
  allUsers = data;
  // Initially render an empty list with a prompt
  renderUserList([], userListEl);
}

function renderUserList(users, userListEl) {
  if (users.length === 0 && document.getElementById('user-search-input').value === '') {
    userListEl.innerHTML = `<p class="text-secondary" style="text-align: center; padding: 1rem;">Search for users to begin.</p>`;
    return;
  }
  if (users.length === 0) {
    userListEl.innerHTML = `<p class="text-secondary" style="text-align: center; padding: 1rem;">No users found.</p>`;
    return;
  }
  userListEl.innerHTML = users.map(getUserCardHTML).join('');
}

async function loadChatForUser(partnerId, chatWindowEl) {
  const partner = allUsers.find(u => u.id === partnerId);
  if (!partner) return;

  chatWindowEl.innerHTML = getChatWindowHTML(partner);
  createIcons({ icons });

  // Attach listener for the newly created back button
  const backButton = document.getElementById('back-to-sidebar-btn');
  const sidebarEl = document.querySelector('.sidebar');
  backButton?.addEventListener('click', () => {
    sidebarEl.classList.add('open');
    selectedUserId = null; // Deselect chat on mobile back
    document.querySelectorAll('.user-card').forEach(card => card.classList.remove('active'));
    chatWindowEl.innerHTML = getChatPlaceholderHTML();
    createIcons({ icons });
  });

  const messagesContainer = document.getElementById('messages-container');
  const messageForm = document.getElementById('message-form');
  const sendBtn = document.getElementById('send-btn');

  // Fetch initial messages with corrected query
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${currentUserProfile.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUserProfile.id})`)
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Error loading messages:", error);
    messagesContainer.innerHTML = `<p class="error-message">Could not load messages.</p>`;
  } else {
    renderMessages(messages, messagesContainer);
  }

  // Setup message sending
  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSendMessage(partnerId, sendBtn);
  });

  // Setup real-time subscription
  setupMessageSubscription(partnerId, messagesContainer);
}

function renderMessages(messages, container) {
  if (messages.length === 0) {
    container.innerHTML = `<p class="text-secondary" style="text-align: center; padding: 1rem;">No messages yet. Say hello!</p>`;
    return;
  }
  container.innerHTML = messages.map(message => getMessageBubbleHTML(message, currentUserProfile.id)).join('');
  scrollToBottom(container);
}

function appendMessage(message, container) {
  // Clear "No messages" or "loading" placeholder if it exists
  const placeholder = container.querySelector('.text-secondary, .loading-scaffold');
  if (placeholder) {
    container.innerHTML = '';
  }
  container.insertAdjacentHTML('beforeend', getMessageBubbleHTML(message, currentUserProfile.id));
  scrollToBottom(container);
}

function getMessageBubbleHTML(message, currentUserId) {
  const isSent = message.sender_id === currentUserId;
  const bubbleClass = isSent ? 'sent' : 'received';
  return `<div class="message-bubble ${bubbleClass}">${message.content}</div>`;
}

// --- EVENT HANDLERS & HELPERS ---

function handleSearch(query, userListEl) {
  const lowerCaseQuery = query.toLowerCase().trim();
  if (!lowerCaseQuery) {
    renderUserList([], userListEl); // Show prompt if search is empty
    return;
  }
  const filteredUsers = allUsers.filter(user =>
    user.full_name.toLowerCase().includes(lowerCaseQuery) ||
    user.username.toLowerCase().includes(lowerCaseQuery)
  );
  renderUserList(filteredUsers, userListEl);
}

async function handleLogout() {
  await supabase.auth.signOut();
  // onAuthStateChange in main.js will handle the UI update
  if (messageSubscription) {
    supabase.removeChannel(messageSubscription);
    messageSubscription = null;
  }
}

async function handleSendMessage(receiverId, button) {
  const messageInput = document.getElementById('message-input');
  const content = messageInput.value.trim();
  if (!content) return;

  button.disabled = true;
  messageInput.disabled = true;

  const { error } = await supabase.from('messages').insert({
    sender_id: currentUserProfile.id,
    receiver_id: receiverId,
    content: content,
  });

  if (error) {
    console.error('Error sending message:', error);
    // Optionally show an error to the user
  } else {
    // Manually append message for instant UI feedback for the sender
    const newMessage = {
      sender_id: currentUserProfile.id,
      content: content
    };
    appendMessage(newMessage, document.getElementById('messages-container'));
    messageInput.value = ''; // Clear input on success
  }
  
  button.disabled = false;
  messageInput.disabled = false;
  messageInput.focus();
}

function setupMessageSubscription(partnerId, container) {
  // Unsubscribe from any previous channel
  if (messageSubscription) {
    supabase.removeChannel(messageSubscription);
  }

  messageSubscription = supabase.channel(`public:messages:chat_with_${partnerId}_${currentUserProfile.id}`)
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'messages'
    }, payload => {
      const newMessage = payload.new;
      // Only append if the message is FROM the partner we are chatting with
      if (newMessage.sender_id === partnerId && newMessage.receiver_id === currentUserProfile.id) {
        appendMessage(newMessage, container);
      }
    })
    .subscribe();
}

function scrollToBottom(element) {
  element.scrollTop = element.scrollHeight;
}
