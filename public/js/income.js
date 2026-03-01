// ===== INCOME TRACKER =====
const Income = {
  render() {
    const incomes = Storage.getIncomes();
    const filterStatus = document.getElementById('income-filter-status').value;

    let filtered = [...incomes];
    if (filterStatus !== 'all') {
      filtered = filtered.filter(i => i.status === filterStatus);
    }

    // Sort by next date
    filtered.sort((a, b) => {
      if (!a.nextDate) return 1;
      if (!b.nextDate) return -1;
      return new Date(a.nextDate) - new Date(b.nextDate);
    });

    const tbody = document.getElementById('income-tbody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No income entries</td></tr>';
    } else {
      tbody.innerHTML = filtered.map(i => {
        const badgeClass = i.status === 'received' ? 'badge-received' :
          i.status === 'overdue' ? 'badge-overdue' : 'badge-expected';

        return `
          <tr>
            <td data-label="Source"><strong>${Utils.esc(i.name)}</strong></td>
            <td class="col-amount" data-label="Amount">${i.amount ? Utils.money(i.amount) : '--'}</td>
            <td data-label="Schedule">${Utils.esc(i.schedule || '--')}</td>
            <td data-label="Next Date">${i.nextDate ? Utils.dateStr(i.nextDate) : '--'} ${i.note ? '<br><small style="color:var(--text-muted)">' + Utils.esc(i.note) + '</small>' : ''}</td>
            <td data-label="Status"><span class="badge ${badgeClass}">${i.status}</span></td>
            <td class="col-actions" data-label="">
              ${i.status !== 'received' ? `<button class="btn btn-sm btn-green" onclick="Income.markReceived('${i.id}')">Received</button>` : ''}
              <button class="btn btn-sm" onclick="Income.edit('${i.id}')">Edit</button>
              <button class="btn btn-sm btn-red" onclick="Income.remove('${i.id}')">Del</button>
            </td>
          </tr>`;
      }).join('');
    }

    // Summary
    const totalExpected = incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const totalReceived = incomes.filter(i => i.status === 'received').reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const totalPending = incomes.filter(i => i.status !== 'received').reduce((s, i) => s + (Number(i.amount) || 0), 0);
    document.getElementById('income-summary').innerHTML =
      `<span>Total Expected: <strong>${Utils.money(totalExpected)}</strong></span>` +
      `<span>Received: <strong style="color:var(--green)">${Utils.money(totalReceived)}</strong></span>` +
      `<span>Pending: <strong style="color:var(--cyan)">${Utils.money(totalPending)}</strong></span>`;
  },

  markReceived(id) {
    Storage.updateIncome(id, { status: 'received' });
    Storage.saveMonthlySnapshot();
    this.render();
    Dashboard.render();
  },

  edit(id) {
    const income = Storage.getIncomes().find(i => i.id === id);
    if (!income) return;
    App.showModal('add-income', income);
  },

  remove(id) {
    if (confirm('Delete this income entry?')) {
      Storage.deleteIncome(id);
      Storage.saveMonthlySnapshot();
      this.render();
      Dashboard.render();
    }
  },

  getFormHtml(existing) {
    const i = existing || {};
    return `
      <div class="form-grid">
        <div class="form-field">
          <label>Client Name</label>
          <input type="text" id="income-name" value="${Utils.esc(i.name || '')}" placeholder="e.g., Prince">
        </div>
        <div class="form-field">
          <label>Amount (₱)</label>
          <input type="number" id="income-amount" value="${i.amount || ''}" placeholder="0">
        </div>
        <div class="form-field">
          <label>Schedule</label>
          <select id="income-schedule">
            <option value="weekly" ${i.schedule === 'weekly' ? 'selected' : ''}>Weekly</option>
            <option value="bi-weekly" ${i.schedule === 'bi-weekly' ? 'selected' : ''}>Bi-weekly</option>
            <option value="monthly" ${i.schedule === 'monthly' ? 'selected' : ''}>Monthly</option>
            <option value="bi-monthly" ${i.schedule === 'bi-monthly' ? 'selected' : ''}>Bi-monthly</option>
            <option value="one-time" ${i.schedule === 'one-time' ? 'selected' : ''}>One-time</option>
          </select>
        </div>
        <div class="form-field">
          <label>Next Payment Date</label>
          <input type="date" id="income-next" value="${i.nextDate || ''}">
        </div>
        <div class="form-field">
          <label>Note</label>
          <input type="text" id="income-note" value="${Utils.esc(i.note || '')}" placeholder="e.g., 15th & 30th">
        </div>
      </div>
      <div class="form-actions">
        <button class="btn" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-cyan" onclick="Income.save('${i.id || ''}')">${i.id ? 'Update' : 'Add Income'}</button>
      </div>`;
  },

  save(existingId) {
    const name = document.getElementById('income-name').value.trim();
    const amount = Number(document.getElementById('income-amount').value) || 0;
    const schedule = document.getElementById('income-schedule').value;
    const nextDate = document.getElementById('income-next').value || null;
    const note = document.getElementById('income-note').value.trim();

    if (!name) { Toast.show('Client name is required', 'error'); return; }
    if (amount <= 0 && !existingId) { Toast.show('Amount must be greater than 0', 'error'); return; }

    if (existingId) {
      Storage.updateIncome(existingId, { name, amount, schedule, nextDate, note });
      Toast.show('Income updated', 'success');
    } else {
      Storage.addIncome({ name, amount, schedule, nextDate, note, status: 'expected' });
      Toast.show(`Income added: ${name}`, 'success');
    }

    Storage.saveMonthlySnapshot();
    App.closeModal();
    this.render();
    Dashboard.render();
  }
};
