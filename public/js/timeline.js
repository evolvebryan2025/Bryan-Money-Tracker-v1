// ===== CASH FLOW TIMELINE =====
const Timeline = {
  currentMonth: null,

  render() {
    // Set current month if not already set
    if (!this.currentMonth) {
      const now = new Date();
      this.currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    // Populate month selector
    this._renderMonthSelector();

    // Get data for selected month
    const [year, month] = this.currentMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();

    // Build daily cash flow data
    const dailyData = this._buildDailyData(year, month - 1, daysInMonth);

    // Calculate summary
    const totalIncome = dailyData.reduce((s, d) => s + d.income, 0);
    const totalExpenses = dailyData.reduce((s, d) => s + d.expenses, 0);
    const netFlow = totalIncome - totalExpenses;

    document.getElementById('timeline-income').textContent = Utils.money(totalIncome);
    document.getElementById('timeline-expenses').textContent = Utils.money(totalExpenses);
    document.getElementById('timeline-net').textContent = Utils.money(netFlow);
    document.getElementById('timeline-net').style.color = netFlow >= 0 ? 'var(--green)' : 'var(--red)';

    // Render calendar grid
    this._renderCalendar(dailyData, year, month - 1);
  },

  _renderMonthSelector() {
    const select = document.getElementById('timeline-month');
    if (!select) return;

    // Generate last 6 months + current + next 3
    const months = [];
    const now = new Date();
    for (let i = -6; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      months.push({ key, label });
    }

    select.innerHTML = months.map(m =>
      `<option value="${m.key}" ${m.key === this.currentMonth ? 'selected' : ''}>${m.label}</option>`
    ).join('');
  },

  _buildDailyData(year, month, daysInMonth) {
    const bills = Storage.getBills();
    const incomes = Storage.getIncomes();
    const expenses = Storage.getExpenses ? Storage.getExpenses() : [];

    const dailyData = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(year, month, day);

      // Bills due this day
      const dayBills = bills.filter(b => b.dueDate === dateStr);
      const billsTotal = dayBills.reduce((s, b) => s + (Number(b.amount) || 0), 0);

      // Income expected this day
      const dayIncome = incomes.filter(i => i.nextDate === dateStr);
      const incomeTotal = dayIncome.reduce((s, i) => s + (Number(i.amount) || 0), 0);

      // Expenses on this day
      const dayExpenses = expenses.filter(e => e.date === dateStr);
      const expensesTotal = dayExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

      dailyData.push({
        day,
        date: dateStr,
        dateObj,
        income: incomeTotal,
        expenses: billsTotal + expensesTotal,
        bills: dayBills,
        incomes: dayIncome,
        adhocExpenses: dayExpenses,
        netFlow: incomeTotal - (billsTotal + expensesTotal)
      });
    }

    return dailyData;
  },

  _renderCalendar(dailyData, year, month) {
    const container = document.getElementById('timeline-grid');
    if (!container) return;

    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find max absolute flow for color scaling
    const maxFlow = Math.max(...dailyData.map(d => Math.abs(d.netFlow)), 1);

    let html = '<div class="timeline-weekdays">';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
      html += `<div class="weekday">${day}</div>`;
    });
    html += '</div><div class="timeline-days">';

    // Empty cells before first day
    for (let i = 0; i < startDayOfWeek; i++) {
      html += '<div class="day-cell day-empty"></div>';
    }

    // Render each day
    dailyData.forEach(data => {
      const isToday = data.dateObj.getTime() === today.getTime();
      const isPast = data.dateObj < today;
      const hasActivity = data.income > 0 || data.expenses > 0;

      // Color intensity based on net flow
      let barColor = 'transparent';
      let barHeight = 0;
      if (hasActivity) {
        const intensity = Math.min(Math.abs(data.netFlow) / maxFlow, 1);
        barHeight = Math.max(intensity * 100, 10); // Min 10% height
        barColor = data.netFlow >= 0 ?
          `rgba(34, 197, 94, ${0.3 + intensity * 0.7})` :
          `rgba(239, 68, 68, ${0.3 + intensity * 0.7})`;
      }

      html += `
        <div class="day-cell ${isToday ? 'day-today' : ''} ${isPast ? 'day-past' : ''} ${hasActivity ? 'day-active' : ''}"
             onclick="Timeline.showDetail('${data.date}')">
          <div class="day-number">${data.day}</div>
          <div class="day-bar" style="height:${barHeight}%; background:${barColor}"></div>
          ${hasActivity ? `<div class="day-net">${Utils.moneyShort(data.netFlow)}</div>` : ''}
        </div>`;
    });

    html += '</div>';
    container.innerHTML = html;
  },

  showDetail(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const data = this._buildDailyData(year, month - 1, new Date(year, month, 0).getDate());
    const dayData = data.find(d => d.date === dateStr);

    if (!dayData) return;

    const modal = document.getElementById('day-detail');
    const title = document.getElementById('day-detail-title');
    const body = document.getElementById('day-detail-body');

    const dateObj = new Date(dateStr);
    title.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    let html = '<div class="day-detail-sections">';

    // Income
    if (dayData.incomes.length > 0) {
      html += '<div class="detail-section detail-income">';
      html += '<h4>Income Expected</h4>';
      dayData.incomes.forEach(i => {
        html += `<div class="detail-item">
          <span>${Utils.esc(i.name)}</span>
          <span class="detail-amount">${Utils.money(i.amount)}</span>
        </div>`;
      });
      html += `<div class="detail-total">Total: ${Utils.money(dayData.income)}</div>`;
      html += '</div>';
    }

    // Bills
    if (dayData.bills.length > 0) {
      html += '<div class="detail-section detail-bills">';
      html += '<h4>Bills Due</h4>';
      dayData.bills.forEach(b => {
        const statusClass = b.status === 'paid' ? 'paid' : 'unpaid';
        html += `<div class="detail-item">
          <span>${Utils.esc(b.name)} <span class="status-badge ${statusClass}">${b.status}</span></span>
          <span class="detail-amount">-${Utils.money(b.amount)}</span>
        </div>`;
      });
      const billsTotal = dayData.bills.reduce((s, b) => s + b.amount, 0);
      html += `<div class="detail-total">Total: -${Utils.money(billsTotal)}</div>`;
      html += '</div>';
    }

    // Adhoc Expenses
    if (dayData.adhocExpenses && dayData.adhocExpenses.length > 0) {
      html += '<div class="detail-section detail-expenses">';
      html += '<h4>Expenses</h4>';
      dayData.adhocExpenses.forEach(e => {
        html += `<div class="detail-item">
          <span>${Utils.esc(e.name)} <span class="detail-category">${e.category}</span></span>
          <span class="detail-amount">-${Utils.money(e.amount)}</span>
        </div>`;
      });
      const expTotal = dayData.adhocExpenses.reduce((s, e) => s + e.amount, 0);
      html += `<div class="detail-total">Total: -${Utils.money(expTotal)}</div>`;
      html += '</div>';
    }

    if (dayData.incomes.length === 0 && dayData.bills.length === 0 && (!dayData.adhocExpenses || dayData.adhocExpenses.length === 0)) {
      html += '<p class="empty-state">No transactions on this day</p>';
    }

    html += `<div class="day-detail-net ${dayData.netFlow >= 0 ? 'positive' : 'negative'}">
      Net Flow: ${Utils.money(dayData.netFlow)}
    </div>`;
    html += '</div>';

    body.innerHTML = html;
    modal.style.display = 'flex';
  },

  closeDetail() {
    document.getElementById('day-detail').style.display = 'none';
  },

  changeMonth() {
    const select = document.getElementById('timeline-month');
    this.currentMonth = select.value;
    this.render();
  }
};
