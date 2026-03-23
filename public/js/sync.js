// ===== FIREBASE CLOUD SYNC =====
const CloudSync = {
  db: null,
  userId: null,
  isEnabled: false,
  isSyncing: false,
  listeners: {},

  async init() {
    // Check if Firebase is available
    if (typeof firebase === 'undefined') {
      console.log('[Sync] Firebase not loaded');
      return;
    }

    // Get Firebase config from settings
    const config = this._getFirebaseConfig();
    if (!config) {
      console.log('[Sync] No Firebase config found. Configure in Settings > Cloud Sync to enable cross-device sync.');
      return;
    }

    try {
      // Initialize Firebase
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }
      this.db = firebase.database();

      // Get user ID (based on logged-in username)
      const session = localStorage.getItem('bf_session');
      if (session) {
        const sessionData = JSON.parse(session);
        this.userId = this._hashUserId(sessionData.username);
      }

      if (!this.userId) {
        console.log('[Sync] No user ID - sync disabled');
        return;
      }

      this.isEnabled = true;
      console.log('[Sync] Cloud sync enabled');

      // Set up real-time listeners
      this._setupListeners();

      // Initial sync from cloud
      await this._pullFromCloud();
    } catch (err) {
      console.error('[Sync] Initialization failed:', err);
      this.isEnabled = false;
    }
  },

  _getFirebaseConfig() {
    // Read config exclusively from user settings - no hardcoded fallback
    const savedConfig = Storage.getSetting('firebase_config');
    if (!savedConfig) {
      console.log('[Sync] Firebase config not set. Please add your Firebase configuration in Settings > Cloud Sync.');
      return null;
    }

    try {
      return JSON.parse(savedConfig);
    } catch (err) {
      console.error('[Sync] Invalid Firebase config JSON:', err);
      return null;
    }
  },

  _hashUserId(username) {
    // Simple hash for user ID
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = ((hash << 5) - hash) + username.charCodeAt(i);
      hash = hash & hash;
    }
    return 'user_' + Math.abs(hash).toString(36);
  },

  // Push local data to cloud
  async pushToCloud(dataType, data) {
    if (!this.isEnabled || this.isSyncing) return;

    try {
      const ref = this.db.ref(`users/${this.userId}/${dataType}`);
      await ref.set({
        data: data,
        lastUpdated: firebase.database.ServerValue.TIMESTAMP
      });
      console.log(`[Sync] Pushed ${dataType} to cloud`);
    } catch (err) {
      console.error(`[Sync] Failed to push ${dataType}:`, err);
    }
  },

  // Pull data from cloud
  async _pullFromCloud() {
    if (!this.isEnabled) return;

    this.isSyncing = true;

    try {
      const snapshot = await this.db.ref(`users/${this.userId}`).once('value');
      const cloudData = snapshot.val();

      if (!cloudData) {
        console.log('[Sync] No cloud data found - uploading local data');
        await this._uploadAllLocalData();
        this.isSyncing = false;
        return;
      }

      // Merge cloud data with local
      console.log('[Sync] Pulling data from cloud');

      if (cloudData.bills) {
        const localBills = Storage.getBills();
        const mergedBills = this._mergeData(localBills, cloudData.bills.data, cloudData.bills.lastUpdated);
        Storage.saveBills(mergedBills);
      }

      if (cloudData.incomes) {
        const localIncomes = Storage.getIncomes();
        const mergedIncomes = this._mergeData(localIncomes, cloudData.incomes.data, cloudData.incomes.lastUpdated);
        Storage.saveIncomes(mergedIncomes);
      }

      if (cloudData.banks) {
        const localBanks = Storage.getBanks();
        const mergedBanks = this._mergeData(localBanks, cloudData.banks.data, cloudData.banks.lastUpdated);
        Storage.saveBanks(mergedBanks);
      }

      if (cloudData.expenses) {
        const localExpenses = Storage.getExpenses ? Storage.getExpenses() : [];
        const mergedExpenses = this._mergeData(localExpenses, cloudData.expenses.data, cloudData.expenses.lastUpdated);
        if (Storage.saveExpenses) Storage.saveExpenses(mergedExpenses);
      }

      console.log('[Sync] Data synced from cloud');

      // Refresh views
      if (typeof Dashboard !== 'undefined') Dashboard.render();
      if (typeof Bills !== 'undefined' && App.currentView === 'bills') Bills.render();
      if (typeof Income !== 'undefined' && App.currentView === 'income') Income.render();
      if (typeof Banks !== 'undefined' && App.currentView === 'banks') Banks.render();
    } catch (err) {
      console.error('[Sync] Failed to pull from cloud:', err);
    }

    this.isSyncing = false;
  },

  _mergeData(localData, cloudData, cloudTimestamp) {
    // Simple merge: use cloud data if it's newer
    const localTimestamp = localStorage.getItem('bf_last_sync') || 0;

    if (cloudTimestamp && cloudTimestamp > localTimestamp) {
      // Cloud is newer, use cloud data
      return cloudData;
    } else {
      // Local is newer or same, keep local
      return localData;
    }
  },

  async _uploadAllLocalData() {
    // Upload all local data to cloud (first-time sync)
    const bills = Storage.getBills();
    const incomes = Storage.getIncomes();
    const banks = Storage.getBanks();
    const expenses = Storage.getExpenses ? Storage.getExpenses() : [];

    await this.pushToCloud('bills', bills);
    await this.pushToCloud('incomes', incomes);
    await this.pushToCloud('banks', banks);
    await this.pushToCloud('expenses', expenses);

    console.log('[Sync] Uploaded all local data to cloud');
  },

  _setupListeners() {
    // Listen for changes from other devices
    const dataTypes = ['bills', 'incomes', 'banks', 'expenses'];

    dataTypes.forEach(type => {
      const ref = this.db.ref(`users/${this.userId}/${type}`);

      this.listeners[type] = ref.on('value', (snapshot) => {
        if (this.isSyncing) return; // Skip during initial sync

        const cloudData = snapshot.val();
        if (!cloudData) return;

        // Check if cloud data is newer than local
        const localTimestamp = localStorage.getItem(`bf_${type}_timestamp`) || 0;

        if (cloudData.lastUpdated > localTimestamp) {
          console.log(`[Sync] Remote change detected for ${type}`);

          // Update local storage
          switch (type) {
            case 'bills':
              Storage.saveBills(cloudData.data);
              if (App.currentView === 'bills' && typeof Bills !== 'undefined') Bills.render();
              break;
            case 'incomes':
              Storage.saveIncomes(cloudData.data);
              if (App.currentView === 'income' && typeof Income !== 'undefined') Income.render();
              break;
            case 'banks':
              Storage.saveBanks(cloudData.data);
              if (App.currentView === 'banks' && typeof Banks !== 'undefined') Banks.render();
              break;
            case 'expenses':
              if (Storage.saveExpenses) Storage.saveExpenses(cloudData.data);
              break;
          }

          // Update timestamp
          localStorage.setItem(`bf_${type}_timestamp`, cloudData.lastUpdated);

          // Refresh dashboard
          if (typeof Dashboard !== 'undefined') Dashboard.render();

          // Show sync notification
          this._showSyncNotification(type);
        }
      });
    });

    console.log('[Sync] Real-time listeners active');
  },

  _showSyncNotification(dataType) {
    // Show a subtle notification that data was synced
    const notification = document.createElement('div');
    notification.className = 'sync-notification';
    notification.innerHTML = `<span>🔄</span> ${dataType} synced from another device`;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
    }, 100);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  },

  disconnect() {
    // Remove listeners
    Object.keys(this.listeners).forEach(type => {
      if (this.listeners[type]) {
        const ref = this.db.ref(`users/${this.userId}/${type}`);
        ref.off('value', this.listeners[type]);
      }
    });

    this.isEnabled = false;
    console.log('[Sync] Disconnected from cloud sync');
  }
};
