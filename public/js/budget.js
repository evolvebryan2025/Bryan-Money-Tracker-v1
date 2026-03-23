// ===== BUDGET ENGINE =====
const Budget = {
  calculate() {
    const activeBills = Storage.getActiveBills();
    const allBills = Storage.getBills();
    const incomes = Storage.getIncomes();
    const banks = Storage.getBanks();
    const expenses = Storage.getExpenses ? Storage.getExpenses() : [];

    const totalBills = activeBills.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const totalIncome = incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const totalCash = banks.reduce((s, b) => s + (Number(b.balance) || 0), 0);

    // Calculate expenses this month
    const currentMonth = Utils.currentMonthKey();
    const monthExpenses = expenses
      .filter(e => e.date && e.date.startsWith(currentMonth))
      .reduce((s, e) => s + e.amount, 0);

    const unpaidBills = activeBills.filter(b => b.status !== 'paid');
    const totalUnpaid = unpaidBills.reduce((s, b) => s + (Number(b.amount) || 0), 0);

    // Bills due in next 7 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);

    const upcomingBills = unpaidBills.filter(b => {
      if (!b.dueDate) return false;
      const d = new Date(b.dueDate);
      return d >= today && d <= in7Days;
    }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const upcomingTotal = upcomingBills.reduce((s, b) => s + (Number(b.amount) || 0), 0);

    // Overdue bills
    const overdueBills = unpaidBills.filter(b => {
      if (!b.dueDate) return false;
      return new Date(b.dueDate) < today;
    });
    const overdueTotal = overdueBills.reduce((s, b) => s + (Number(b.amount) || 0), 0);

    // Daily budget = (cash on hand - upcoming 7-day bills - overdue - expenses already spent) / max(daysLeft, 1)
    const daysLeft = Math.max(Utils.daysLeftInMonth(), 1);
    const safeToSpend = Math.max(totalCash - upcomingTotal - overdueTotal, 0);
    const dailyBudget = Math.floor(safeToSpend / daysLeft);

    // Next expected income
    const nextIncome = this._findNextIncome(incomes);

    // Spent includes archived (paid) bills for the current month
    const billsPaidThisMonth = allBills
      .filter(b => b.status === 'paid' && b.dueDate && b.dueDate.startsWith(currentMonth))
      .reduce((s, b) => s + b.amount, 0);

    return {
      totalBills,
      totalIncome,
      totalCash,
      totalUnpaid,
      upcomingBills,
      upcomingTotal,
      overdueBills,
      overdueTotal,
      daysLeft,
      dailyBudget,
      safeToSpend,
      nextIncome,
      monthExpenses,
      totalSpent: billsPaidThisMonth + monthExpenses,
      profit: totalIncome - totalBills,
      savingsRate: totalIncome > 0 ? ((totalIncome - totalBills) / totalIncome * 100).toFixed(1) : 0
    };
  },

  _findNextIncome(incomes) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = incomes
      .filter(i => i.nextDate && i.amount > 0 && i.status !== 'received')
      .map(i => ({ ...i, dateObj: new Date(i.nextDate) }))
      .filter(i => i.dateObj >= today)
      .sort((a, b) => a.dateObj - b.dateObj);

    if (upcoming.length > 0) {
      return `${upcoming[0].name}: ${Utils.money(upcoming[0].amount)} on ${Utils.dateStr(upcoming[0].nextDate)}`;
    }
    return 'No upcoming income scheduled';
  },

  // Get financial context for AI chat
  getFinancialContext() {
    const data = this.calculate();
    return {
      totalBills: data.totalBills,
      totalIncome: data.totalIncome,
      moneyOnHand: data.totalCash,
      daysLeft: data.daysLeft,
      dailyBudget: data.dailyBudget,
      upcomingBills: data.upcomingBills.map(b => `${b.name}: ${Utils.money(b.amount)} due ${Utils.dateStr(b.dueDate)}`).join(', ') || 'None',
      nextIncome: data.nextIncome,
      overdueBills: data.overdueBills.map(b => `${b.name}: ${Utils.money(b.amount)}`).join(', ') || 'None',
      profit: data.profit,
      savingsRate: data.savingsRate
    };
  }
};
