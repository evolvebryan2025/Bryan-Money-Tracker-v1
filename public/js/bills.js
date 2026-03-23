// ===== BILLS & SALARY =====
const Bills = {
  _selected: new Set(),
  _viewMode: 'active', // 'active' or 'archived'

  showActive() {
    this._viewMode = 'active';
    this._selected.clear();
    this.render();
  },

  showArchived() {
    this._viewMode = 'archived';
    this._selected.clear();
    this.render();
  },

  render() {
    const isArchived = this._viewMode === 'archived';
    const allBills = Storage.getBills();
    const activeBills = allBills.filter(b => b.archived !== true);
    const archivedBills = allBills.filter(b => b.archived === true);
    const bills = isArchived ? archivedBills : activeBills;

    const filterStatus = document.getElementById('bills-filter-status').value;
    const filterCategory = document.getElementById('bills-filter-category').value;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filtered = bills.map(b => {
      // Auto-detect overdue (only for active bills)
      if (!isArchived && b.status !== 'paid' && b.dueDate) {
        const d = new Date(b.dueDate);
        if (d < today) return { ...b, status: 'overdue' };
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

    // Update archive tab states and counts
    this._updateArchiveTabs(activeBills.length, archivedBills.length);

    const tbody = document.getElementById('bills-tbody');
    const emptyLabel = isArchived ? 'No archived bills' : 'No bills found';

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${emptyLabel}</td></tr>`;
    } else if (isArchived) {
      // Archived view: view-only rows, no actions
      tbody.innerHTML = filtered.map(b => `
          <tr class="row-archived">
            <td class="col-check" data-label=""></td>
            <td data-label="Bill Name"><strong>${Utils.esc(b.name)}</strong></td>
            <td data-label="Category">${Utils.esc(b.category || '--')}</td>
            <td class="col-amount" data-label="Amount">${b.amount ? Utils.money(b.amount) : '--'}</td>
            <td data-label="Due Date">${b.dueDate ? Utils.dateStr(b.dueDate) : '--'}</td>
            <td data-label="Status"><span class="badge badge-paid">paid</span></td>
            <td class="col-actions" data-label=""></td>
          </tr>`).join('');
    } else {
      tbody.innerHTML = filtered.map(b => {
        const days = b.dueDate ? Utils.daysUntil(b.dueDate) : null;
        const rowClass = b.status === 'paid' ? 'row-paid' :
          b.status === 'overdue' ? 'row-overdue' :
          (days !== null && days === 0) ? 'row-due-today' : '';
        const badgeClass = b.status === 'paid' ? 'badge-paid' :
          b.status === 'overdue' ? 'badge-overdue' : 'badge-unpaid';
        const urgencyClass = Notifications.getUrgencyClass(b);
        const checked = this._selected.has(b.id) ? 'checked' : '';

        return `
          <tr class="${rowClass} ${urgencyClass} ${checked ? 'row-selected' : ''}">
            <td class="col-check" data-label=""><input type="checkbox" ${checked} onchange="Bills.toggleOne('${b.id}', this.checked)" title="Select bill"></td>
            <td data-label="Bill Name"><strong>${Utils.esc(b.name)}</strong></td>
            <td data-label="Category">${Utils.esc(b.category || '--')}</td>
            <td class="col-amount" data-label="Amount">${b.amount ? Utils.money(b.amount) : '--'}</td>
            <td data-label="Due Date">${b.dueDate ? Utils.dateStr(b.dueDate) : '--'}</td>
            <td data-label="Status"><span class="badge ${badgeClass}">${b.status}</span></td>
            <td class="col-actions" data-label="">
              ${b.status !== 'paid' ? `<button class="btn btn-sm btn-green" onclick="Bills.markPaid('${b.id}')">Pay</button>` : ''}
              <button class="btn btn-sm" onclick="Bills.edit('${b.id}')">Edit</button>
              <button class="btn btn-sm btn-red" onclick="Bills.remove('${b.id}')">Del</button>
            </td>
          </tr>`;
      }).join('');
    }

    // Update select-all checkbox state (only for active view)
    const selectAll = document.getElementById('bills-select-all');
    if (selectAll) {
      if (isArchived) {
        selectAll.checked = false;
        selectAll.disabled = true;
      } else {
        selectAll.disabled = false;
        selectAll.checked = filtered.length > 0 && this._selected.size === filtered.length;
      }
    }

    // Update bulk bar (hidden in archived view)
    this._updateBulkBar();

    // Summary - always show active bill totals
    const totalAll = activeBills.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const totalUnpaid = activeBills.filter(b => b.status !== 'paid').reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const totalPaid = activeBills.filter(b => b.status === 'paid').reduce((s, b) => s + (Number(b.amount) || 0), 0);
    document.getElementById('bills-summary').innerHTML =
      `<span>Total: <strong>${Utils.money(totalAll)}</strong></span>` +
      `<span>Unpaid: <strong style="color:var(--red)">${Utils.money(totalUnpaid)}</strong></span>` +
      `<span>Paid: <strong style="color:var(--green)">${Utils.money(totalPaid)}</strong></span>`;
  },

  _updateArchiveTabs(activeCount, archivedCount) {
    const activeCountEl = document.getElementById('active-count');
    const archivedCountEl = document.getElementById('archived-count');
    if (activeCountEl) activeCountEl.textContent = activeCount;
    if (archivedCountEl) archivedCountEl.textContent = archivedCount;

    const tabs = document.querySelectorAll('.archive-tabs .tab-btn');
    tabs.forEach(tab => {
      tab.classList.remove('active');
    });
    const activeIndex = this._viewMode === 'active' ? 0 : 1;
    if (tabs[activeIndex]) tabs[activeIndex].classList.add('active');

    // Hide/show bulk bar container and filter bar based on view
    const bulkBar = document.getElementById('bills-bulk-bar');
    if (bulkBar && this._viewMode === 'archived') {
      bulkBar.classList.remove('visible');
    }
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
    const bills = this._viewMode === 'archived' ? Storage.getArchivedBills() : Storage.getActiveBills();
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
      if (this._selected.has(b.id)) return { ...b, status: 'paid', archived: true };
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
    Insights.invalidateCache();
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

    if (!name) { Toast.show('Name is required', 'error'); return; }
    if (amount <= 0 && !existingId) { Toast.show('Amount must be greater than 0', 'error'); return; }

    if (existingId) {
      Storage.updateBill(existingId, { name, amount, dueDate, category, recurring });
      Toast.show('Bill updated', 'success');
    } else {
      Storage.addBill({ name, amount, dueDate, category, recurring, status: 'unpaid' });
      Toast.show(`Bill added: ${name}`, 'success');
    }

    Storage.saveMonthlySnapshot();
    Insights.invalidateCache();
    App.closeModal();
    this.render();
    Dashboard.render();
  }
};
