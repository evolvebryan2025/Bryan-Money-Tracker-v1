// ===== SUPABASE CLOUD SYNC =====
const SUPABASE_URL = 'https://nvzqislwwzkqhsundtbx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52enFpc2x3d3prcWhzdW5kdGJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTAyNDYsImV4cCI6MjA4OTc4NjI0Nn0.NDlBsGq2yFs9aolFYsxQaYXwE6e2EYvQSGYNgnWfZt0';

const CloudSync = {
  client: null,
  userEmail: null,
  isEnabled: false,
  isSyncing: false,
  realtimeChannel: null,

  async init() {
    // Check if Supabase JS client is available
    if (typeof supabase === 'undefined' || !supabase.createClient) {
      console.log('[Sync] Supabase JS client not loaded');
      return;
    }

    // Get user email from session
    const email = this._getUserEmail();
    if (!email) {
      console.log('[Sync] No user email found - sync disabled');
      return;
    }

    try {
      // Initialize Supabase client
      this.client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      this.userEmail = email;
      this.isEnabled = true;
      console.log('[Sync] Supabase cloud sync enabled for', email);

      // Set up real-time listener
      this._setupRealtimeListener();

      // Initial sync from cloud
      await this._pullFromCloud();
    } catch (err) {
      console.error('[Sync] Initialization failed:', err);
      this.isEnabled = false;
    }
  },

  _getUserEmail() {
    try {
      const session = JSON.parse(localStorage.getItem('bf_session') || '{}');
      return session.email || null;
    } catch (err) {
      console.error('[Sync] Failed to read session:', err);
      return null;
    }
  },

  // Push local data to cloud
  async pushToCloud(dataType, data) {
    if (!this.isEnabled || this.isSyncing || !this.client) return;

    try {
      const { error } = await this.client.rpc('upsert_finance_data', {
        p_email: this.userEmail,
        p_type: dataType,
        p_data: data
      });

      if (error) {
        console.error(`[Sync] Failed to push ${dataType}:`, error.message);
        return;
      }

      // Store local timestamp for merge comparison
      localStorage.setItem(`bf_${dataType}_timestamp`, new Date().toISOString());
      console.log(`[Sync] Pushed ${dataType} to cloud`);
    } catch (err) {
      console.error(`[Sync] Failed to push ${dataType}:`, err);
    }
  },

  // Pull all data from cloud
  async _pullFromCloud() {
    if (!this.isEnabled || !this.client) return;

    this.isSyncing = true;

    try {
      const { data: rows, error } = await this.client
        .from('finance_sync')
        .select('data_type, data, updated_at')
        .eq('user_email', this.userEmail);

      if (error) {
        console.error('[Sync] Failed to pull from cloud:', error.message);
        this.isSyncing = false;
        return;
      }

      if (!rows || rows.length === 0) {
        console.log('[Sync] No cloud data found - uploading local data');
        await this._uploadAllLocalData();
        this.isSyncing = false;
        return;
      }

      console.log('[Sync] Pulling data from cloud');

      const dataMap = {};
      for (const row of rows) {
        dataMap[row.data_type] = { data: row.data, updatedAt: row.updated_at };
      }

      if (dataMap.bills) {
        const localBills = Storage.getBills();
        const merged = this._mergeData(localBills, dataMap.bills.data, dataMap.bills.updatedAt, 'bills');
        Storage.saveBills(merged);
      }

      if (dataMap.incomes) {
        const localIncomes = Storage.getIncomes();
        const merged = this._mergeData(localIncomes, dataMap.incomes.data, dataMap.incomes.updatedAt, 'incomes');
        Storage.saveIncomes(merged);
      }

      if (dataMap.banks) {
        const localBanks = Storage.getBanks();
        const merged = this._mergeData(localBanks, dataMap.banks.data, dataMap.banks.updatedAt, 'banks');
        Storage.saveBanks(merged);
      }

      if (dataMap.expenses) {
        const localExpenses = Storage.getExpenses ? Storage.getExpenses() : [];
        const merged = this._mergeData(localExpenses, dataMap.expenses.data, dataMap.expenses.updatedAt, 'expenses');
        if (Storage.saveExpenses) Storage.saveExpenses(merged);
      }

      if (dataMap.team) {
        const localTeam = Storage.getTeam ? Storage.getTeam() : [];
        const merged = this._mergeData(localTeam, dataMap.team.data, dataMap.team.updatedAt, 'team');
        if (Storage.saveTeam) Storage.saveTeam(merged);
      }

      if (dataMap.invoices) {
        const localInvoices = Storage.getInvoices ? Storage.getInvoices() : [];
        const merged = this._mergeData(localInvoices, dataMap.invoices.data, dataMap.invoices.updatedAt, 'invoices');
        if (Storage.saveInvoices) Storage.saveInvoices(merged);
      }

      if (dataMap.settings) {
        // Settings are a special case - merge carefully
        const cloudSettings = dataMap.settings.data;
        if (cloudSettings && typeof cloudSettings === 'object') {
          for (const [key, value] of Object.entries(cloudSettings)) {
            if (!Storage.getSetting(key)) {
              Storage.setSetting(key, value);
            }
          }
        }
      }

      // Update last sync timestamp
      localStorage.setItem('bf_last_sync', new Date().toISOString());

      console.log('[Sync] Data synced from cloud');

      // Refresh views
      this._refreshViews();
    } catch (err) {
      console.error('[Sync] Failed to pull from cloud:', err);
    }

    this.isSyncing = false;
  },

  _mergeData(localData, cloudData, cloudUpdatedAt, dataType) {
    // Cloud wins if it's newer than local
    const localTimestamp = localStorage.getItem(`bf_${dataType}_timestamp`) || '1970-01-01T00:00:00Z';

    if (cloudUpdatedAt && new Date(cloudUpdatedAt) > new Date(localTimestamp)) {
      return cloudData;
    }
    return localData;
  },

  async _uploadAllLocalData() {
    const bills = Storage.getBills();
    const incomes = Storage.getIncomes();
    const banks = Storage.getBanks();
    const expenses = Storage.getExpenses ? Storage.getExpenses() : [];
    const team = Storage.getTeam ? Storage.getTeam() : [];
    const invoices = Storage.getInvoices ? Storage.getInvoices() : [];

    await this.pushToCloud('bills', bills);
    await this.pushToCloud('incomes', incomes);
    await this.pushToCloud('banks', banks);
    await this.pushToCloud('expenses', expenses);
    await this.pushToCloud('team', team);
    await this.pushToCloud('invoices', invoices);

    console.log('[Sync] Uploaded all local data to cloud');
  },

  _setupRealtimeListener() {
    if (!this.client) return;

    try {
      this.realtimeChannel = this.client
        .channel('finance-sync-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'finance_sync',
            filter: `user_email=eq.${this.userEmail}`
          },
          (payload) => {
            if (this.isSyncing) return;

            const row = payload.new;
            if (!row || !row.data_type || !row.data) return;

            const dataType = row.data_type;
            const cloudData = row.data;

            console.log(`[Sync] Remote change detected for ${dataType}`);

            // Update local storage based on data type
            switch (dataType) {
              case 'bills':
                Storage.saveBills(cloudData);
                break;
              case 'incomes':
                Storage.saveIncomes(cloudData);
                break;
              case 'banks':
                Storage.saveBanks(cloudData);
                break;
              case 'expenses':
                if (Storage.saveExpenses) Storage.saveExpenses(cloudData);
                break;
              case 'team':
                if (Storage.saveTeam) Storage.saveTeam(cloudData);
                break;
              case 'invoices':
                if (Storage.saveInvoices) Storage.saveInvoices(cloudData);
                break;
            }

            // Update local timestamp
            localStorage.setItem(`bf_${dataType}_timestamp`, row.updated_at || new Date().toISOString());

            // Refresh views and show notification
            this._refreshViews();
            this._showSyncNotification(dataType);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Sync] Real-time listener active');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('[Sync] Real-time channel error');
          }
        });
    } catch (err) {
      console.error('[Sync] Failed to set up real-time listener:', err);
    }
  },

  _refreshViews() {
    if (typeof Dashboard !== 'undefined') Dashboard.render();
    if (typeof Bills !== 'undefined' && typeof App !== 'undefined' && App.currentView === 'bills') Bills.render();
    if (typeof Income !== 'undefined' && typeof App !== 'undefined' && App.currentView === 'income') Income.render();
    if (typeof Banks !== 'undefined' && typeof App !== 'undefined' && App.currentView === 'banks') Banks.render();
    if (typeof Team !== 'undefined' && typeof App !== 'undefined' && App.currentView === 'team') Team.render();
    if (typeof Invoices !== 'undefined' && typeof App !== 'undefined' && App.currentView === 'invoices') Invoices.render();
  },

  _showSyncNotification(dataType) {
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

  // Manual sync trigger (for Sync Now button)
  async syncNow() {
    if (!this.isEnabled || !this.client) {
      console.log('[Sync] Sync not available');
      return false;
    }

    try {
      // Push all local data first
      await this._uploadAllLocalData();
      // Then pull to get any remote changes
      await this._pullFromCloud();
      return true;
    } catch (err) {
      console.error('[Sync] Manual sync failed:', err);
      return false;
    }
  },

  disconnect() {
    // Remove real-time subscription
    if (this.realtimeChannel && this.client) {
      this.client.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }

    this.isEnabled = false;
    this.client = null;
    this.userEmail = null;
    console.log('[Sync] Disconnected from cloud sync');
  }
};
