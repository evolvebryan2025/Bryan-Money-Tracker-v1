// ===== AI INSIGHTS ENGINE =====
const Insights = {
  _cachedInsights: null,
  _lastCalculated: 0,
  _cacheDuration: 5 * 60 * 1000, // 5 minutes

  generate() {
    const now = Date.now();

    // Return cached if still fresh
    if (this._cachedInsights && (now - this._lastCalculated) < this._cacheDuration) {
      return this._cachedInsights;
    }

    const insights = [];
    const data = Budget.calculate();
    const bills = Storage.getBills();
    const incomes = Storage.getIncomes();
    const banks = Storage.getBanks();

    // INSIGHT 1: Cash Crunch Alert
    const cashCrunch = this._detectCashCrunch(data, bills, incomes);
    if (cashCrunch) insights.push(cashCrunch);

    // INSIGHT 2: Overdue Client Payments
    const overduePayment = this._detectOverdueIncome(incomes);
    if (overduePayment) insights.push(overduePayment);

    // INSIGHT 3: Overspending Warning
    const overspending = this._detectOverspending(data);
    if (overspending) insights.push(overspending);

    // INSIGHT 4: Low Balance Warning
    const lowBalance = this._detectLowBalance(data, banks);
    if (lowBalance) insights.push(lowBalance);

    // INSIGHT 5: Bill Spike Alert
    const billSpike = this._detectBillSpike(bills);
    if (billSpike) insights.push(billSpike);

    // Sort by priority (urgency) and take top 3
    insights.sort((a, b) => b.priority - a.priority);
    const topInsights = insights.slice(0, 3);

    this._cachedInsights = topInsights;
    this._lastCalculated = now;

    return topInsights;
  },

  _detectCashCrunch(data, bills, incomes) {
    // Simulate daily spend and predict when cash runs out
    const dailySpend = data.dailyBudget || 0;
    const upcomingBillsTotal = data.upcomingTotal + data.overdueTotal;
    const cashOnHand = data.totalCash;

    // Find next income date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextIncome = incomes
      .filter(i => i.nextDate && i.amount > 0)
      .map(i => ({ ...i, dateObj: new Date(i.nextDate) }))
      .filter(i => i.dateObj >= today)
      .sort((a, b) => a.dateObj - b.dateObj)[0];

    if (!nextIncome) return null;

    const daysUntilIncome = Math.ceil((nextIncome.dateObj - today) / (1000 * 60 * 60 * 24));
    const projectedSpend = dailySpend * daysUntilIncome;
    const totalNeeded = upcomingBillsTotal + projectedSpend;
    const shortfall = totalNeeded - cashOnHand;

    if (shortfall > 0) {
      return {
        type: 'warning',
        icon: '⚠️',
        title: 'Cash Crunch Alert',
        message: `You'll be short ₱${shortfall.toLocaleString()} before your next income on ${Utils.dateStr(nextIncome.nextDate)}`,
        action: 'View Bills',
        actionFn: () => App.navigate('bills'),
        chatPrompt: `I'm short ₱${shortfall.toLocaleString()} before my next income. What should I do?`,
        priority: 10
      };
    }

    return null;
  },

  _detectOverdueIncome(incomes) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue = incomes.filter(i => {
      if (!i.nextDate || i.status === 'received') return false;
      const dueDate = new Date(i.nextDate);
      return dueDate < today;
    });

    if (overdue.length === 0) return null;

    const mostOverdue = overdue.reduce((max, i) => {
      const days = Math.abs(Utils.daysUntil(i.nextDate));
      const maxDays = Math.abs(Utils.daysUntil(max.nextDate));
      return days > maxDays ? i : max;
    });

    const daysLate = Math.abs(Utils.daysUntil(mostOverdue.nextDate));

    return {
      type: 'danger',
      icon: '🔴',
      title: 'Client Payment Overdue',
      message: `${mostOverdue.name} payment (₱${mostOverdue.amount.toLocaleString()}) is ${daysLate} days late`,
      action: 'View Income',
      actionFn: () => App.navigate('income'),
      chatPrompt: `${mostOverdue.name} is ${daysLate} days late on payment. How should I follow up?`,
      priority: 9
    };
  },

  _detectOverspending(data) {
    // Compare current month's bills vs last month
    const history = Storage.getMonthlyHistory();
    if (history.length < 2) return null;

    const currentMonth = history[history.length - 1];
    const lastMonth = history[history.length - 2];

    const increase = currentMonth.bills - lastMonth.bills;
    const percentIncrease = (increase / lastMonth.bills) * 100;

    if (percentIncrease > 15) {
      return {
        type: 'warning',
        icon: '📈',
        title: 'Spending Spike Detected',
        message: `Your bills are ${percentIncrease.toFixed(0)}% higher than last month (+₱${increase.toLocaleString()})`,
        action: 'Review Bills',
        actionFn: () => App.navigate('bills'),
        chatPrompt: `My spending is up ${percentIncrease.toFixed(0)}% this month. Where can I cut costs?`,
        priority: 7
      };
    }

    return null;
  },

  _detectLowBalance(data, banks) {
    const totalCash = data.totalCash;
    const upcomingBillsTotal = data.upcomingTotal;

    if (totalCash < upcomingBillsTotal * 1.2) {
      return {
        type: 'warning',
        icon: '💰',
        title: 'Low Cash Reserves',
        message: `Your balance (₱${totalCash.toLocaleString()}) barely covers upcoming bills (₱${upcomingBillsTotal.toLocaleString()})`,
        action: 'Update Balance',
        actionFn: () => App.navigate('banks'),
        chatPrompt: 'My cash reserves are low. What are my options?',
        priority: 8
      };
    }

    return null;
  },

  _detectBillSpike(bills) {
    // Check if any week has unusually high bills
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let week = 0; week < 4; week++) {
      const start = new Date(today);
      start.setDate(today.getDate() + (week * 7));
      const end = new Date(start);
      end.setDate(start.getDate() + 7);

      const weekBills = bills.filter(b => {
        if (b.status === 'paid' || !b.dueDate) return false;
        const dueDate = new Date(b.dueDate);
        return dueDate >= start && dueDate < end;
      });

      const weekTotal = weekBills.reduce((s, b) => s + b.amount, 0);

      if (weekTotal > 30000) {
        const weekLabel = week === 0 ? 'this week' : week === 1 ? 'next week' : `in ${week} weeks`;
        return {
          type: 'info',
          icon: '📊',
          title: 'Heavy Bill Week Ahead',
          message: `You have ₱${weekTotal.toLocaleString()} in bills due ${weekLabel} (${weekBills.length} bills)`,
          action: 'See Bills',
          actionFn: () => App.navigate('bills'),
          chatPrompt: `I have ₱${weekTotal.toLocaleString()} in bills ${weekLabel}. How should I prepare?`,
          priority: 6
        };
      }
    }

    return null;
  },

  invalidateCache() {
    this._cachedInsights = null;
  }
};
