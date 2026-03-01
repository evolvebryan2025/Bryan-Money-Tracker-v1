// ===== EXPORT / IMPORT =====
const Exports = {
  // Export all data as JSON
  exportAll() {
    const data = Storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this._download(blob, `bryan-finance-backup-${new Date().toISOString().split('T')[0]}.json`);
  },

  // Import data from JSON
  importData() {
    document.getElementById('import-file').click();
  },

  handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (confirm('This will merge imported data with your current data. Continue?')) {
          Storage.importAll(data);
          Toast.show('Data imported successfully!', 'success');
          App.refreshAll();
        }
      } catch {
        Toast.show('Invalid JSON file.', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  },

  // Sanitize CSV cell to prevent formula injection
  _csvSafe(val) {
    const str = String(val ?? '');
    if (/^[=+\-@\t\r]/.test(str)) return "'" + str;
    return str;
  },

  // Export bills as CSV
  exportBillsCSV() {
    const bills = Storage.getBills();
    const header = 'Name,Amount,Due Date,Category,Status\n';
    const rows = bills.map(b =>
      `"${this._csvSafe(b.name)}",${b.amount || 0},"${this._csvSafe(b.dueDate)}","${this._csvSafe(b.category)}","${this._csvSafe(b.status)}"`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    this._download(blob, `bills-${Utils.currentMonthKey()}.csv`);
  },

  // Export income as CSV
  exportIncomeCSV() {
    const incomes = Storage.getIncomes();
    const header = 'Client,Amount,Schedule,Next Date,Status,Note\n';
    const rows = incomes.map(i =>
      `"${this._csvSafe(i.name)}",${i.amount || 0},"${this._csvSafe(i.schedule)}","${this._csvSafe(i.nextDate)}","${this._csvSafe(i.status)}","${this._csvSafe(i.note)}"`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    this._download(blob, `income-${Utils.currentMonthKey()}.csv`);
  },

  // Monthly summary (text)
  exportSummary() {
    const data = Budget.calculate();
    const team = Storage.getTeam();
    const banks = Storage.getBanks();

    const lines = [
      `MONTHLY FINANCIAL SUMMARY — ${Utils.currentMonth()}`,
      '='.repeat(50),
      '',
      `Total Income (Expected): ${Utils.money(data.totalIncome)}`,
      `Total Bills/Expenses:    ${Utils.money(data.totalBills)}`,
      `Net Profit:              ${Utils.money(data.profit)}`,
      `Savings Rate:            ${data.savingsRate}%`,
      '',
      'MONEY ON HAND',
      '-'.repeat(30),
      ...banks.map(b => `  ${b.name}: ${b.currency === 'USD' ? '$' : '₱'}${(b.balance || 0).toLocaleString()}`),
      `  TOTAL: ${Utils.money(data.totalCash)}`,
      '',
      'TEAM COSTS',
      '-'.repeat(30),
      ...team.map(m => `  ${m.name} (${m.role}): ${m.salary ? Utils.money(m.salary) : 'TBD'} — ${m.paid ? 'PAID' : 'UNPAID'}`),
      '',
      'DAILY BUDGET',
      '-'.repeat(30),
      `  Safe to spend today: ${Utils.money(data.dailyBudget)}`,
      `  Days left in month:  ${data.daysLeft}`,
      `  Upcoming bills (7d): ${Utils.money(data.upcomingTotal)}`,
      `  Overdue bills:       ${Utils.money(data.overdueTotal)}`,
      '',
      `Generated: ${new Date().toLocaleString()}`
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    this._download(blob, `summary-${Utils.currentMonthKey()}.txt`);
  },

  _download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
