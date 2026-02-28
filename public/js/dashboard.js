// ===== DASHBOARD =====
const Dashboard = {
  render() {
    const data = Budget.calculate();

    // Daily budget hero
    document.getElementById('daily-budget-amount').textContent = Utils.money(data.dailyBudget);
    document.getElementById('daily-budget-sub').textContent =
      `${Utils.money(data.safeToSpend)} safe to spend · ${data.daysLeft} days left in ${Utils.currentMonth()}`;

    // Metric cards
    document.getElementById('metric-bills').textContent = Utils.money(data.totalBills);
    document.getElementById('metric-bills-sub').textContent =
      `${data.overdueBills.length} overdue · ${data.upcomingBills.length} upcoming`;

    document.getElementById('metric-income').textContent = Utils.money(data.totalIncome);
    document.getElementById('metric-income-sub').textContent = 'expected this month';

    document.getElementById('metric-cash').textContent = Utils.money(data.totalCash);
    document.getElementById('metric-cash-sub').textContent = 'across all accounts';

    document.getElementById('metric-priority').textContent = Utils.money(data.upcomingTotal + data.overdueTotal);
    document.getElementById('metric-priority-sub').textContent =
      data.overdueBills.length > 0
        ? `${data.overdueBills.length} overdue + ${data.upcomingBills.length} due this week`
        : `${data.upcomingBills.length} bills due this week`;

    // Upcoming bills timeline
    this._renderTimeline(data);

    // Cash flow chart
    this._renderChart();
  },

  _renderTimeline(data) {
    const container = document.getElementById('upcoming-bills-list');
    const allUrgent = [...data.overdueBills, ...data.upcomingBills];

    if (allUrgent.length === 0) {
      container.innerHTML = '<p class="empty-state">No urgent bills in the next 7 days</p>';
      return;
    }

    container.innerHTML = allUrgent.map(bill => {
      const days = Utils.daysUntil(bill.dueDate);
      const cls = days < 0 ? 'urgent' : days <= 2 ? 'soon' : '';
      const label = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `in ${days}d`;
      return `
        <div class="timeline-item ${cls}">
          <span class="t-name">${Utils.esc(bill.name)}</span>
          <span class="t-amount">${Utils.money(bill.amount)}</span>
          <span class="t-date">${label}</span>
        </div>`;
    }).join('');
  },

  _renderChart() {
    const history = Storage.getMonthlyHistory();
    if (history.length === 0) {
      // Use current month at least
      Storage.saveMonthlySnapshot();
    }
    const data = Storage.getMonthlyHistory();
    const labels = data.map(h => {
      const [y, m] = h.month.split('-');
      return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'short' });
    });

    Utils.drawBarChart('cashflow-chart', labels, [
      { label: 'Income', data: data.map(h => h.income), color: 'rgba(255,255,255,0.6)' },
      { label: 'Bills', data: data.map(h => h.bills), color: '#ef4444' }
    ]);
  }
};
