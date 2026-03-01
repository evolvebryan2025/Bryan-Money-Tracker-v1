// ===== SMART BILL REMINDERS & NOTIFICATIONS =====
const Notifications = {
  _checkInterval: null,
  _dailySummaryScheduled: false,

  init() {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.log('[Notifications] Not supported in this browser');
      return;
    }

    // Load notification settings
    const enabled = Storage.getSetting('notifications_enabled');

    // If enabled (or first time), request permission
    if (enabled !== false && Notification.permission === 'default') {
      this.requestPermission();
    }

    // Start checking if enabled
    if (enabled !== false) {
      this.startChecking();
    }

    // Update settings UI
    this._updateSettingsUI();
  },

  requestPermission() {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        console.log('[Notifications] Permission granted');
        Storage.setSetting('notifications_enabled', true);
        this._sendTestNotification();
        this.startChecking();
      } else if (permission === 'denied') {
        console.log('[Notifications] Permission denied');
        Storage.setSetting('notifications_enabled', false);
      }
      this._updateSettingsUI();
    });
  },

  _sendTestNotification() {
    this._showNotification('Notifications Enabled! 🎉', {
      body: 'You\'ll now receive bill reminders',
      icon: '/icon-192.png',
      badge: '/badge-72.png'
    });
  },

  startChecking() {
    if (this._checkInterval) {
      clearInterval(this._checkInterval);
    }

    // Check immediately
    this.checkBills();

    // Then check every hour
    this._checkInterval = setInterval(() => {
      this.checkBills();
    }, 60 * 60 * 1000); // 1 hour

    // Schedule daily summary if not already scheduled
    if (!this._dailySummaryScheduled) {
      this._scheduleDailySummary();
    }
  },

  stopChecking() {
    if (this._checkInterval) {
      clearInterval(this._checkInterval);
      this._checkInterval = null;
    }
    Storage.setSetting('notifications_enabled', false);
    this._updateSettingsUI();
  },

  checkBills() {
    const enabled = Storage.getSetting('notifications_enabled');
    if (enabled === false || Notification.permission !== 'granted') {
      return;
    }

    const bills = Storage.getBills();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const in3Days = new Date(today);
    in3Days.setDate(today.getDate() + 3);

    bills.forEach(bill => {
      if (bill.status === 'paid' || !bill.dueDate) return;

      const dueDate = new Date(bill.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

      // Overdue bills
      if (daysUntil < 0) {
        const notifKey = `notif_overdue_${bill.id}_${bill.dueDate}`;
        if (!Storage.getSetting(notifKey)) {
          this._showNotification('⚠️ Bill Overdue!', {
            body: `${bill.name}: ₱${bill.amount.toLocaleString()} was due ${Math.abs(daysUntil)} days ago`,
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            tag: bill.id,
            requireInteraction: true
          });
          Storage.setSetting(notifKey, true);
        }
      }
      // Due today
      else if (daysUntil === 0) {
        const notifKey = `notif_today_${bill.id}_${bill.dueDate}`;
        if (!Storage.getSetting(notifKey)) {
          this._showNotification('📅 Bill Due Today!', {
            body: `${bill.name}: ₱${bill.amount.toLocaleString()}`,
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            tag: bill.id
          });
          Storage.setSetting(notifKey, true);
        }
      }
      // Due in 3 days
      else if (daysUntil === 3) {
        const notifKey = `notif_3days_${bill.id}_${bill.dueDate}`;
        if (!Storage.getSetting(notifKey)) {
          this._showNotification('🔔 Bill Reminder', {
            body: `${bill.name}: ₱${bill.amount.toLocaleString()} due in 3 days`,
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            tag: bill.id
          });
          Storage.setSetting(notifKey, true);
        }
      }
    });
  },

  _scheduleDailySummary() {
    const now = new Date();
    const next9AM = new Date();
    next9AM.setHours(9, 0, 0, 0);

    // If already past 9 AM today, schedule for tomorrow
    if (now >= next9AM) {
      next9AM.setDate(next9AM.getDate() + 1);
    }

    const msUntil9AM = next9AM - now;

    setTimeout(() => {
      this._sendDailySummary();
      // Reschedule for next day
      this._dailySummaryScheduled = false;
      this._scheduleDailySummary();
    }, msUntil9AM);

    this._dailySummaryScheduled = true;
    console.log(`[Notifications] Daily summary scheduled for ${next9AM.toLocaleString()}`);
  },

  _sendDailySummary() {
    const enabled = Storage.getSetting('notifications_enabled');
    if (enabled === false || Notification.permission !== 'granted') {
      return;
    }

    const data = Budget.calculate();
    const today = new Date();
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });

    let body = `Good morning! Here's your ${dayName} summary:\n\n`;
    body += `💰 Safe to spend: ₱${data.safeToSpend.toLocaleString()}\n`;
    body += `📊 Daily budget: ₱${data.dailyBudget.toLocaleString()}\n`;

    if (data.overdueBills.length > 0) {
      body += `\n⚠️ ${data.overdueBills.length} overdue bills`;
    } else if (data.upcomingBills.length > 0) {
      body += `\n📅 ${data.upcomingBills.length} bills due this week`;
    }

    this._showNotification('Daily Finance Summary', {
      body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      requireInteraction: false
    });
  },

  _showNotification(title, options) {
    if (Notification.permission !== 'granted') return;

    const notification = new Notification(title, {
      ...options,
      vibrate: [200, 100, 200]
    });

    notification.onclick = () => {
      window.focus();
      if (options.tag) {
        // Navigate to bills view if clicking a bill notification
        window.location.hash = '#bills';
      }
      notification.close();
    };

    return notification;
  },

  _updateSettingsUI() {
    const toggle = document.getElementById('notifications-toggle');
    if (!toggle) return;

    const enabled = Storage.getSetting('notifications_enabled');
    toggle.checked = enabled !== false && Notification.permission === 'granted';
  },

  toggleNotifications(enabled) {
    if (enabled) {
      if (Notification.permission === 'granted') {
        Storage.setSetting('notifications_enabled', true);
        this.startChecking();
      } else {
        this.requestPermission();
      }
    } else {
      this.stopChecking();
    }
  },

  // Visual urgency indicators for bills list
  getUrgencyClass(bill) {
    if (bill.status === 'paid') return '';
    if (!bill.dueDate) return '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(bill.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) {
      return 'bill-overdue'; // Red pulse animation
    } else if (daysUntil === 0) {
      return 'bill-due-today'; // Yellow highlight
    } else if (daysUntil <= 2) {
      return 'bill-due-soon'; // Orange highlight
    }

    return '';
  }
};
