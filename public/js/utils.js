// ===== UTILITY FUNCTIONS =====
const Utils = {
  // Format currency
  money(amount, currency) {
    const cur = currency || Storage.getSetting('currency') || 'PHP';
    const sym = cur === 'USD' ? '$' : '₱';
    const num = Math.abs(Number(amount) || 0);
    return (amount < 0 ? '-' : '') + sym + num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  },

  // Short money (e.g., ₱25K)
  moneyShort(amount) {
    const num = Math.abs(Number(amount) || 0);
    const sym = '₱';
    if (num >= 1000000) return sym + (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return sym + (num / 1000).toFixed(0) + 'K';
    return sym + num;
  },

  // Format date
  dateStr(d) {
    if (!d) return '--';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  dateFull(d) {
    if (!d) return '--';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // Days until a date
  daysUntil(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  },

  // Days left in current month
  daysLeftInMonth() {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return last.getDate() - now.getDate();
  },

  // Current month/year
  currentMonth() {
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  },

  currentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },

  // Generate unique ID
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  // Parse due date from Bryan's format (e.g., "03-01-2026", "3-2", "March 9", "15")
  parseDueDate(input, month, year) {
    if (!input) return null;
    const now = new Date();
    const m = month !== undefined ? month : now.getMonth();
    const y = year !== undefined ? year : now.getFullYear();

    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

    // MM-DD-YYYY
    if (/^\d{2}-\d{2}-\d{4}$/.test(input)) {
      const [mm, dd, yyyy] = input.split('-');
      return `${yyyy}-${mm}-${dd}`;
    }

    // Just a day number like "15" or "28"
    if (/^\d{1,2}$/.test(input.trim())) {
      const day = parseInt(input.trim());
      return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    // M-D format like "3-2" or "03-10"
    if (/^\d{1,2}-\d{1,2}$/.test(input)) {
      const [mm, dd] = input.split('-');
      return `${y}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }

    // "March 9" or "March 25"
    const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const match = input.toLowerCase().match(/^(\w+)\s+(\d{1,2})$/);
    if (match) {
      const mi = monthNames.indexOf(match[1]);
      if (mi !== -1) {
        return `${y}-${String(mi + 1).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
      }
    }

    return null;
  },

  // Simple canvas bar chart
  drawBarChart(canvasId, labels, datasets) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = (parseInt(canvas.getAttribute('height')) || 200) * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = (parseInt(canvas.getAttribute('height')) || 200) + 'px';
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = parseInt(canvas.getAttribute('height')) || 200;
    const pad = { top: 10, right: 15, bottom: 30, left: 60 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);

    if (!labels.length) return;

    const allVals = datasets.flatMap(d => d.data);
    const maxVal = Math.max(...allVals, 1);

    // Y axis
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const val = (maxVal / 4) * i;
      const y = pad.top + chartH - (chartH * (i / 4));
      ctx.fillText(Utils.moneyShort(val), pad.left - 8, y + 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }

    const barGroupW = chartW / labels.length;
    const barW = Math.min(barGroupW * 0.3, 30);
    const gap = barW * 0.3;

    datasets.forEach((ds, di) => {
      ctx.fillStyle = ds.color;
      ds.data.forEach((val, i) => {
        const barH = (val / maxVal) * chartH;
        const x = pad.left + (i * barGroupW) + (barGroupW / 2) - ((datasets.length * (barW + gap)) / 2) + (di * (barW + gap));
        const y = pad.top + chartH - barH;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
        ctx.fill();
      });
    });

    // X labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    labels.forEach((label, i) => {
      const x = pad.left + (i * barGroupW) + (barGroupW / 2);
      ctx.fillText(label, x, h - 8);
    });
  },

  // Simple HTML escape
  esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // Parse simple markdown (bold, lists) for chat — escapes HTML first to prevent XSS
  mdToHtml(text) {
    if (!text) return '';
    // Escape HTML entities first
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return escaped
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n- /g, '\n<li>')
      .replace(/\n\d+\. /g, '\n<li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }
};
