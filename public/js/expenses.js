// ===== EXPENSES =====
const Expenses = {
  quickAdd(event) {
    event.preventDefault();

    const name = document.getElementById('quick-expense-name').value.trim();
    const amount = parseFloat(document.getElementById('quick-expense-amount').value);
    const category = document.getElementById('quick-expense-category').value;
    const bankId = document.getElementById('quick-expense-bank').value;

    if (!name || !amount || !category || !bankId) {
      alert('Please fill all fields');
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

    // Refresh views
    Dashboard.render();
    Banks.render();
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
