// ===== BANK BALANCES =====
const Banks = {
  render() {
    const banks = Storage.getBanks();
    const total = banks.reduce((s, b) => s + (Number(b.balance) || 0), 0);

    document.getElementById('banks-total').textContent = `Total: ${Utils.money(total)}`;

    const container = document.getElementById('bank-cards');
    container.innerHTML = banks.map(b => {
      const balance = Number(b.balance) || 0;
      return `
        <div class="bank-card">
          <div class="bank-name">${Utils.esc(b.name)}</div>
          <div class="bank-balance">${Utils.money(balance)}</div>
          <div class="input-group">
            <input type="number" id="bank-input-${b.id}" value="${balance}" placeholder="0" style="font-size:0.85rem">
            <button class="btn btn-sm btn-yellow" onclick="Banks.update('${b.id}')">Set</button>
          </div>
        </div>`;
    }).join('');

    this._renderTransactions();
  },

  update(id) {
    const input = document.getElementById(`bank-input-${id}`);
    const newBal = Number(input.value) || 0;
    const bank = Storage.getBanks().find(b => b.id === id);
    const oldBal = bank ? bank.balance : 0;

    Storage.updateBank(id, newBal);

    // Log the transaction
    const diff = newBal - oldBal;
    if (diff !== 0) {
      Storage.addBankTxn({
        bankId: id,
        bankName: bank.name,
        amount: diff,
        type: diff > 0 ? 'in' : 'out',
        description: diff > 0 ? 'Balance increased' : 'Balance decreased'
      });
    }

    this.render();
    Dashboard.render();
  },

  _renderTransactions() {
    const txns = Storage.getBankTxns().slice(0, 20);
    const container = document.getElementById('bank-transactions');

    if (txns.length === 0) {
      container.innerHTML = '<p class="empty-state">No transactions yet. Update a bank balance to see history.</p>';
      return;
    }

    container.innerHTML = txns.map(t => {
      const isPositive = t.amount > 0;
      return `
        <div class="txn-item">
          <span class="txn-desc">${Utils.esc(t.bankName)} — ${Utils.esc(t.description)}</span>
          <span class="txn-amount ${isPositive ? 'positive' : 'negative'}">${isPositive ? '+' : ''}${Utils.money(Math.abs(t.amount))}</span>
          <span class="txn-date">${Utils.dateFull(t.date)}</span>
        </div>`;
    }).join('');
  }
};
