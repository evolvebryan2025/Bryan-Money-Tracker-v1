// ===== PWA INSTALLER & OFFLINE HANDLER =====
const PWA = {
  deferredPrompt: null,
  isOnline: navigator.onLine,

  init() {
    // Register service worker
    this._registerServiceWorker();

    // Listen for install prompt
    this._setupInstallPrompt();

    // Listen for online/offline changes
    this._setupOfflineDetection();

    // Update UI based on connection status
    this._updateConnectionStatus();
  },

  _registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('[PWA] Service worker registered:', registration.scope);

          // Check for updates periodically (every hour)
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000);

          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                this._showUpdateAvailable();
              }
            });
          });
        })
        .catch(err => {
          console.error('[PWA] Service worker registration failed:', err);
        });
    }
  },

  _setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', e => {
      // Prevent automatic prompt
      e.preventDefault();

      // Store for later use
      this.deferredPrompt = e;

      // Show custom install banner
      this._showInstallBanner();
    });

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      this.deferredPrompt = null;
      this._hideInstallBanner();
    });
  },

  _setupOfflineDetection() {
    window.addEventListener('online', () => {
      console.log('[PWA] Back online');
      this.isOnline = true;
      this._updateConnectionStatus();
    });

    window.addEventListener('offline', () => {
      console.log('[PWA] Went offline');
      this.isOnline = false;
      this._updateConnectionStatus();
    });
  },

  _updateConnectionStatus() {
    const indicator = document.getElementById('offline-indicator');
    if (!indicator) {
      // Create indicator if it doesn't exist
      const div = document.createElement('div');
      div.id = 'offline-indicator';
      div.className = 'offline-indicator';
      div.innerHTML = '<span class="offline-icon">⚠️</span> Offline Mode';
      document.body.appendChild(div);
    }

    const offlineIndicator = document.getElementById('offline-indicator');
    if (this.isOnline) {
      offlineIndicator.style.display = 'none';
    } else {
      offlineIndicator.style.display = 'flex';
    }
  },

  _showInstallBanner() {
    // Check if already installed or banner dismissed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return; // Already installed
    }

    if (localStorage.getItem('bf_install_dismissed')) {
      return; // User dismissed banner
    }

    const banner = document.getElementById('install-banner');
    if (!banner) {
      // Create banner
      const div = document.createElement('div');
      div.id = 'install-banner';
      div.className = 'install-banner';
      div.innerHTML = `
        <div class="install-banner-content">
          <span class="install-icon">📱</span>
          <div class="install-text">
            <strong>Install Bryan Finance</strong>
            <p>Add to home screen for offline access</p>
          </div>
          <button type="button" class="btn btn-sm btn-cyan" onclick="PWA.install()">Install</button>
          <button type="button" class="btn-icon" onclick="PWA.dismissInstallBanner()" aria-label="Dismiss install banner">✕</button>
        </div>
      `;
      document.body.appendChild(div);
    }

    setTimeout(() => {
      const installBanner = document.getElementById('install-banner');
      if (installBanner) {
        installBanner.style.display = 'flex';
      }
    }, 100);
  },

  _hideInstallBanner() {
    const banner = document.getElementById('install-banner');
    if (banner) {
      banner.style.display = 'none';
    }
  },

  dismissInstallBanner() {
    this._hideInstallBanner();
    localStorage.setItem('bf_install_dismissed', 'true');
  },

  install() {
    if (!this.deferredPrompt) {
      console.log('[PWA] No install prompt available');
      return;
    }

    // Show the install prompt
    this.deferredPrompt.prompt();

    // Wait for user response
    this.deferredPrompt.userChoice.then(choiceResult => {
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted install');
      } else {
        console.log('[PWA] User dismissed install');
      }
      this.deferredPrompt = null;
    });
  },

  _showUpdateAvailable() {
    const updateBanner = document.createElement('div');
    updateBanner.className = 'update-banner';
    updateBanner.innerHTML = `
      <div class="update-banner-content">
        <span class="update-icon">🔄</span>
        <div class="update-text">
          <strong>Update Available</strong>
          <p>A new version is ready</p>
        </div>
        <button type="button" class="btn btn-sm btn-cyan" onclick="PWA.applyUpdate()">Reload</button>
      </div>
    `;
    document.body.appendChild(updateBanner);

    setTimeout(() => {
      updateBanner.style.display = 'flex';
    }, 100);
  },

  applyUpdate() {
    // Tell service worker to skip waiting
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }

    // Reload the page
    window.location.reload();
  },

  isInstalled() {
    // Check if running as installed PWA
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }
};
