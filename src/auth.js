import { supabase } from './lib/supabaseClient';
import { createIcons, icons } from 'lucide';

export function renderAuth(container) {
  container.innerHTML = `
    <div class="auth-container">
      <header class="auth-header">
        <h1>Welcome Back</h1>
        <p>Sign in with your username to continue</p>
      </header>

      <!-- Login Form -->
      <form class="auth-form" id="login-form">
        <div class="form-group">
          <label for="login-username">Username</label>
          <input type="text" id="login-username" class="input-field" required autocomplete="username">
        </div>
        <div class="form-group">
          <label for="login-password">Password</label>
          <input type="password" id="login-password" class="input-field" required autocomplete="current-password">
        </div>
        <button type="submit" class="btn btn-primary" id="login-btn">
          <span>Sign In</span>
        </button>
        <p class="error-message" id="login-error"></p>
      </form>

      <!-- Sign Up Form (hidden by default) -->
      <form class="auth-form hidden" id="signup-form">
        <div class="form-group">
          <label for="signup-fullname">Full Name</label>
          <input type="text" id="signup-fullname" class="input-field" required autocomplete="name">
        </div>
        <div class="form-group">
          <label for="signup-username">Username</label>
          <input type="text" id="signup-username" class="input-field" required autocomplete="username">
        </div>
        <div class="form-group">
          <label for="signup-password">Password</label>
          <input type="password" id="signup-password" class="input-field" required minlength="6" autocomplete="new-password">
        </div>
        <button type="submit" class="btn btn-primary" id="signup-btn">
          <span>Create Account</span>
        </button>
        <p class="error-message" id="signup-error"></p>
      </form>

      <div class="auth-toggle">
        <p>
          <span id="toggle-text">Don't have an account?</span>
          <button id="toggle-auth-btn">Sign Up</button>
        </p>
      </div>
    </div>
  `;

  createIcons({ icons });

  // --- DOM Elements ---
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const loginBtn = document.getElementById('login-btn');
  const signupBtn = document.getElementById('signup-btn');
  const loginError = document.getElementById('login-error');
  const signupError = document.getElementById('signup-error');
  
  const authHeader = document.querySelector('.auth-header h1');
  const authSubHeader = document.querySelector('.auth-header p');
  const toggleText = document.getElementById('toggle-text');
  const toggleAuthBtn = document.getElementById('toggle-auth-btn');

  let isLoginView = true;

  // --- Event Listeners ---
  toggleAuthBtn.addEventListener('click', () => {
    isLoginView = !isLoginView;
    loginForm.classList.toggle('hidden');
    signupForm.classList.toggle('hidden');
    
    if (isLoginView) {
      authHeader.textContent = 'Welcome Back';
      authSubHeader.textContent = 'Sign in with your username to continue';
      toggleText.textContent = "Don't have an account?";
      toggleAuthBtn.textContent = 'Sign Up';
      loginError.textContent = '';
      signupError.textContent = '';
    } else {
      authHeader.textContent = 'Create an Account';
      authSubHeader.textContent = 'Get started with a new account';
      toggleText.textContent = 'Already have an account?';
      toggleAuthBtn.textContent = 'Sign In';
      loginError.textContent = '';
      signupError.textContent = '';
    }
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    // Generate the fake email from username to sign in
    const email = `${username.trim().toLowerCase()}@example.com`;

    await handleAuth(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }, loginBtn, loginError, 'Sign In');
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('signup-fullname').value;
    const username = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;

    if (username.includes('@')) {
      signupError.textContent = 'Username cannot contain the "@" symbol.';
      return;
    }

    // Generate a fake email to satisfy Supabase auth requirements
    const email = `${username.trim().toLowerCase()}@example.com`;

    await handleAuth(async () => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            username: username,
          },
        },
      });
      if (error) {
        if (error.message.includes('duplicate key value violates unique constraint "profiles_username_key"')) {
          throw new Error('This username is already taken.');
        }
        throw error;
      }
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        throw new Error('User with this username already exists.');
      }
    }, signupBtn, signupError, 'Create Account');
  });

  // --- Helper Function ---
  async function handleAuth(authFn, button, errorEl, buttonText) {
    button.disabled = true;
    button.innerHTML = `<span class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></span>`;
    errorEl.textContent = '';

    try {
      await authFn();
    } catch (error) {
      errorEl.textContent = error.message || 'An unexpected error occurred.';
    } finally {
      button.disabled = false;
      button.innerHTML = `<span>${buttonText}</span>`;
    }
  }
}
