// ==========================================
// ⚙️  ตั้งค่า Supabase (แก้ตรงนี้)
// ==========================================
const SUPABASE_URL = 'https://tuybcnhygioveqozpmvi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1eWJjbmh5Z2lvdmVxb3pwbXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MDg1NzgsImV4cCI6MjEwNTE4NDU3OH0.i3wVj07KlcznZFG7mUVwEUygOe10z-1cueUbZzc5b5s';

// ==========================================
// 📦 ตัวแปร global
// ==========================================
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

let allExpenses = [];
let pieChartInst = null;
let barChartInst = null;
let deleteId = null;

// ==========================================
// 🚀 เริ่มต้นแอป
// ==========================================
function init() {
  const now = new Date();
  document.getElementById('todayText').textContent =
    `วันนี้ ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear() + 543}`;

  // ตัวกรองเดือน
  const mSel = document.getElementById('filterMonth');
  mSel.innerHTML = '<option value="">ทุกเดือน</option>' +
    MONTHS.map((m, i) => `<option value="${i + 1}" ${i === now.getMonth() ? 'selected' : ''}>${m}</option>`).join('');

  // รายงาน ปี
  const ySel = document.getElementById('reportYear');
  const y = now.getFullYear();
  ySel.innerHTML = [y - 2, y - 1, y, y + 1]
    .map(v => `<option value="${v}" ${v === y ? 'selected' : ''}>${v + 543}</option>`).join('');

  // Dark mode จาก localStorage
  if (localStorage.dark === '1') document.documentElement.classList.add('dark');

  // Tab เริ่มต้น
  switchTab('dash');

  // โหลดข้อมูล
  loadExpenses();
}

// ==========================================
// 🌙 Dark mode
// ==========================================
function toggleDark() {
  document.documentElement.classList.toggle('dark');
  localStorage.dark = document.documentElement.classList.contains('dark') ? '1' : '0';
}

// ==========================================
// 🗂️ Tab switching
// ==========================================
function switchTab(name) {
  ['dash', 'list', 'report'].forEach(t => {
    document.getElementById('page-' + t).classList.toggle('hidden', t !== name);
    document.getElementById('tab-' + t).classList.toggle('active', t === name);
  });
  if (name === 'report') loadReport();
}

// ==========================================
// 🔔 Toast
// ==========================================
function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  const colors = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-blue-500' };
  t.firstElementChild.className = `${colors[type]} text-white px-4 py-2 rounded-lg shadow-lg`;
  t.firstElementChild.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2500);
}

// ==========================================
// 📥 โหลดข้อมูลจาก Supabase
// ==========================================
async function loadExpenses() {
  const { data, error } = await sb.from('expenses').select('*').order('id');
  if (error) return toast('โหลดไม่สำเร็จ: ' + error.message, 'error');
  allExpenses = data || [];
  renderList();
  renderDashboard();
}

// ==========================================
// 🏷️ คำนวณสถานะจริง (paid / pending / overdue)
// ==========================================
function getStatus(it) {
  if (it.status === 'paid') return 'paid';
  if (it.due_day) {
    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), it.due_day);
    if (now > dueDate) return 'overdue';
  }
  return 'pending';
}

