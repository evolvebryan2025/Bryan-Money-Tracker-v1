// ===== BILLS & SALARY =====
const Bills = {
  _selected: new Set(),

  render() {
    const bills = Storage.getBills();
    const filterStatus = document.getElementById('bills-filter-status').value;
    const filterCategory = document.getElementById('bills-filter-category').value;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filtered = bills.map(b => {
      // Auto-detect overdue
      if (b.status !== 'paid' && b.dueDate) {
        const d = new Date(b.dueDate);
        if (d < today) b.status = 'overdue';
      }
      return b;
    });

    if (filterStatus !== 'all') {
      filtered = filtered.filter(b => b.status === filterStatus);
    }
    if (filterCategory !== 'all') {
      filtered = filtered.filter(b => b.category === filterCategory);
    }

    // Sort by due date
    filtered.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });

    // Clean up selection — remove IDs no longer in filtered view
    const filteredIds = new Set(filtered.map(b => b.id));
    for (const id of this._selected) {
      if (!filteredIds.has(id)) this._selected.delete(id);
    }

    const tbody = document.getElementById('bills-tbody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No bills found</td></tr>';
    } else {
      tbody.innerHTML = filtered.map(b => {
        const days = b.dueDate ? Utils.daysUntil(b.dueDate) : null;
        const rowClass = b.status === 'paid' ? 'row-paid' :
          b.status === 'overdue' ? 'row-overdue' :
          (days !== null && days === 0) ? 'row-due-today' : '';
        const badgeClass = b.status === 'paid' ? 'badge-paid' :
          b.status === 'overdue' ? 'badge-overdue' : 'badge-unpaid';
        const checked = this._selected.has(b.id) ? 'checked' : '';

        return `
          <tr class="${rowClass} ${checked ? 'row-selected' : ''}">
            <td class="col-check"><input type="checkbox" ${checked} onchange="Bills.toggleOne('${b.id}', this.checked)" title="Select bill"></td>
            <td><strong>${Utils.esc(b.name)}</strong></td>
            <td>${Utils.esc(b.category || '--')}</td>
            <td class="col-amount">${b.amount ? Utils.money(b.amount) : '--'}</td>
            <td>${b.dueDate ? Utils.dateStr(b.dueDate) : '--'}</td>
            <td><span class="badge ${badgeClass}">${b.status}</span></td>
            <td>
              ${b.status !== 'paid' ? `<button class="btn btn-sm btn-green" onclick="Bills.markPaid('${b.id}')">Pay</button>` : ''}
              <button class="btn btn-sm" onclick="Bills.edit('${b.id}')">Edit</button>
              <button class="btn btn-sm btn-red" onclick="Bills.remove('${b.id}')">Del</button>
            </td>
          </tr>`;
      }).join('');
    }

    // Update select-all checkbox state
    const selectAll = document.getElementById('bills-select-all');
    if (selectAll) {
      selectAll.checked = filtered.length > 0 && this._selected.size === filtered.length;
    }

    // Update bulk bar
    this._updateBulkBar();

    // Summary
    const totalAll = bills.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const totalUnpaid = bills.filter(b => b.status !== 'paid').reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const totalPaid = bills.filter(b => b.status === 'paid').reduce((s, b) => s + (Number(b.amount) || 0), 0);
    document.getElementById('bills-summary').innerHTML =
      `<span>Total: <strong>${Utils.money(totalAll)}</strong></span>` +
      `<span>Unpaid: <strong style="color:var(--red)">${Utils.money(totalUnpaid)}</strong></span>` +
      `<span>Paid: <strong style="color:var(--green)">${Utils.money(totalPaid)}</strong></span>`;
  },

  // --- Selection ---
  toggleOne(id, checked) {
    if (checked) {
      this._selected.add(id);
    } else {
      this._selected.delete(id);
    }
    this.render();
  },

  toggleAll(checked) {
    const bills = this._getFilteredBills();
    if (checked) {
      bills.forEach(b => this._selected.add(b.id));
    } else {
      this._selected.clear();
    }
    this.render();
  },

  clearSelection() {
    this._selected.clear();
    this.render();
  },

  _updateBulkBar() {
    const bar = document.getElementById('bills-bulk-bar');
    const count = document.getElementById('bills-bulk-count');
    if (!bar) return;

    if (this._selected.size > 0) {
      bar.classList.add('visible');
      count.textContent = `${this._selected.size} selected`;
    } else {
      bar.classList.remove('visible');
    }
  },

  _getFilteredBills() {
    const bills = Storage.getBills();
    const filterStatus = document.getElementById('bills-filter-status').value;
    const filterCategory = document.getElementById('bills-filter-category').value;
    let filtered = bills;
    if (filterStatus !== 'all') filtered = filtered.filter(b => b.status === filterStatus);
    if (filterCategory !== 'all') filtered = filtered.filter(b => b.category === filterCategory);
    return filtered;
  },

  // --- Bulk actions ---
  bulkDelete() {
    const count = this._selected.size;
    if (count === 0) return;
    if (!confirm(`Delete ${count} selected bill${count > 1 ? 's' : ''}?`)) return;

    const bills = Storage.getBills().filter(b => !this._selected.has(b.id));
    Storage.saveBills(bills);
    this._selected.clear();
    Storage.saveMonthlySnapshot();
    this.render();
    Dashboard.render();
  },

  bulkMarkPaid() {
    const count = this._selected.size;
    if (count === 0) return;

    const bills = Storage.getBills().map(b => {
      if (this._selected.has(b.id)) return { ...b, status: 'paid' };
      return b;
    });
    Storage.saveBills(bills);
    this._selected.clear();
    Storage.saveMonthlySnapshot();
    this.render();
    Dashboard.render();
  },

  // --- Single actions ---
  markPaid(id) {
    Storage.updateBill(id, { status: 'paid' });
    Storage.saveMonthlySnapshot();
    this.render();
    Dashboard.render();
  },

  edit(id) {
    const bill = Storage.getBills().find(b => b.id === id);
    if (!bill) return;
    App.showModal('add-bill', bill);
  },

  remove(id) {
    if (confirm('Delete this bill?')) {
      Storage.deleteBill(id);
      this._selected.delete(id);
      Storage.saveMonthlySnapshot();
      this.render();
      Dashboard.render();
    }
  },

  // Modal form
  getFormHtml(existing) {
    const b = existing || {};
    return `
      <div class="form-grid">
        <div class="form-field">
          <label>Name</label>
          <input type="text" id="bill-name" value="${Utils.esc(b.name || '')}" placeholder="e.g., Samsung (2,666)">
        </div>
        <div class="form-field">
          <label>Amount (₱)</label>
          <input type="number" id="bill-amount" value="${b.amount || ''}" placeholder="0">
        </div>
        <div class="form-field">
          <label>Due Date</label>
          <input type="date" id="bill-due" value="${b.dueDate || ''}">
        </div>
        <div class="form-field">
          <label>Category</label>
          <select id="bill-category">
            <option value="installment" ${b.category === 'installment' ? 'selected' : ''}>Installment</option>
            <option value="utility" ${b.category === 'utility' ? 'selected' : ''}>Utility</option>
            <option value="salary" ${b.category === 'salary' ? 'selected' : ''}>Team Salary</option>
            <option value="loan" ${b.category === 'loan' ? 'selected' : ''}>Loan/Vehicle</option>
            <option value="personal" ${b.category === 'personal' ? 'selected' : ''}>Personal</option>
            <option value="other" ${b.category === 'other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
        <div class="form-field">
          <label><input type="checkbox" id="bill-recurring" ${b.recurring ? 'checked' : ''}> Recurring monthly</label>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-cyan" onclick="Bills.save('${b.id || ''}')">${b.id ? 'Update' : 'Add Bill'}</button>
      </div>`;
  },

  save(existingId) {
    const name = document.getElementById('bill-name').value.trim();
    const amount = Number(document.getElementById('bill-amount').value) || 0;
    const dueDate = document.getElementById('bill-due').value || null;
    const category = document.getElementById('bill-category').value;
    const recurring = document.getElementById('bill-recurring').checked;

    if (!name) { alert('Name is required'); return; }

    if (existingId) {
      Storage.updateBill(existingId, { name, amount, dueDate, category, recurring });
    } else {
      Storage.addBill({ name, amount, dueDate, category, recurring, status: 'unpaid' });
    }

    Storage.saveMonthlySnapshot();
    App.closeModal();
    this.render();
    Dashboard.render();
  }
};
