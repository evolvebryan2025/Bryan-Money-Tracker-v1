// ===== REAL-TIME CLOCK =====
const Clock = {
  _interval: null,

  start() {
    this.tick();
    this._interval = setInterval(() => this.tick(), 1000);
  },

  tick() {
    const now = new Date();

    // Time: "12:05:30 AM"
    const time = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    // Date: "Saturday, March 1, 2026"
    const date = now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    // Short date+time for dashboard: "Saturday, March 1, 2026 · 12:05 AM"
    const dashTime = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Sidebar clock
    const clockTimeEl = document.getElementById('sidebar-clock-time');
    const clockDateEl = document.getElementById('sidebar-clock-date');
    if (clockTimeEl) clockTimeEl.textContent = time;
    if (clockDateEl) clockDateEl.textContent = date;

    // Dashboard header date
    const dashDateEl = document.getElementById('dashboard-date');
    if (dashDateEl) dashDateEl.textContent = `${date} · ${dashTime}`;
  }
};

// ===== APP ROUTER & INIT =====
const App = {
  currentView: 'dashboard',

  init() {
    // Seed data if first time
    Storage.seedIfEmpty();

    // Month rollover: create new month bills + mark previous month as paid
    const monthKey = Utils.currentMonthKey();
    if (!Storage.getSetting('rollover_' + monthKey)) {
      // Mark all previous-month bills as paid except Lee Salary (unpaid)
      Storage.markPreviousMonthBillsPaid(['Lee Salary']);
      // Create fresh current-month entries for all recurring bills
      Storage.rolloverRecurringBills();
      Storage.setSetting('rollover_' + monthKey, true);
      // Update monthly snapshot after rollover
      Storage.saveMonthlySnapshot();
    }

    // Migrate all bank accounts to PHP
    if (!Storage.getSetting('banks_all_php')) {
      const banks = Storage.getBanks().map(b => ({ ...b, currency: 'PHP' }));
      Storage.saveBanks(banks);
      Storage.setSetting('banks_all_php', true);
    }

    // Start real-time clock
    Clock.start();

    // Init modules
    Chat.init();

    // Set up navigation
    this._setupNav();

    // Handle hash routing
    this._handleRoute();
    window.addEventListener('hashchange', () => this._handleRoute());

    // Load settings into UI
    Settings.load();

    // Initial render
    this.refreshAll();

    // Save monthly snapshot on load
    Storage.saveMonthlySnapshot();
  },

  _setupNav() {
    // Sidebar nav
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        window.location.hash = view;
      });
    });

    // Mobile nav
    document.querySelectorAll('.mob-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        window.location.hash = view;
      });
    });
  },

  _handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    this.navigate(hash, false);
  },

  navigate(view, updateHash = true) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    // Show target view
    const target = document.getElementById(`view-${view}`);
    if (target) {
      target.classList.add('active');
      this.currentView = view;
    } else {
      document.getElementById('view-dashboard').classList.add('active');
      this.currentView = 'dashboard';
    }

    // Update nav active states
    document.querySelectorAll('.nav-link').forEach(l => {
      l.classList.toggle('active', l.dataset.view === this.currentView);
    });
    document.querySelectorAll('.mob-link').forEach(l => {
      l.classList.toggle('active', l.dataset.view === this.currentView);
    });
    document.querySelectorAll('.mob-more-link').forEach(l => {
      l.classList.toggle('active', l.dataset.view === this.currentView);
    });
    // Close mobile more menu on navigation
    const moreMenu = document.getElementById('mobile-more-menu');
    if (moreMenu) moreMenu.classList.remove('open');

    if (updateHash) {
      window.location.hash = this.currentView;
    }

    // Render the target view
    this._renderView(this.currentView);
  },

  _renderView(view) {
    switch (view) {
      case 'dashboard': Dashboard.render(); break;
      case 'bills': Bills.render(); break;
      case 'income': Income.render(); break;
      case 'banks': Banks.render(); break;
      case 'team': Team.render(); break;
      case 'invoices': Invoices.render(); break;
      case 'goals': Goals.render(); break;
      case 'chat': break; // Chat renders on init
      case 'settings': Settings.load(); break;
    }
  },

  refreshAll() {
    Dashboard.render();
    if (this.currentView !== 'dashboard') {
      this._renderView(this.currentView);
    }
  },

  // Modal management
  showModal(type, existing) {
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    switch (type) {
      case 'add-bill':
        title.textContent = existing ? 'Edit Bill' : 'Add Bill';
        body.innerHTML = Bills.getFormHtml(existing);
        break;
      case 'add-income':
        title.textContent = existing ? 'Edit Income' : 'Add Income';
        body.innerHTML = Income.getFormHtml(existing);
        break;
      case 'add-invoice':
        title.textContent = existing ? 'Edit Invoice' : 'Create Invoice';
        body.innerHTML = Invoices.getFormHtml(existing);
        break;
    }

    overlay.classList.add('open');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
  }
};

// ===== SETTINGS =====
const Settings = {
  load() {
    const goal = Storage.getSetting('goal') || 1120000;
    const currency = Storage.getSetting('currency') || 'PHP';

    const goalEl = document.getElementById('settings-goal');
    const curEl = document.getElementById('settings-currency');

    if (goalEl) goalEl.value = goal;
    if (curEl) curEl.value = currency;
  },

  saveGoal() {
    const goal = Number(document.getElementById('settings-goal').value) || 1120000;
    Storage.setSetting('goal', goal);
    alert('Goal saved!');
    Goals.render();
  },

  saveCurrency() {
    const cur = document.getElementById('settings-currency').value;
    Storage.setSetting('currency', cur);
  },

  resetData() {
    if (confirm('This will delete ALL your financial data. Are you sure?')) {
      if (confirm('Really? This cannot be undone. Export a backup first if needed.')) {
        Storage.resetAll();
        Storage.seedIfEmpty();
        App.refreshAll();
        alert('All data has been reset.');
      }
    }
  }
};

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', () => App.init());
