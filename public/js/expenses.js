// ===== EXPENSES =====
const Expenses = {
  quickAdd(event) {
    event.preventDefault();

    const name = document.getElementById('quick-expense-name').value.trim();
    const amount = parseFloat(document.getElementById('quick-expense-amount').value);
    const category = document.getElementById('quick-expense-category').value;
    const bankId = document.getElementById('quick-expense-bank').value;

    if (!name || !amount || !category || !bankId) {
      Toast.show('Please fill all fields', 'error');
      return;
    }

    if (amount <= 0) {
      Toast.show('Amount must be greater than 0', 'error');
      return;
    }

    const expense = {
      name,
      amount,
      category,
      bankId,
      date: new Date().toISOString().split('T')[0], // Today
      note: ''
    };

    Storage.addExpense(expense);

    // Clear form
    event.target.reset();

    // Show success feedback
    const btn = event.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = '✓ Tracked';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 1500);

    Toast.show(`Tracked: ${name} - ₱${amount.toLocaleString()}`, 'success');

    // Refresh views
    Dashboard.render();
    Banks.render();
    this.render();
  },

  render() {
    const container = document.getElementById('recent-expenses-list');
    if (!container) return;

    const expenses = Storage.getExpenses();
    const currentMonth = Utils.currentMonthKey();
    const recentExpenses = expenses
      .filter(e => e.date && e.date.startsWith(currentMonth))
      .slice(0, 10);

    if (recentExpenses.length === 0) {
      container.innerHTML = '<p class="empty-state">No expenses tracked this month</p>';
      return;
    }

    const categoryIcons = {
      food: '🍔',
      transport: '🚗',
      tools: '🛠️',
      personal: '👤',
      other: '📦'
    };

    container.innerHTML = recentExpenses.map(e => {
      const icon = categoryIcons[e.category] || '📦';
      const bank = Storage.getBanks().find(b => b.id === e.bankId);
      const bankName = bank ? bank.name : '';
      return `
        <div class="expense-item">
          <div class="expense-icon">${icon}</div>
          <div class="expense-info">
            <span class="expense-name">${Utils.esc(e.name)}</span>
            <span class="expense-meta">${Utils.dateStr(e.date)}${bankName ? ' · ' + Utils.esc(bankName) : ''}</span>
          </div>
          <div class="expense-amount">-${Utils.money(e.amount)}</div>
          <button class="btn btn-sm btn-red expense-delete" onclick="Expenses.remove('${e.id}')" title="Delete">×</button>
        </div>`;
    }).join('');
  },

  remove(id) {
    if (confirm('Delete this expense?')) {
      Storage.deleteExpense(id);
      this.render();
      Dashboard.render();
      Toast.show('Expense deleted', 'success');
    }
  },

  populateBankSelector() {
    const select = document.getElementById('quick-expense-bank');
    if (!select) return;

    const banks = Storage.getBanks().filter(b => b.balance > 0);
    select.innerHTML = '<option value="">Paid from</option>' +
      banks.map(b => `<option value="${b.id}">${b.name} (₱${b.balance.toLocaleString()})</option>`).join('');
  },

  getTotalSpentThisMonth() {
    const expenses = Storage.getExpenses();
    const bills = Storage.getBills();
    const currentMonth = Utils.currentMonthKey();

    const expensesThisMonth = expenses
      .filter(e => e.date && e.date.startsWith(currentMonth))
      .reduce((s, e) => s + e.amount, 0);

    const billsPaidThisMonth = bills
      .filter(b => b.status === 'paid' && b.dueDate && b.dueDate.startsWith(currentMonth))
      .reduce((s, b) => s + b.amount, 0);

    return {
      total: expensesThisMonth + billsPaidThisMonth,
      expenses: expensesThisMonth,
      bills: billsPaidThisMonth
    };
  }
};
