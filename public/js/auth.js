// ===== AUTHENTICATION MODULE =====
const Auth = {
  // Default credentials (username: bryansumait, password: bryansumait03)
  // Password is SHA-256 hashed for basic security
  CREDENTIALS: {
    username: 'bryansumait',
    passwordHash: '264bc2006a1a5388e5b8f78bb8a3ac1ab624889c2006cd4570354a04186864ed' // "bryansumait03"
  },

  init() {
    // Check if user is already logged in
    if (!this.isLoggedIn()) {
      this.showLoginScreen();
    } else {
      this.showApp();
    }
  },

  isLoggedIn() {
    const session = localStorage.getItem('bf_session');
    if (!session) return false;

    try {
      const sessionData = JSON.parse(session);
      const now = Date.now();

      // Session expires after 24 hours
      if (sessionData.expires && sessionData.expires > now) {
        return sessionData.username === this.CREDENTIALS.username;
      }
    } catch (e) {
      console.error('[Auth] Invalid session data');
    }

    // Invalid or expired session
    this.logout();
    return false;
  },

  async login(username, password) {
    // Hash the password
    const passwordHash = await this._hashPassword(password);

    // Verify credentials
    if (username === this.CREDENTIALS.username && passwordHash === this.CREDENTIALS.passwordHash) {
      // Create session (expires in 24 hours)
      const session = {
        username,
        loginTime: Date.now(),
        expires: Date.now() + (24 * 60 * 60 * 1000)
      };

      localStorage.setItem('bf_session', JSON.stringify(session));
      this.showApp();
      return true;
    }

    return false;
  },

  logout() {
    localStorage.removeItem('bf_session');
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
          <p class="login-hint">💡 Login: <code>bryansumait</code> / <code>bryansumait03</code></p>
          <p class="login-version">v2.0 • Enhanced Edition</p>
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
    const success = await this.login(username, password);

    if (success) {
      // Login successful
      console.log('[Auth] Login successful');
    } else {
      // Login failed
      errorDiv.textContent = '❌ Invalid username or password';
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
  },

  // Utility to generate password hash (for creating new users)
  async generatePasswordHash(password) {
    const hash = await this._hashPassword(password);
    console.log(`Password: ${password}`);
    console.log(`Hash: ${hash}`);
    return hash;
  }
};
