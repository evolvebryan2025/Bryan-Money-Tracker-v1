// ===== GOALS & PROJECTIONS =====
const Goals = {
  render() {
    const data = Budget.calculate();
    const goal = Number(Storage.getSetting('goal')) || 1120000;
    const currentIncome = data.totalIncome;
    const progress = Math.min((currentIncome / goal) * 100, 100);

    // Progress bar
    document.getElementById('goal-progress-bar').style.width = progress.toFixed(1) + '%';
    document.getElementById('goal-progress-text').textContent =
      `${Utils.money(currentIncome)} / ${Utils.money(goal)} (${progress.toFixed(1)}%)`;

    // Metrics
    document.getElementById('goal-current').textContent = Utils.money(currentIncome);
    document.getElementById('goal-savings').textContent = data.savingsRate + '%';

    // Months to goal estimate
    const history = Storage.getMonthlyHistory();
    const monthsToGoal = this._estimateMonthsToGoal(history, currentIncome, goal);
    document.getElementById('goal-months').textContent = monthsToGoal;

    // Chart
    this._renderChart(history);

    // Milestones
    this._renderMilestones(currentIncome);
  },

  _estimateMonthsToGoal(history, current, goal) {
    if (current >= goal) return 'Reached!';
    if (history.length < 2) return '--';

    // Calculate average monthly growth
    const incomes = history.map(h => h.income);
    if (incomes.length < 2) return '--';

    let totalGrowth = 0;
    let growthPeriods = 0;
    for (let i = 1; i < incomes.length; i++) {
      if (incomes[i - 1] > 0) {
        totalGrowth += incomes[i] - incomes[i - 1];
        growthPeriods++;
      }
    }

    if (growthPeriods === 0 || totalGrowth <= 0) return '∞';

    const avgGrowth = totalGrowth / growthPeriods;
    const remaining = goal - current;
    const months = Math.ceil(remaining / avgGrowth);

    return months > 120 ? '120+' : String(months);
  },

  _renderChart(history) {
    if (history.length === 0) return;

    const labels = history.map(h => {
      const [y, m] = h.month.split('-');
      return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'short' });
    });

    Utils.drawBarChart('goals-chart', labels, [
      { label: 'Income', data: history.map(h => h.income), color: '#06b6d4' },
      { label: 'Profit', data: history.map(h => Math.max(h.profit, 0)), color: '#22c55e' }
    ]);
  },

  _renderMilestones(currentIncome) {
    const milestones = [
      { label: '₱50K/month', value: 50000 },
      { label: '₱100K/month', value: 100000 },
      { label: '₱200K/month (5 solid clients)', value: 200000 },
      { label: '₱500K/month (10+ clients)', value: 500000 },
      { label: '₱1M/month (approaching $20K USD)', value: 1000000 },
      { label: '₱1.12M/month ($20K USD goal)', value: 1120000 }
    ];

    const container = document.getElementById('milestones-list');
    container.innerHTML = milestones.map(m => {
      const done = currentIncome >= m.value;
      return `
        <div class="milestone">
          <div class="milestone-check ${done ? 'done' : ''}">${done ? '✓' : ''}</div>
          <span class="milestone-label">${m.label}</span>
          <span class="milestone-value">${Utils.money(m.value)}</span>
        </div>`;
    }).join('');
  }
};
