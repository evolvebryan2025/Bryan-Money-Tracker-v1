// ===== BACCARAT PROFIT SHARE =====
const Baccarat = {
  _currentMonth: null,

  _init() {
    if (!this._currentMonth) {
      this._currentMonth = Utils.currentMonthKey();
    }
  },

  render() {
    this._init();
    const container = document.getElementById('baccarat-content');
    if (!container) return;

    const monthData = this._getMonthData(this._currentMonth);
    const calc = this._calculate(monthData);

    container.innerHTML = this._buildMonthSelector()
      + this._buildIncomeSection(monthData.income)
      + this._buildExpensesSection(monthData.expenses)
      + this._buildEmployeesSection(monthData.employees)
      + this._buildProfitSummary(calc)
      + this._buildHistory();
  },

  // --- Data Access ---

  _getAllData() {
    return Storage.getBaccarat();
  },

  _getMonthData(monthKey) {
    const all = this._getAllData();
    const month = (all.months && all.months[monthKey]) || {};
    return {
      income: Array.isArray(month.income) ? month.income : [],
      expenses: Array.isArray(month.expenses) ? month.expenses : [],
      employees: Array.isArray(month.employees) ? month.employees : []
    };
  },

  _saveMonthData(monthKey, data) {
    const all = this._getAllData();
    const updated = {
      ...all,
      months: {
        ...all.months,
        [monthKey]: { ...data }
      }
    };
    Storage.saveBaccarat(updated);
  },

  // --- Calculations ---

  _calculate(monthData) {
    const totalIncome = monthData.income.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const totalExpenses = monthData.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const totalEmployees = monthData.employees.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const netProfit = totalIncome - totalExpenses - totalEmployees;
    const share = netProfit / 3;

    return {
      totalIncome,
      totalExpenses,
      totalEmployees,
      netProfit,
      bryanShare: share,
      andreShare: share,
      carloShare: share
    };
  },

  // --- Month Selector ---

  _buildMonthSelector() {
    const options = this._getMonthOptions();
    return `
      <div class="baccarat-month-selector">
        <select id="baccarat-month" onchange="Baccarat.changeMonth()" aria-label="Select month">
          ${options.map(o => `<option value="${Utils.esc(o.value)}" ${o.value === this._currentMonth ? 'selected' : ''}>${Utils.esc(o.label)}</option>`).join('')}
        </select>
      </div>`;
  },

  _getMonthOptions() {
    const now = new Date();
    const options = [];
    for (let i = 5; i >= -6; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ value: key, label });
    }
    return options;
  },

  changeMonth() {
    const sel = document.getElementById('baccarat-month');
    if (sel) {
      this._currentMonth = sel.value;
      this.render();
    }
  },

  // --- Income Section ---

  _buildIncomeSection(items) {
    const rows = items.map((item, idx) => `
      <tr>
        <td>
          <input type="text" class="baccarat-input" value="${Utils.esc(item.name)}"
            onchange="Baccarat._updateItem('income', ${idx}, 'name', this.value)" placeholder="Client name">
        </td>
        <td class="col-amount">
          <input type="number" class="baccarat-input baccarat-amount" value="${item.amount || ''}"
            onchange="Baccarat._updateItem('income', ${idx}, 'amount', this.value)" placeholder="0" min="0" step="0.01">
        </td>
        <td class="col-action">
          <button type="button" class="btn-icon btn-delete" onclick="Baccarat.removeItem('income', ${idx})" title="Remove">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </td>
      </tr>`).join('');

    const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

    return `
      <div class="baccarat-section section-card">
        <h3>Subscription Income</h3>
        <div class="table-wrap">
          <table class="baccarat-table">
            <thead><tr><th>Client Name</th><th class="col-amount">Amount</th><th class="col-action"></th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><td><strong>Total</strong></td><td class="col-amount"><strong>${Utils.money(total)}</strong></td><td></td></tr></tfoot>
          </table>
        </div>
        <button type="button" class="btn btn-sm btn-cyan add-item-btn" onclick="Baccarat.addIncome()">+ Add Income</button>
      </div>`;
  },

  addIncome() {
    const monthData = this._getMonthData(this._currentMonth);
    const updated = {
      ...monthData,
      income: [...monthData.income, { name: '', amount: 0, id: Utils.uid() }]
    };
    this._saveMonthData(this._currentMonth, updated);
    this.render();
  },

  // --- Expenses Section ---

  _buildExpensesSection(items) {
    const rows = items.map((item, idx) => `
      <tr>
        <td>
          <input type="text" class="baccarat-input" value="${Utils.esc(item.name)}"
            onchange="Baccarat._updateItem('expenses', ${idx}, 'name', this.value)" placeholder="Description">
        </td>
        <td class="col-amount">
          <input type="number" class="baccarat-input baccarat-amount" value="${item.amount || ''}"
            onchange="Baccarat._updateItem('expenses', ${idx}, 'amount', this.value)" placeholder="0" min="0" step="0.01">
        </td>
        <td class="col-action">
          <button type="button" class="btn-icon btn-delete" onclick="Baccarat.removeItem('expenses', ${idx})" title="Remove">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </td>
      </tr>`).join('');

    const total = items.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    return `
      <div class="baccarat-section section-card">
        <h3>Expenses</h3>
        <div class="table-wrap">
          <table class="baccarat-table">
            <thead><tr><th>Description</th><th class="col-amount">Amount</th><th class="col-action"></th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><td><strong>Total</strong></td><td class="col-amount"><strong>${Utils.money(total)}</strong></td><td></td></tr></tfoot>
          </table>
        </div>
        <button type="button" class="btn btn-sm btn-cyan add-item-btn" onclick="Baccarat.addExpense()">+ Add Expense</button>
      </div>`;
  },

  addExpense() {
    const monthData = this._getMonthData(this._currentMonth);
    const updated = {
      ...monthData,
      expenses: [...monthData.expenses, { name: '', amount: 0, id: Utils.uid() }]
    };
    this._saveMonthData(this._currentMonth, updated);
    this.render();
  },

  // --- Employees Section ---

  _buildEmployeesSection(items) {
    const rows = items.map((item, idx) => `
      <tr>
        <td>
          <input type="text" class="baccarat-input" value="${Utils.esc(item.name)}"
            onchange="Baccarat._updateItem('employees', ${idx}, 'name', this.value)" placeholder="Employee name">
        </td>
        <td class="col-amount">
          <input type="number" class="baccarat-input baccarat-amount" value="${item.amount || ''}"
            onchange="Baccarat._updateItem('employees', ${idx}, 'amount', this.value)" placeholder="0" min="0" step="0.01">
        </td>
        <td class="col-action">
          <button type="button" class="btn-icon btn-delete" onclick="Baccarat.removeItem('employees', ${idx})" title="Remove">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </td>
      </tr>`).join('');

    const total = items.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    return `
      <div class="baccarat-section section-card">
        <h3>Employee Costs</h3>
        <div class="table-wrap">
          <table class="baccarat-table">
            <thead><tr><th>Name</th><th class="col-amount">Amount</th><th class="col-action"></th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><td><strong>Total</strong></td><td class="col-amount"><strong>${Utils.money(total)}</strong></td><td></td></tr></tfoot>
          </table>
        </div>
        <button type="button" class="btn btn-sm btn-cyan add-item-btn" onclick="Baccarat.addEmployee()">+ Add Employee Cost</button>
      </div>`;
  },

  addEmployee() {
    const monthData = this._getMonthData(this._currentMonth);
    const updated = {
      ...monthData,
      employees: [...monthData.employees, { name: '', amount: 0, id: Utils.uid() }]
    };
    this._saveMonthData(this._currentMonth, updated);
    this.render();
  },

  // --- Shared Item Operations ---

  _updateItem(type, index, field, value) {
    const monthData = this._getMonthData(this._currentMonth);
    const list = [...monthData[type]];
    if (index < 0 || index >= list.length) return;

    const sanitizedValue = field === 'amount' ? (Number(value) || 0) : String(value);
    list[index] = { ...list[index], [field]: sanitizedValue };

    const updated = { ...monthData, [type]: list };
    this._saveMonthData(this._currentMonth, updated);

    // Re-render profit summary without full re-render for amount changes
    if (field === 'amount') {
      this._refreshProfitSummary();
    }
  },

  removeItem(type, index) {
    const monthData = this._getMonthData(this._currentMonth);
    const list = monthData[type].filter((_, i) => i !== index);
    const updated = { ...monthData, [type]: list };
    this._saveMonthData(this._currentMonth, updated);
    this.render();
  },

  _refreshProfitSummary() {
    const summaryEl = document.getElementById('baccarat-profit-summary');
    if (!summaryEl) return;
    const monthData = this._getMonthData(this._currentMonth);
    const calc = this._calculate(monthData);
    summaryEl.outerHTML = this._buildProfitSummary(calc);
  },

  // --- Profit Summary Card ---

  _buildProfitSummary(calc) {
    const profitClass = calc.netProfit >= 0 ? 'profit-positive' : 'profit-negative';

    return `
      <div class="profit-summary" id="baccarat-profit-summary">
        <h3>Profit Summary</h3>
        <div class="profit-breakdown">
          <div class="profit-row">
            <span>Total Income</span>
            <span class="profit-value">${Utils.money(calc.totalIncome)}</span>
          </div>
          <div class="profit-row profit-deduct">
            <span>Less Expenses</span>
            <span class="profit-value">-${Utils.money(calc.totalExpenses)}</span>
          </div>
          <div class="profit-row profit-deduct">
            <span>Less Employees</span>
            <span class="profit-value">-${Utils.money(calc.totalEmployees)}</span>
          </div>
          <div class="profit-divider"></div>
          <div class="profit-row profit-total ${profitClass}">
            <span>Net Profit</span>
            <span class="profit-value">${Utils.money(calc.netProfit)}</span>
          </div>
          <div class="profit-divider"></div>
          <div class="share-row">
            <span class="share-name">Bryan's Share (1/3)</span>
            <span class="share-value">${Utils.money(calc.bryanShare)}</span>
          </div>
          <div class="share-row">
            <span class="share-name">Andre's Share (1/3)</span>
            <span class="share-value">${Utils.money(calc.andreShare)}</span>
          </div>
          <div class="share-row">
            <span class="share-name">Carlo's Share (1/3)</span>
            <span class="share-value">${Utils.money(calc.carloShare)}</span>
          </div>
        </div>
      </div>`;
  },

  // --- Monthly History ---

  _buildHistory() {
    const all = this._getAllData();
    const months = all.months || {};
    const keys = Object.keys(months).sort().reverse();

    if (keys.length === 0) {
      return `
        <div class="baccarat-section section-card">
          <h3>Monthly History</h3>
          <p class="empty-state">No history yet. Add income and expenses to get started.</p>
        </div>`;
    }

    const rows = keys.map(key => {
      const data = this._getMonthData(key);
      const calc = this._calculate(data);
      const [y, m] = key.split('-');
      const label = new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      return `
        <tr class="${key === this._currentMonth ? 'history-current' : ''}">
          <td>${Utils.esc(label)}</td>
          <td class="col-amount">${Utils.money(calc.totalIncome)}</td>
          <td class="col-amount">${Utils.money(calc.netProfit)}</td>
          <td class="col-amount">${Utils.money(calc.bryanShare)}</td>
          <td class="col-amount">${Utils.money(calc.andreShare)}</td>
          <td class="col-amount">${Utils.money(calc.carloShare)}</td>
        </tr>`;
    }).join('');

    return `
      <div class="baccarat-section section-card">
        <h3>Monthly History</h3>
        <div class="table-wrap">
          <table class="baccarat-table baccarat-history">
            <thead>
              <tr>
                <th>Month</th>
                <th class="col-amount">Income</th>
                <th class="col-amount">Profit</th>
                <th class="col-amount">Bryan</th>
                <th class="col-amount">Andre</th>
                <th class="col-amount">Carlo</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }
};
