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
  getActiveBills() { return this.getBills().filter(b => b.archived !== true); },
  getArchivedBills() { return this.getBills().filter(b => b.archived === true); },
  archiveBill(id) {
    const bills = this.getBills().map(b => b.id === id ? { ...b, archived: true } : b);
    this.saveBills(bills);
  },
  unarchiveBill(id) {
    const bills = this.getBills().map(b => b.id === id ? { ...b, archived: false } : b);
    this.saveBills(bills);
  },
  saveBills(bills) {
    this._set('bills', bills);
    if (typeof CloudSync !== 'undefined' && CloudSync.isEnabled) {
      CloudSync.pushToCloud('bills', bills);
    }

  },
  addBill(bill) {
    const bills = this.getBills();
    const newBill = {
      ...bill,
      id: bill.id || Utils.uid(),
      createdAt: bill.createdAt || new Date().toISOString()
    };
    bills.push(newBill);
    this.saveBills(bills);
    return newBill;
  },
  updateBill(id, updates) {
    const bills = this.getBills().map(b => {
      if (b.id !== id) return b;
      const updated = { ...b, ...updates };
      // Auto-archive when marked as paid
      if (updates.status === 'paid') {
        return { ...updated, archived: true };
      }
      return updated;
    });
    this.saveBills(bills);
  },
  deleteBill(id) {
    this.saveBills(this.getBills().filter(b => b.id !== id));
  },

  // --- Income ---
  getIncomes() { return this._get('incomes') || []; },
  saveIncomes(incomes) {
    this._set('incomes', incomes);
    if (typeof CloudSync !== 'undefined' && CloudSync.isEnabled) {
      CloudSync.pushToCloud('incomes', incomes);
    }

  },
  addIncome(income) {
    const incomes = this.getIncomes();
    const newIncome = {
      ...income,
      id: income.id || Utils.uid(),
      createdAt: income.createdAt || new Date().toISOString()
    };
    incomes.push(newIncome);
    this.saveIncomes(incomes);
    return newIncome;
  },
  updateIncome(id, updates) {
    const incomes = this.getIncomes().map(i => i.id === id ? { ...i, ...updates } : i);
    this.saveIncomes(incomes);
  },
  deleteIncome(id) {
    this.saveIncomes(this.getIncomes().filter(i => i.id !== id));
  },

  // --- Expenses (daily/adhoc spending) ---
  getExpenses() { return this._get('expenses') || []; },
  saveExpenses(expenses) {
    this._set('expenses', expenses);
    if (typeof CloudSync !== 'undefined' && CloudSync.isEnabled) {
      CloudSync.pushToCloud('expenses', expenses);
    }

  },
  addExpense(expense) {
    const expenses = this.getExpenses();
    const newExpense = {
      ...expense,
      id: expense.id || Utils.uid(),
      createdAt: expense.createdAt || new Date().toISOString()
    };
    expenses.unshift(newExpense); // Most recent first
    this.saveExpenses(expenses);

    // Deduct from bank account if specified
    if (newExpense.bankId) {
      const bank = this.getBanks().find(b => b.id === newExpense.bankId);
      if (bank) {
        this.updateBank(newExpense.bankId, bank.balance - newExpense.amount);
        this.addBankTxn({
          type: 'expense',
          bankId: newExpense.bankId,
          amount: -newExpense.amount,
          description: newExpense.name,
          category: newExpense.category
        });
      }
    }

    return newExpense;
  },
  updateExpense(id, updates) {
    const expenses = this.getExpenses().map(e => e.id === id ? { ...e, ...updates } : e);
    this.saveExpenses(expenses);
  },
  deleteExpense(id) {
    this.saveExpenses(this.getExpenses().filter(e => e.id !== id));
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
  saveBanks(banks) {
    this._set('banks', banks);
    if (typeof CloudSync !== 'undefined' && CloudSync.isEnabled) {
      CloudSync.pushToCloud('banks', banks);
    }

  },
  updateBank(id, balance) {
    const banks = this.getBanks().map(b => b.id === id ? { ...b, balance: Number(balance) } : b);
    this.saveBanks(banks);
  },

  // --- Bank Transactions ---
  getBankTxns() { return this._get('bank_txns') || []; },
  addBankTxn(txn) {
    const txns = this.getBankTxns();
    const newTxn = {
      ...txn,
      id: Utils.uid(),
      date: txn.date || new Date().toISOString()
    };
    txns.unshift(newTxn);
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
  saveTeam(team) {
    this._set('team', team);
    if (typeof CloudSync !== 'undefined' && CloudSync.isEnabled) {
      CloudSync.pushToCloud('team', team);
    }
  },
  updateTeamMember(id, updates) {
    const team = this.getTeam().map(m => m.id === id ? { ...m, ...updates } : m);
    this.saveTeam(team);
  },
  addTeamMember(member) {
    const team = this.getTeam();
    const newMember = {
      ...member,
      id: member.id || Utils.uid(),
      paid: false
    };
    team.push(newMember);
    this.saveTeam(team);
    return newMember;
  },
  deleteTeamMember(id) {
    this.saveTeam(this.getTeam().filter(m => m.id !== id));
  },

  // --- Invoices ---
  getInvoices() { return this._get('invoices') || []; },
  saveInvoices(inv) {
    this._set('invoices', inv);
    if (typeof CloudSync !== 'undefined' && CloudSync.isEnabled) {
      CloudSync.pushToCloud('invoices', inv);
    }
  },
  addInvoice(inv) {
    const invoices = this.getInvoices();
    const newInv = {
      ...inv,
      id: inv.id || Utils.uid(),
      number: inv.number || 'INV-' + String(invoices.length + 1).padStart(3, '0'),
      createdAt: new Date().toISOString()
    };
    invoices.push(newInv);
    this.saveInvoices(invoices);
    return newInv;
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

  // --- Baccarat Profit Share ---
  getBaccarat() { return this._get('baccarat') || { months: {} }; },
  saveBaccarat(data) {
    this._set('baccarat', data);
    if (typeof CloudSync !== 'undefined' && CloudSync.isEnabled) {
      CloudSync.pushToCloud('baccarat', data);
    }
  },

  // --- Chat History ---
  getChatHistory() { return this._get('chat_history') || []; },
  saveChatHistory(messages) { this._set('chat_history', messages); },

  // --- Export All ---
  exportAll() {
    return {
      bills: this.getBills(),
      incomes: this.getIncomes(),
      expenses: this.getExpenses(),
      banks: this.getBanks(),
      bankTxns: this.getBankTxns(),
      team: this.getTeam(),
      invoices: this.getInvoices(),
      monthlyHistory: this.getMonthlyHistory(),
      baccarat: this.getBaccarat(),
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
    if (data.expenses) this.saveExpenses(data.expenses);
    if (data.banks) this.saveBanks(data.banks);
    if (data.bankTxns) this._set('bank_txns', data.bankTxns);
    if (data.team) this.saveTeam(data.team);
    if (data.invoices) this.saveInvoices(data.invoices);
    if (data.monthlyHistory) this._set('monthly_history', data.monthlyHistory);
    if (data.baccarat) this.saveBaccarat(data.baccarat);
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
        return { ...b, status: 'paid', archived: true };
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
      { name: 'Prince', amount: 27350, schedule: 'bi-monthly', nextDate: `${y}-${String(m+1).padStart(2,'0')}-15`, note: '15th & 30th', status: 'expected' },
      { name: 'Thom', amount: 10000, schedule: 'monthly', nextDate: `${y}-${String(m+1).padStart(2,'0')}-30`, note: '30th of month', status: 'expected' },
      { name: 'Property Bots', amount: 27500, schedule: 'monthly', nextDate: `${y}-${String(m+1).padStart(2,'0')}-05`, note: '5th of month', status: 'expected' },
      { name: 'Juan', amount: 5800, schedule: 'weekly', nextDate: null, note: 'Every Friday', status: 'expected' },
      { name: 'Disruptor', amount: 36250, schedule: 'bi-monthly', nextDate: `${y}-${String(m+1).padStart(2,'0')}-10`, note: '10th & 24th', status: 'expected' },
      { name: 'Joshua', amount: 18125, schedule: 'weekly', nextDate: null, note: 'Every Friday', status: 'expected' }
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
