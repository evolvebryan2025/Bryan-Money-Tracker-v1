// ===== TEAM COSTS =====
const Team = {
  render() {
    const team = Storage.getTeam();
    const totalSalary = team.reduce((s, m) => s + (Number(m.salary) || 0), 0);

    document.getElementById('team-total').textContent = `Total: ${Utils.money(totalSalary)}/mo`;

    const container = document.getElementById('team-cards');
    container.innerHTML = team.map(m => {
      const pct = totalSalary > 0 ? ((m.salary / totalSalary) * 100).toFixed(1) : 0;
      const statusClass = m.paid ? 'status-paid' : 'status-unpaid';
      const statusText = m.paid ? 'Paid' : 'Unpaid';

      return `
        <div class="team-card">
          <div class="team-name">${Utils.esc(m.name)}</div>
          <div class="team-role">${Utils.esc(m.role)}</div>
          <div class="team-salary">${m.salary ? Utils.money(m.salary) : 'TBD'}</div>
          ${m.payDate ? `<div class="team-pct">Pay date: ${m.payDate}th · ${pct}% of total</div>` : '<div class="team-pct">Pay date: TBD</div>'}
          <div>
            <span class="team-status ${statusClass}">${statusText}</span>
            ${!m.paid && m.salary ? `<button class="btn btn-sm btn-green" style="margin-left:0.5rem" onclick="Team.markPaid('${m.id}')">Mark Paid</button>` : ''}
          </div>
          <div style="margin-top:0.6rem;display:flex;gap:0.4rem">
            <button class="btn btn-sm" onclick="Team.edit('${m.id}')">Edit</button>
            <button class="btn btn-sm btn-red" onclick="Team.remove('${m.id}')">Remove</button>
          </div>
        </div>`;
    }).join('');

    this._renderChart(team, totalSalary);
  },

  markPaid(id) {
    Storage.updateTeamMember(id, { paid: true });
    this.render();
  },

  showAdd() {
    const html = `
      <div class="form-grid">
        <div class="form-field">
          <label>Name</label>
          <input type="text" id="team-name" value="" placeholder="Employee name">
        </div>
        <div class="form-field">
          <label>Role</label>
          <input type="text" id="team-role" value="" placeholder="e.g., Developer, GHL Specialist">
        </div>
        <div class="form-field">
          <label>Monthly Salary (₱)</label>
          <input type="number" id="team-salary" value="" placeholder="0">
        </div>
        <div class="form-field">
          <label>Pay Date (day of month)</label>
          <input type="number" id="team-paydate" value="" min="1" max="31" placeholder="e.g., 15">
        </div>
      </div>
      <div class="form-actions">
        <button class="btn" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-cyan" onclick="Team.saveNew()">Add Employee</button>
      </div>`;

    document.getElementById('modal-title').textContent = 'Add Employee';
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-overlay').classList.add('open');
  },

  saveNew() {
    const name = document.getElementById('team-name').value.trim();
    const role = document.getElementById('team-role').value.trim();
    const salary = Number(document.getElementById('team-salary').value) || 0;
    const payDate = Number(document.getElementById('team-paydate').value) || null;

    if (!name) { alert('Name is required'); return; }

    Storage.addTeamMember({ name, role, salary, payDate });
    App.closeModal();
    this.render();
    Dashboard.render();
  },

  edit(id) {
    const member = Storage.getTeam().find(m => m.id === id);
    if (!member) return;

    const html = `
      <div class="form-grid">
        <div class="form-field">
          <label>Name</label>
          <input type="text" id="team-name" value="${Utils.esc(member.name)}">
        </div>
        <div class="form-field">
          <label>Role</label>
          <input type="text" id="team-role" value="${Utils.esc(member.role)}">
        </div>
        <div class="form-field">
          <label>Monthly Salary (₱)</label>
          <input type="number" id="team-salary" value="${member.salary || ''}">
        </div>
        <div class="form-field">
          <label>Pay Date (day of month)</label>
          <input type="number" id="team-paydate" value="${member.payDate || ''}" min="1" max="31">
        </div>
      </div>
      <div class="form-actions">
        <button class="btn" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-cyan" onclick="Team.save('${id}')">Update</button>
      </div>`;

    document.getElementById('modal-title').textContent = 'Edit Employee';
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-overlay').classList.add('open');
  },

  save(id) {
    const name = document.getElementById('team-name').value.trim();
    const role = document.getElementById('team-role').value.trim();
    const salary = Number(document.getElementById('team-salary').value) || 0;
    const payDate = Number(document.getElementById('team-paydate').value) || null;

    Storage.updateTeamMember(id, { name, role, salary, payDate });
    App.closeModal();
    this.render();
    Dashboard.render();
  },

  remove(id) {
    const member = Storage.getTeam().find(m => m.id === id);
    if (!member) return;
    if (confirm(`Remove ${member.name} from the team?`)) {
      Storage.deleteTeamMember(id);
      this.render();
      Dashboard.render();
    }
  },

  _renderChart(team, total) {
    const canvas = document.getElementById('team-chart');
    if (!canvas) return;
    const members = team.filter(m => m.salary > 0);
    const labels = members.map(m => m.name);
    const data = members.map(m => m.salary);

    Utils.drawBarChart('team-chart', labels, [
      { label: 'Salary', data, color: '#06b6d4' }
    ]);
  }
};
