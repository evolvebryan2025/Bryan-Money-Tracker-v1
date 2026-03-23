// ===== AUTHENTICATION MODULE (Email-Only) =====
const Auth = {
  SESSION_KEY: 'bf_session',

  init() {
    if (!this.isLoggedIn()) {
      this.showLoginScreen();
    } else {
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

      if (sessionData.expires && sessionData.expires > now && sessionData.token) {
        return true;
      }
    } catch (e) {
      console.error('[Auth] Invalid session data');
    }

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

  async login(email) {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[Auth] Login failed:', data.error);
        return { success: false, error: data.error || 'Login failed' };
      }

      const session = {
        token: data.token,
        email: data.email,
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
    const app = document.getElementById('app-container');
    const sidebar = document.getElementById('sidebar');
    if (app) app.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';

    let loginScreen = document.getElementById('login-screen');
    if (!loginScreen) {
      loginScreen = this._createLoginScreen();
      document.body.appendChild(loginScreen);
    }
    loginScreen.style.display = 'flex';
  },

  showApp() {
    const app = document.getElementById('app-container');
    const sidebar = document.getElementById('sidebar');
    if (app) app.style.display = 'block';
    if (sidebar) sidebar.style.display = 'flex';

    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
      loginScreen.style.display = 'none';
      loginScreen.remove();
    }

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
            <label for="login-email">Email</label>
            <input
              type="email"
              id="login-email"
              class="form-input"
              placeholder="Enter your email"
              autocomplete="email"
              required
            >
          </div>

          <button type="submit" class="btn btn-primary btn-block">
            Continue
          </button>
        </form>

        <div class="login-footer">
          <p class="login-version">v2.2 &middot; SUMAIT Finance</p>
        </div>
      </div>
    `;
    return screen;
  },

  async handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const errorDiv = document.getElementById('login-error');

    errorDiv.style.display = 'none';

    const result = await this.login(email);

    if (result.success) {
      console.log('[Auth] Login successful');
    } else {
      errorDiv.textContent = result.error || 'Unauthorized email address';
      errorDiv.style.display = 'block';

      const form = document.querySelector('.login-form');
      form.classList.add('shake');
      setTimeout(() => form.classList.remove('shake'), 500);
    }
  }
};
