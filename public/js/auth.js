// ===== AUTHENTICATION MODULE =====
const Auth = {
  SESSION_KEY: 'bf_session',

  init() {
    // Check if user is already logged in
    if (!this.isLoggedIn()) {
      this.showLoginScreen();
    } else {
      // Validate session with server before showing app
      this._validateSession().then(valid => {
        if (valid) {
          this.showApp();
        } else {
          this.logout();
        }
      });
    }
  },

  isLoggedIn() {
    const session = localStorage.getItem(this.SESSION_KEY);
    if (!session) return false;

    try {
      const sessionData = JSON.parse(session);
      const now = Date.now();

      // Check client-side expiry first (quick check before server round-trip)
      if (sessionData.expires && sessionData.expires > now && sessionData.token) {
        return true;
      }
    } catch (e) {
      console.error('[Auth] Invalid session data');
    }

    // Invalid or expired session
    localStorage.removeItem(this.SESSION_KEY);
    return false;
  },

  getSessionToken() {
    try {
      const session = JSON.parse(localStorage.getItem(this.SESSION_KEY) || '{}');
      return session.token || null;
    } catch (e) {
      return null;
    }
  },

  async _validateSession() {
    const token = this.getSessionToken();
    if (!token) return false;

    try {
      const response = await fetch('/api/validate-session', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) return false;

      const data = await response.json();
      return data.valid === true;
    } catch (e) {
      console.error('[Auth] Session validation failed:', e.message);
      return false;
    }
  },

  async login(username, password) {
    // Hash the password client-side so raw password never leaves the browser
    const passwordHash = await this._hashPassword(password);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, passwordHash })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[Auth] Login failed:', data.error);
        return { success: false, error: data.error || 'Login failed' };
      }

      // Store session with server-issued token
      const session = {
        token: data.token,
        username: data.username,
        loginTime: Date.now(),
        expires: data.expires
      };

      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      this.showApp();
      return { success: true };
    } catch (e) {
      console.error('[Auth] Login request failed:', e.message);
      return { success: false, error: 'Network error. Please try again.' };
    }
  },

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
    this.showLoginScreen();
  },

  showLoginScreen() {
    // Hide main app
    const app = document.getElementById('app-container');
    const sidebar = document.getElementById('sidebar');
    if (app) app.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';

    // Show login screen
    let loginScreen = document.getElementById('login-screen');
    if (!loginScreen) {
      loginScreen = this._createLoginScreen();
      document.body.appendChild(loginScreen);
    }
    loginScreen.style.display = 'flex';
  },

  showApp() {
    // Show main app
    const app = document.getElementById('app-container');
    const sidebar = document.getElementById('sidebar');
    if (app) app.style.display = 'block';
    if (sidebar) sidebar.style.display = 'flex';

    // Hide and remove login screen
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
      loginScreen.style.display = 'none';
      loginScreen.remove();
    }

    // Initialize app if not already done
    if (!window.appInitialized) {
      App.init();
      window.appInitialized = true;
    }
  },

  _createLoginScreen() {
    const screen = document.createElement('div');
    screen.id = 'login-screen';
    screen.className = 'login-screen';
    screen.innerHTML = `
      <div class="login-container">
        <div class="login-header">
          <div class="login-logo">
            <svg width="80" height="80" viewBox="0 0 100 100">
              <rect width="100" height="100" rx="20" fill="#0a0a0a"/>
              <circle cx="50" cy="25" r="10" fill="#ef4444"/>
              <circle cx="25" cy="50" r="10" fill="#ef4444"/>
              <circle cx="75" cy="50" r="10" fill="#ef4444"/>
              <circle cx="50" cy="75" r="10" fill="#ef4444"/>
            </svg>
          </div>
          <h1>SUMAIT Finance</h1>
          <p class="login-subtitle">Personal Finance Tracker</p>
        </div>

        <form class="login-form" onsubmit="Auth.handleLogin(event)">
          <div class="login-error" id="login-error" style="display: none;"></div>

          <div class="form-group">
            <label for="login-username">Username</label>
            <input
              type="text"
              id="login-username"
              class="form-input"
              placeholder="Enter username"
              autocomplete="username"
              required
            >
          </div>

          <div class="form-group">
            <label for="login-password">Password</label>
            <input
              type="password"
              id="login-password"
              class="form-input"
              placeholder="Enter password"
              autocomplete="current-password"
              required
            >
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" id="login-remember">
              <span>Remember me (24 hours)</span>
            </label>
          </div>

          <button type="submit" class="btn btn-primary btn-block">
            Login
          </button>
        </form>

        <div class="login-footer">
          <p class="login-version">v2.1 • Secure Edition</p>
        </div>
      </div>
    `;
    return screen;
  },

  async handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');

    // Clear previous error
    errorDiv.style.display = 'none';

    // Attempt login
    const result = await this.login(username, password);

    if (result.success) {
      // Login successful
      console.log('[Auth] Login successful');
    } else {
      // Login failed
      errorDiv.textContent = result.error || 'Invalid username or password';
      errorDiv.style.display = 'block';

      // Shake animation
      const form = document.querySelector('.login-form');
      form.classList.add('shake');
      setTimeout(() => form.classList.remove('shake'), 500);

      // Clear password field
      document.getElementById('login-password').value = '';
    }
  },

  async _hashPassword(password) {
    // SHA-256 hash
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }
};
