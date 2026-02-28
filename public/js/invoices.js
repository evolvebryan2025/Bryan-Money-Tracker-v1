// ===== INVOICES =====
const Invoices = {
  render() {
    const invoices = Storage.getInvoices();
    const filterStatus = document.getElementById('invoice-filter-status').value;

    let filtered = [...invoices];
    if (filterStatus !== 'all') {
      filtered = filtered.filter(i => i.status === filterStatus);
    }

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const tbody = document.getElementById('invoices-tbody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No invoices yet. Create one to start tracking.</td></tr>';
    } else {
      tbody.innerHTML = filtered.map(inv => {
        const badgeClass = `badge-${inv.status}`;
        return `
          <tr>
            <td><strong>${Utils.esc(inv.number)}</strong></td>
            <td>${Utils.esc(inv.client)}</td>
            <td class="col-amount">${Utils.money(inv.amount)}</td>
            <td>${Utils.dateFull(inv.date)}</td>
            <td>${Utils.dateFull(inv.dueDate)}</td>
            <td><span class="badge ${badgeClass}">${inv.status}</span></td>
            <td>
              ${inv.status === 'draft' ? `<button class="btn btn-sm btn-cyan" onclick="Invoices.updateStatus('${inv.id}','sent')">Send</button>` : ''}
              ${inv.status === 'sent' ? `<button class="btn btn-sm btn-green" onclick="Invoices.updateStatus('${inv.id}','paid')">Paid</button>` : ''}
              <button class="btn btn-sm" onclick="Invoices.edit('${inv.id}')">Edit</button>
              <button class="btn btn-sm btn-red" onclick="Invoices.remove('${inv.id}')">Del</button>
            </td>
          </tr>`;
      }).join('');
    }
  },

  updateStatus(id, status) {
    Storage.updateInvoice(id, { status });
    this.render();
  },

  edit(id) {
    const inv = Storage.getInvoices().find(i => i.id === id);
    if (!inv) return;
    App.showModal('add-invoice', inv);
  },

  remove(id) {
    if (confirm('Delete this invoice?')) {
      Storage.deleteInvoice(id);
      this.render();
    }
  },

  getFormHtml(existing) {
    const inv = existing || {};
    const clients = Storage.getIncomes().map(i => i.name).filter(Boolean);
    const clientOptions = clients.map(c =>
      `<option value="${Utils.esc(c)}" ${inv.client === c ? 'selected' : ''}>${Utils.esc(c)}</option>`
    ).join('');

    return `
      <div class="form-grid">
        <div class="form-field">
          <label>Client</label>
          <select id="inv-client">
            <option value="">Select client...</option>
            ${clientOptions}
            <option value="_custom">Other (type below)</option>
          </select>
          <input type="text" id="inv-client-custom" value="${Utils.esc(inv.client || '')}" placeholder="Client name" style="margin-top:0.5rem">
        </div>
        <div class="form-field">
          <label>Amount (₱)</label>
          <input type="number" id="inv-amount" value="${inv.amount || ''}" placeholder="0">
        </div>
        <div class="form-field">
          <label>Invoice Date</label>
          <input type="date" id="inv-date" value="${inv.date || new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-field">
          <label>Due Date</label>
          <input type="date" id="inv-due" value="${inv.dueDate || ''}">
        </div>
        <div class="form-field">
          <label>Description</label>
          <textarea id="inv-desc" rows="3" placeholder="Service description...">${Utils.esc(inv.description || '')}</textarea>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-cyan" onclick="Invoices.save('${inv.id || ''}')">${inv.id ? 'Update' : 'Create Invoice'}</button>
      </div>`;
  },

  save(existingId) {
    const clientSelect = document.getElementById('inv-client').value;
    const clientCustom = document.getElementById('inv-client-custom').value.trim();
    const client = clientSelect === '_custom' || !clientSelect ? clientCustom : clientSelect;
    const amount = Number(document.getElementById('inv-amount').value) || 0;
    const date = document.getElementById('inv-date').value;
    const dueDate = document.getElementById('inv-due').value;
    const description = document.getElementById('inv-desc').value.trim();

    if (!client) { alert('Client is required'); return; }
    if (!amount) { alert('Amount is required'); return; }

    if (existingId) {
      Storage.updateInvoice(existingId, { client, amount, date, dueDate, description });
    } else {
      Storage.addInvoice({ client, amount, date, dueDate, description, status: 'draft' });
    }

    App.closeModal();
    this.render();
  }
};