// ==========================================
// 📝 แสดงรายการ
// ==========================================
function renderList() {
  const fs = document.getElementById('filterStatus').value;
  const fc = document.getElementById('filterCategory').value;

  let items = allExpenses.filter(it => {
    if (fs && getStatus(it) !== fs) return false;
    if (fc && it.category !== fc) return false;
    return true;
  });

  const list = document.getElementById('list');
  if (items.length === 0) {
    list.innerHTML = '<div class="card bg-white rounded-xl p-8 shadow text-center text-slate-400">ยังไม่มีรายการ</div>';
    return;
  }

  list.innerHTML = items.map(it => {
    const st = getStatus(it);
    const amt = Number(it.amount) || 0;
    const isPaid = st === 'paid';
    const isOverdue = st === 'overdue';
    const borderColor = isPaid ? 'border-green-500' : isOverdue ? 'border-red-500' : 'border-yellow-400';

    const statusBadge = isPaid
      ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ จ่ายแล้ว</span>'
      : isOverdue
        ? '<span class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">⚠️ เลยกำหนด</span>'
        : '<span class="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">⏳ รอจ่าย</span>';

    return `
      <div class="card fade-in bg-white dark:bg-slate-800 rounded-xl p-3 shadow border-l-4 ${borderColor} flex justify-between items-center gap-2">
        <div class="flex-1 min-w-0">
          <div class="font-semibold ${isPaid ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'} truncate">${it.title}</div>
          <div class="text-xs text-slate-500 mt-0.5 flex gap-2 items-center flex-wrap">
            <span>${it.category}</span>
            ${it.due_day ? `<span>• ครบวันที่ ${it.due_day}</span>` : ''}
            ${statusBadge}
          </div>
        </div>
        <div class="flex items-center gap-1">
          <div class="font-bold text-slate-800 dark:text-white whitespace-nowrap">฿${amt.toLocaleString()}</div>
          <button onclick="toggleStatus(${it.id}, '${it.status}')"
            class="text-xs px-2 py-1 rounded-lg ${isPaid ? 'bg-gray-200 dark:bg-slate-600' : 'bg-green-500 text-white'}">
            ${isPaid ? '↩️' : '✓'}
          </button>
          <button onclick="editExpense(${it.id})" class="text-xs p-1">✏️</button>
          <button onclick="openConfirm(${it.id})" class="text-xs p-1">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// 📊 Dashboard
// ==========================================
function renderDashboard() {
  let total = 0, paid = 0, pending = 0, overdue = 0;
  allExpenses.forEach(it => {
    const amt = Number(it.amount) || 0;
    const st = getStatus(it);
    total += amt;
    if (st === 'paid') paid += amt;
    else if (st === 'overdue') overdue += amt;
    else pending += amt;
  });

  document.getElementById('sumTotal').textContent = '฿' + total.toLocaleString();
  document.getElementById('sumPaid').textContent = '฿' + paid.toLocaleString();
  document.getElementById('sumPending').textContent = '฿' + pending.toLocaleString();
  document.getElementById('sumOverdue').textContent = '฿' + overdue.toLocaleString();

  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressText').textContent = pct + '% จ่ายแล้ว';

  renderPendingList();
  renderPieChart();
  renderBarChart();
}

// ------------------------------------------
// 🔔 รายการรอจ่าย (Dashboard)
// ------------------------------------------
function renderPendingList() {
  const pendingItems = allExpenses.filter(it => getStatus(it) !== 'paid');
  const pl = document.getElementById('pendingList');

  if (pendingItems.length === 0) {
    pl.innerHTML = '<div class="text-center text-slate-400 py-4">🎉 จ่ายครบทุกรายการแล้ว!</div>';
    return;
  }

  pl.innerHTML = pendingItems.slice(0, 8).map(it => {
    const st = getStatus(it);
    const amt = Number(it.amount) || 0;
    const bg = st === 'overdue' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20';
    const label = st === 'overdue' ? '⚠️ เลยกำหนด' : '⏳ รอจ่าย';
    return `
      <div class="flex justify-between items-center p-2 rounded-lg ${bg}">
        <div>
          <div class="font-semibold text-sm">${it.title}</div>
          <div class="text-xs text-slate-500">${label}${it.due_day ? ' • ครบวันที่ ' + it.due_day : ''}</div>
        </div>
        <div class="flex items-center gap-2">
          <div class="font-bold text-sm">฿${amt.toLocaleString()}</div>
          <button onclick="toggleStatus(${it.id}, '${it.status}')"
            class="text-xs bg-green-500 text-white px-3 py-1 rounded-lg">จ่ายแล้ว</button>
        </div>
      </div>
    `;
  }).join('');

  if (pendingItems.length > 8) {
    pl.innerHTML += `<div class="text-xs text-slate-400 text-center mt-2">และอีก ${pendingItems.length - 8} รายการ</div>`;
  }
}

// ------------------------------------------
// 🍩 Pie chart
// ------------------------------------------
function renderPieChart() {
  const byCat = {};
  allExpenses.forEach(it => {
    const amt = Number(it.amount) || 0;
    byCat[it.category] = (byCat[it.category] || 0) + amt;
  });

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                  '#ec4899', '#06b6d4', '#84cc16', '#f97316'];

  if (pieChartInst) pieChartInst.destroy();
  pieChartInst = new Chart(document.getElementById('pieChart'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(byCat),
      datasets: [{ data: Object.values(byCat), backgroundColor: colors }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { font: { family: 'Sarabun' } } } }
    }
  });
}

// ------------------------------------------
// 📊 Bar chart 6 เดือน
// ------------------------------------------
function renderBarChart() {
  const now = new Date();
  const months = [];
  const monthTotals = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(MONTHS[d.getMonth()]);
    monthTotals.push(i === 0
      ? allExpenses.reduce((s, it) => s + (Number(it.amount) || 0), 0)
      : 0);
  }

  if (barChartInst) barChartInst.destroy();
  barChartInst = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels: months,
      datasets: [{ label: 'ยอดรวม (฿)', data: monthTotals, backgroundColor: '#3b82f6', borderRadius: 6 }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { font: { family: 'Sarabun' } } },
        x: { ticks: { font: { family: 'Sarabun' } } }
      }
    }
  });
}

// ==========================================
// ➕ เพิ่มรายการ
// ==========================================
async function addExpense() {
  const title = document.getElementById('newTitle').value.trim();
  const amount = Number(document.getElementById('newAmount').value) || 0;
  const category = document.getElementById('newCategory').value;
  const dueDay = Number(document.getElementById('newDueDay').value) || null;

  if (!title) return toast('ใส่ชื่อรายการก่อนครับ', 'error');
  if (amount <= 0) return toast('ใส่จำนวนเงินด้วยครับ', 'error');

  const { error } = await sb.from('expenses').insert({ title, amount, category, due_day: dueDay });
  if (error) return toast('บันทึกไม่สำเร็จ: ' + error.message, 'error');

  toast('✅ บันทึกแล้ว');
  document.getElementById('newTitle').value = '';
  document.getElementById('newAmount').value = '';
  document.getElementById('newDueDay').value = '';
  loadExpenses();
}

// ==========================================
// 🔄 เปลี่ยนสถานะ จ่ายแล้ว / รอจ่าย
// ==========================================
async function toggleStatus(id, status) {
  const newStatus = status === 'paid' ? 'pending' : 'paid';
  const { error } = await sb.from('expenses').update({ status: newStatus }).eq('id', id);
  if (error) return toast('ไม่สำเร็จ', 'error');
  toast(newStatus === 'paid' ? '✅ จ่ายแล้ว' : '↩️ ยกเลิกแล้ว', newStatus === 'paid' ? 'success' : 'info');
  loadExpenses();
}

// ==========================================
// ✏️ แก้ไข
// ==========================================
async function editExpense(id) {
  const it = allExpenses.find(x => x.id === id);
  if (!it) return;

  const title = prompt('ชื่อรายการ:', it.title);
  if (title === null) return;
  const amount = prompt('จำนวนเงิน:', it.amount);
  if (amount === null) return;
  const dueDay = prompt('วันครบกำหนด (1-31, เว้นว่างได้):', it.due_day || '');
  if (dueDay === null) return;

  const { error } = await sb.from('expenses').update({
    title,
    amount: Number(amount),
    due_day: dueDay ? Number(dueDay) : null
  }).eq('id', id);

  if (error) return toast('แก้ไขไม่สำเร็จ', 'error');
  toast('✏️ แก้ไขแล้ว');
  loadExpenses();
}

// ==========================================
// 🗑️ ลบ (มี modal ยืนยัน)
// ==========================================
function openConfirm(id) {
  deleteId = id;
  const m = document.getElementById('confirmModal');
  m.classList.remove('hidden');
  m.classList.add('flex');

  document.getElementById('confirmDeleteBtn').onclick = async () => {
    await sb.from('expenses').delete().eq('id', deleteId);
    closeConfirm();
    toast('🗑️ ลบแล้ว', 'info');
    loadExpenses();
  };
}

function closeConfirm() {
  const m = document.getElementById('confirmModal');
  m.classList.add('hidden');
  m.classList.remove('flex');
}

// ==========================================
// 📈 รายงาน
// ==========================================
function loadReport() {
  const items = allExpenses;

  const byCat = {};
  items.forEach(it => {
    const amt = Number(it.amount) || 0;
    if (!byCat[it.category]) byCat[it.category] = { total: 0, count: 0, paid: 0 };
    byCat[it.category].total += amt;
    byCat[it.category].count += 1;
    if (it.status === 'paid') byCat[it.category].paid += amt;
  });

  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const paid = items.filter(it => it.status === 'paid').reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const pending = total - paid;

  document.getElementById('reportSummary').innerHTML = `
    <div class="card bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
      <div class="text-xs text-slate-500">ยอดรวม</div>
      <div class="font-bold text-blue-600">฿${total.toLocaleString()}</div>
    </div>
    <div class="card bg-green-50 dark:bg-green-900/30 rounded-lg p-3">
      <div class="text-xs text-slate-500">จ่ายแล้ว</div>
      <div class="font-bold text-green-600">฿${paid.toLocaleString()}</div>
    </div>
    <div class="card bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-3">
      <div class="text-xs text-slate-500">คงเหลือ</div>
      <div class="font-bold text-yellow-600">฿${pending.toLocaleString()}</div>
    </div>
    <div class="card bg-purple-50 dark:bg-purple-900/30 rounded-lg p-3">
      <div class="text-xs text-slate-500">จำนวนรายการ</div>
      <div class="font-bold text-purple-600">${items.length}</div>
    </div>
  `;

  document.getElementById('reportTable').innerHTML = `
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b dark:border-slate-700 text-left text-slate-500">
          <th class="py-2">หมวดหมู่</th>
          <th class="py-2 text-right">จำนวน</th>
          <th class="py-2 text-right">จ่ายแล้ว</th>
          <th class="py-2 text-right">ยอดรวม</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(byCat).map(([cat, v]) => `
          <tr class="border-b dark:border-slate-700">
            <td class="py-2">${cat}</td>
            <td class="py-2 text-right">${v.count}</td>
            <td class="py-2 text-right text-green-600">฿${v.paid.toLocaleString()}</td>
            <td class="py-2 text-right font-semibold">฿${v.total.toLocaleString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ==========================================
// 📥 Export CSV
// ==========================================
function exportCSV() {
  const rows = [['ชื่อ', 'หมวดหมู่', 'จำนวนเงิน', 'สถานะ', 'วันครบกำหนด']];
  allExpenses.forEach(it => {
    rows.push([it.title, it.category, it.amount, getStatus(it), it.due_day || '']);
  });
  const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `รายงานค่าใช้จ่าย_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  toast('📥 ดาวน์โหลดแล้ว');
}

// ==========================================
// 🚀 เริ่มทำงาน
// ==========================================
init();
