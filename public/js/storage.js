// ===== LOCAL STORAGE LAYER =====
const Storage = {
  _prefix: 'bf_',

  _get(key) {
    try {
      const raw = localStorage.getItem(this._prefix + key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  _set(key, value) {
    localStorage.setItem(this._prefix + key, JSON.stringify(value));
  },

  // --- Bills ---
  getBills() { return this._get('bills') || []; },
  saveBills(bills) { this._set('bills', bills); },
  addBill(bill) {
    const bills = this.getBills();
    bill.id = bill.id || Utils.uid();
    bill.createdAt = bill.createdAt || new Date().toISOString();
    bills.push(bill);
    this.saveBills(bills);
    return bill;
  },
  updateBill(id, updates) {
    const bills = this.getBills().map(b => b.id === id ? { ...b, ...updates } : b);
    this.saveBills(bills);
  },
  deleteBill(id) {
    this.saveBills(this.getBills().filter(b => b.id !== id));
  },

  // --- Income ---
  getIncomes() { return this._get('incomes') || []; },
  saveIncomes(incomes) { this._set('incomes', incomes); },
  addIncome(income) {
    const incomes = this.getIncomes();
    income.id = income.id || Utils.uid();
    income.createdAt = income.createdAt || new Date().toISOString();
    incomes.push(income);
    this.saveIncomes(incomes);
    return income;
  },
  updateIncome(id, updates) {
    const incomes = this.getIncomes().map(i => i.id === id ? { ...i, ...updates } : i);
    this.saveIncomes(incomes);
  },
  deleteIncome(id) {
    this.saveIncomes(this.getIncomes().filter(i => i.id !== id));
  },

  // --- Banks ---
  getBanks() {
    return this._get('banks') || [
      { id: 'gcash', name: 'Gcash', balance: 0, currency: 'PHP' },
      { id: 'gotyme', name: 'Gotyme', balance: 0, currency: 'PHP' },
      { id: 'bpi', name: 'BPI', balance: 0, currency: 'PHP' },
      { id: 'wise', name: 'Wise', balance: 0, currency: 'PHP' },
      { id: 'payoneer', name: 'Payoneer', balance: 0, currency: 'PHP' },
      { id: 'paypal', name: 'Paypal', balance: 0, currency: 'PHP' },
      { id: 'paymaya', name: 'Paymaya', balance: 0, currency: 'PHP' },
      { id: 'cash', name: 'Cash', balance: 0, currency: 'PHP' }
    ];
  },
  saveBanks(banks) { this._set('banks', banks); },
  updateBank(id, balance) {
    const banks = this.getBanks().map(b => b.id === id ? { ...b, balance: Number(balance) } : b);
    this.saveBanks(banks);
  },

  // --- Bank Transactions ---
  getBankTxns() { return this._get('bank_txns') || []; },
  addBankTxn(txn) {
    const txns = this.getBankTxns();
    txn.id = Utils.uid();
    txn.date = txn.date || new Date().toISOString();
    txns.unshift(txn);
    if (txns.length > 100) txns.pop();
    this._set('bank_txns', txns);
  },

  // --- Team ---
  getTeam() {
    return this._get('team') || [
      { id: 'lee', name: 'Lee', role: 'Main Developer + Morning Coverage', salary: 25000, payDate: 28, paid: false },
      { id: 'melvin', name: 'Melvin', role: 'Developer', salary: 8000, payDate: 6, paid: false },
      { id: 'jameel', name: 'Jameel', role: 'Developer', salary: 4000, payDate: 15, paid: false },
      { id: 'john', name: 'John', role: 'GHL Specialist', salary: 0, payDate: null, paid: false },
      { id: 'adam', name: 'Adam', role: 'GHL Developer', salary: 0, payDate: null, paid: false }
    ];
  },
  saveTeam(team) { this._set('team', team); },
  updateTeamMember(id, updates) {
    const team = this.getTeam().map(m => m.id === id ? { ...m, ...updates } : m);
    this.saveTeam(team);
  },
  addTeamMember(member) {
    const team = this.getTeam();
    member.id = member.id || Utils.uid();
    member.paid = false;
    team.push(member);
    this.saveTeam(team);
    return member;
  },
  deleteTeamMember(id) {
    this.saveTeam(this.getTeam().filter(m => m.id !== id));
  },

  // --- Invoices ---
  getInvoices() { return this._get('invoices') || []; },
  saveInvoices(inv) { this._set('invoices', inv); },
  addInvoice(inv) {
    const invoices = this.getInvoices();
    inv.id = inv.id || Utils.uid();
    inv.number = inv.number || 'INV-' + String(invoices.length + 1).padStart(3, '0');
    inv.createdAt = new Date().toISOString();
    invoices.push(inv);
    this.saveInvoices(invoices);
    return inv;
  },
  updateInvoice(id, updates) {
    const invoices = this.getInvoices().map(i => i.id === id ? { ...i, ...updates } : i);
    this.saveInvoices(invoices);
  },
  deleteInvoice(id) {
    this.saveInvoices(this.getInvoices().filter(i => i.id !== id));
  },

  // --- Monthly History ---
  getMonthlyHistory() { return this._get('monthly_history') || []; },
  saveMonthlySnapshot() {
    const history = this.getMonthlyHistory();
    const key = Utils.currentMonthKey();
    const bills = this.getBills();
    const incomes = this.getIncomes();
    const totalBills = bills.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const totalIncome = incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);

    const existing = history.findIndex(h => h.month === key);
    const snapshot = { month: key, bills: totalBills, income: totalIncome, profit: totalIncome - totalBills };
    if (existing >= 0) {
      history[existing] = snapshot;
    } else {
      history.push(snapshot);
    }
    if (history.length > 12) history.shift();
    this._set('monthly_history', history);
  },

  // --- Settings ---
  getSetting(key) { return this._get('setting_' + key); },
  setSetting(key, value) { this._set('setting_' + key, value); },

  // --- Chat History ---
  getChatHistory() { return this._get('chat_history') || []; },
  saveChatHistory(messages) { this._set('chat_history', messages); },

  // --- Export All ---
  exportAll() {
    return {
      bills: this.getBills(),
      incomes: this.getIncomes(),
      banks: this.getBanks(),
      bankTxns: this.getBankTxns(),
      team: this.getTeam(),
      invoices: this.getInvoices(),
      monthlyHistory: this.getMonthlyHistory(),
      chatHistory: this.getChatHistory(),
      settings: {
        goal: this.getSetting('goal'),
        currency: this.getSetting('currency')
      },
      exportedAt: new Date().toISOString()
    };
  },

  importAll(data) {
    if (data.bills) this.saveBills(data.bills);
    if (data.incomes) this.saveIncomes(data.incomes);
    if (data.banks) this.saveBanks(data.banks);
    if (data.bankTxns) this._set('bank_txns', data.bankTxns);
    if (data.team) this.saveTeam(data.team);
    if (data.invoices) this.saveInvoices(data.invoices);
    if (data.monthlyHistory) this._set('monthly_history', data.monthlyHistory);
    if (data.chatHistory) this.saveChatHistory(data.chatHistory);
    if (data.settings) {
      if (data.settings.apiKey) this.setSetting('apiKey', data.settings.apiKey);
      if (data.settings.goal) this.setSetting('goal', data.settings.goal);
      if (data.settings.currency) this.setSetting('currency', data.settings.currency);
    }
  },

  resetAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(this._prefix))
      .forEach(k => localStorage.removeItem(k));
  },

  // --- Month Rollover ---
  // Creates new current-month entries for all recurring bills (idempotent)
  rolloverRecurringBills() {
    const bills = this.getBills();
    if (bills.length === 0) return false;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Names that already have a current-month entry
    const currentMonthNames = new Set(
      bills.filter(b => b.dueDate && b.dueDate.startsWith(currentMonth)).map(b => b.name)
    );

    // Collect unique recurring bills (use the latest version of each by name)
    const seen = new Set();
    const newBills = [];

    // Reverse so we pick the most recent entry for each name
    [...bills].reverse().forEach(b => {
      if (!b.recurring || !b.dueDate || seen.has(b.name)) return;
      seen.add(b.name);

      if (!currentMonthNames.has(b.name)) {
        const day = b.dueDate.substring(8, 10);
        newBills.push({
          name: b.name,
          amount: b.amount,
          dueDate: `${currentMonth}-${day}`,
          category: b.category,
          recurring: true,
          status: 'unpaid',
          id: Utils.uid(),
          createdAt: new Date().toISOString()
        });
      }
    });

    if (newBills.length > 0) {
      this.saveBills([...bills, ...newBills]);
      return true;
    }
    return false;
  },

  // Mark all previous-month unpaid bills as paid, with optional exceptions by name
  markPreviousMonthBillsPaid(exceptNames = []) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const exceptSet = new Set(exceptNames);

    let modified = false;
    const bills = this.getBills().map(b => {
      if (b.dueDate && b.dueDate.substring(0, 7) < currentMonth && b.status !== 'paid' && !exceptSet.has(b.name)) {
        modified = true;
        return { ...b, status: 'paid' };
      }
      return b;
    });

    if (modified) {
      this.saveBills(bills);
    }
    return modified;
  },

  // --- Seed initial data from Bryan's spreadsheet ---
  seedIfEmpty() {
    if (this.getBills().length > 0) return; // already has data

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-indexed

    const bills = [
      { name: 'Samsung (2,666)', amount: 2666, dueDate: `${y}-${String(m+1).padStart(2,'0')}-01`, category: 'installment', status: 'unpaid' },
      { name: 'Homecredit tecno (1111)', amount: 1111, dueDate: `${y}-${String(m+1).padStart(2,'0')}-01`, category: 'installment', status: 'unpaid' },
      { name: 'Billease (592)', amount: 592, dueDate: `${y}-${String(m+1).padStart(2,'0')}-02`, category: 'installment', status: 'unpaid' },
      { name: 'Electricity', amount: 2320, dueDate: `${y}-${String(m+1).padStart(2,'0')}-03`, category: 'utility', status: 'unpaid' },
      { name: 'ASA 1', amount: 3320, dueDate: `${y}-${String(m+1).padStart(2,'0')}-04`, category: 'installment', status: 'unpaid' },
      { name: 'Melvin Salary (10k less 2k)', amount: 8000, dueDate: `${y}-${String(m+1).padStart(2,'0')}-06`, category: 'salary', status: 'unpaid' },
      { name: 'Homecredit 2 (PC)', amount: 1129, dueDate: `${y}-${String(m+1).padStart(2,'0')}-09`, category: 'installment', status: 'unpaid' },
      { name: 'Wifi', amount: 1375, dueDate: `${y}-${String(m+1).padStart(2,'0')}-10`, category: 'utility', status: 'unpaid' },
      { name: 'ASA 2', amount: 3320, dueDate: `${y}-${String(m+1).padStart(2,'0')}-11`, category: 'installment', status: 'unpaid' },
      { name: 'Motor', amount: 3984, dueDate: `${y}-${String(m+1).padStart(2,'0')}-12`, category: 'loan', status: 'unpaid' },
      { name: 'Jameel 4k', amount: 4000, dueDate: `${y}-${String(m+1).padStart(2,'0')}-15`, category: 'salary', status: 'unpaid' },
      { name: 'Homecredit (IPAD)', amount: 2568, dueDate: `${y}-${String(m+1).padStart(2,'0')}-16`, category: 'installment', status: 'unpaid' },
      { name: 'ASA 3', amount: 3320, dueDate: `${y}-${String(m+1).padStart(2,'0')}-18`, category: 'installment', status: 'unpaid' },
      { name: 'Homecredit (CP momy)', amount: 579, dueDate: `${y}-${String(m+1).padStart(2,'0')}-19`, category: 'installment', status: 'unpaid' },
      { name: 'Atome 951', amount: 951, dueDate: `${y}-${String(m+1).padStart(2,'0')}-20`, category: 'installment', status: 'unpaid' },
      { name: 'ASA 4', amount: 3320, dueDate: `${y}-${String(m+1).padStart(2,'0')}-25`, category: 'installment', status: 'unpaid' },
      { name: 'Lee Salary', amount: 25000, dueDate: `${y}-${String(m+1).padStart(2,'0')}-28`, category: 'salary', status: 'unpaid' },
      { name: 'Billease Bryan', amount: 1862, dueDate: `${y}-${String(m+1).padStart(2,'0')}-30`, category: 'installment', status: 'unpaid' },
      { name: 'Spaylater', amount: 0, dueDate: null, category: 'installment', status: 'unpaid' },
      { name: 'John Salary', amount: 0, dueDate: null, category: 'salary', status: 'unpaid' },
      { name: 'Adam Salary', amount: 0, dueDate: null, category: 'salary', status: 'unpaid' }
    ];

    bills.forEach(b => {
      b.id = Utils.uid();
      b.recurring = true;
      b.createdAt = new Date().toISOString();
    });
    this.saveBills(bills);

    const incomes = [
      { name: 'Prince', amount: 55680, schedule: 'bi-monthly', nextDate: `${y}-${String(m+1).padStart(2,'0')}-15`, note: '15th & 30th', status: 'expected' },
      { name: 'Thom', amount: 0, schedule: 'monthly', nextDate: null, note: '', status: 'expected' },
      { name: 'Property Bots', amount: 27500, schedule: 'monthly', nextDate: `${y}-${String(m+1).padStart(2,'0')}-05`, note: '5th of month', status: 'expected' },
      { name: 'Juan', amount: 23200, schedule: 'weekly', nextDate: null, note: 'Weekly', status: 'expected' },
      { name: 'Disruptor', amount: 58000, schedule: 'bi-monthly', nextDate: `${y}-${String(m+1).padStart(2,'0')}-12`, note: '12th & 26th', status: 'expected' },
      { name: 'Andrej and Carlo', amount: 28246, schedule: 'monthly', nextDate: `${y}-${String(m+1).padStart(2,'0')}-05`, note: '5th of month', status: 'expected' },
      { name: 'Joshua', amount: 0, schedule: 'monthly', nextDate: null, note: '', status: 'expected' }
    ];

    incomes.forEach(i => {
      i.id = Utils.uid();
      i.createdAt = new Date().toISOString();
    });
    this.saveIncomes(incomes);

    // Save initial monthly snapshot
    this.saveMonthlySnapshot();

    // Set default goal
    if (!this.getSetting('goal')) {
      this.setSetting('goal', 1120000);
    }
  }
};
