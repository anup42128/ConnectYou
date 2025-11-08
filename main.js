import './style.css';
import { supabase } from './src/lib/supabaseClient';
import { renderAuth } from './src/auth';
import { renderChat } from './src/chat';
import { createIcons, icons } from 'lucide';

const app = document.getElementById('app');

// Initial loading state
app.innerHTML = `
  <div class="loading-scaffold">
    <div class="spinner"></div>
  </div>
`;

supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    // User is logged in
    renderChat(app, session.user);
  } else {
    // User is not logged in
    renderAuth(app);
  }
  // After rendering, create all Lucide icons
  createIcons({ icons });
});
