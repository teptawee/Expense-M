// ==========================================
// ⚙️ ตั้งค่า Supabase (แก้ 2 บรรทัดนี้!)
// ==========================================
const SUPABASE_URL = 'https://tuybcnhygioveqozpmvi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1eWJjbmh5Z2lvdmVxb3pwbXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MDg1NzgsImV4cCI6MjEwNTE4NDU3OH0.i3wVj07KlcznZFG7mUVwEUygOe10z-1cueUbZzc5b5s';

// ==========================================
// ตัวแปร global
// ==========================================
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const MONTHS_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

let CATEGORIES = [];
let TEMPLATES = [];
let EXPENSES = [];
let pieChartInst = null, barChartInst = null, reportChartInst = null;
let deleteId = null;

// ==========================================
// 🌙 Dark mode
// ==========================================
function toggleDark() {
  document.documentElement.classList.toggle('dark');
  localStorage.dark = document.documentElement.classList.contains('dark') ? '1' : '0';
}

// ==========================================
// 🔔 Toast
// ==========================================
function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  const colors = { success:'bg-green-500', error:'bg-red-500', info:'bg-blue-500' };
  t.firstElementChild.className = `${colors[type]} text-white px-4 py-2 rounded-lg shadow-lg`;
  t.firstElementChild.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2500);
}

function baht(n) { return '฿' + (Number(n) || 0).toLocaleString(); }

// ==========================================
// 🏷️ สถานะรายการ (อิงตามเดือน/ปี ของรายการ)
// ==========================================
function getStatus(it) {
  if (it.status === 'paid') return 'paid';
  if (!it.due_day || !it.month || !it.year) return 'pending';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(it.year, it.month - 1, it.due_day);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 3) return 'due-soon';
  return 'pending';
}

// ==========================================
// 📅 วันครบกำหนดแบบเต็ม
// ==========================================
function formatDueDate(it) {
  if (!it.due_day || !it.month || !it.year) return '';
  return `${it.due_day} ${MONTHS[it.month - 1]} ${it.year + 543}`;
}

function daysUntilDue(it) {
  if (!it.due_day || !it.month || !it.year) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(it.year, it.month - 1, it.due_day);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
}

// ==========================================
// 🗂️ Tab
// ==========================================
function switchTab(name) {
  ['dash','expenses','templates','report'].forEach(t => {
    document.getElementById('page-' + t)?.classList.toggle('hidden', t !== name);
    document.getElementById('tab-' + t)?.classList.toggle('active', t === name);
  });
  if (name === 'dash') renderDashboard();
  if (name === 'expenses') renderExpensesPage();
  if (name === 'templates') renderTemplatesPage();
  if (name === 'report') renderReport();
}

// ==========================================
// 📡 API
// ==========================================
async function fetchCategories() {
  const { data, error } = await sb.from('categories').select('*').order('sort_order');
  if (error) throw error;
  CATEGORIES = data || [];
}

async function fetchTemplates() {
  const { data, error } = await sb.from('expense_templates')
    .select('*, categories(name, icon, color)').eq('is_active', true).order('sort_order');
  if (error) throw error;
  TEMPLATES = data || [];
}

async function fetchAllExpenses() {
  const { data, error } = await sb.from('expenses')
    .select('*, categories(name, icon, color)').order('id');
  if (error) throw error;
  EXPENSES = data || [];
}

async function generateMonthFromTemplates(month, year) {
  const { data: existing } = await sb.from('expenses').select('id').eq('month', month).eq('year', year);
  if (existing && existing.length > 0) throw new Error(`มีรายการของเดือนนี้อยู่แล้ว ${existing.length} รายการ`);

  const { data: tpls, error: tErr } = await sb.from('expense_templates').select('*').eq('is_active', true);
  if (tErr) throw tErr;
  if (!tpls || tpls.length === 0) throw new Error('ยังไม่มีแม่แบบรายการ');

  const rows = tpls.map(t => ({
    template_id: t.id, title: t.title, amount: t.default_amount || 0,
    category_id: t.category_id, due_day: t.due_day, note: t.note,
    month, year, status: 'pending'
  }));
  const { error } = await sb.from('expenses').insert(rows);
  if (error) throw error;
  return rows.length;
}

// ==========================================
// 📊 Dashboard
// ==========================================
function renderDashboard() {
  const now = new Date();
  const thisMonth = now.getMonth() + 1, thisYear = now.getFullYear();
  const monthItems = EXPENSES.filter(it => it.month === thisMonth && it.year === thisYear);

  let total = 0, paid = 0, pending = 0, overdue = 0, dueSoon = 0;
  monthItems.forEach(it => {
    const amt = Number(it.amount) || 0;
    const st = getStatus(it);
    total += amt;
    if (st === 'paid') paid += amt;
    else if (st === 'overdue') overdue += amt;
    else if (st === 'due-soon') dueSoon += amt;
    else pending += amt;
  });

  document.getElementById('sumTotal').textContent = baht(total);
  document.getElementById('sumPaid').textContent = baht(paid);
  document.getElementById('sumPending').textContent = baht(pending);
  document.getElementById('sumDueSoon').textContent = baht(dueSoon);
  document.getElementById('sumOverdue').textContent = baht(overdue);

  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressText').textContent = pct + '%';

  // pending list (เรียงตามความเร่งด่วน)
  const pendingItems = monthItems
    .filter(it => getStatus(it) !== 'paid')
    .sort((a, b) => {
      const order = { overdue: 0, 'due-soon': 1, pending: 2 };
      return order[getStatus(a)] - order[getStatus(b)];
    });

  document.getElementById('pendingCount').textContent = pendingItems.length;
  const pl = document.getElementById('pendingList');
  if (pendingItems.length === 0) {
    pl.innerHTML = '<div class="text-center text-slate-400 py-4">🎉 จ่ายครบทุกรายการแล้ว!</div>';
  } else {
    pl.innerHTML = pendingItems.slice(0, 8).map(it => {
      const st = getStatus(it);
      const amt = Number(it.amount) || 0;
      const bg = st === 'overdue' ? 'bg-red-50 dark:bg-red-900/20'
               : st === 'due-soon' ? 'bg-orange-50 dark:bg-orange-900/20'
               : 'bg-yellow-50 dark:bg-yellow-900/20';
      const label = st === 'overdue' ? '⚠️ เลยกำหนด'
                  : st === 'due-soon' ? '🔔 ใกล้ครบกำหนด'
                  : '⏳ รอจ่าย';

      const days = daysUntilDue(it);
      let dayText = '';
      if (days !== null) {
        if (days < 0) dayText = ` • เลย ${Math.abs(days)} วัน`;
        else if (days === 0) dayText = ' • ครบวันนี้!';
        else if (days === 1) dayText = ' • พรุ่งนี้';
        else if (days <= 7) dayText = ` • อีก ${days} วัน`;
      }
      const dueInfo = it.due_day ? ` • 📅 ${formatDueDate(it)}${dayText}` : '';

      return `
        <div class="flex justify-between items-center p-2 rounded-lg ${bg}">
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm truncate">${it.title}</div>
            <div class="text-xs text-slate-500">${label}${dueInfo}</div>
          </div>
          <div class="flex items-center gap-2">
            <div class="font-bold text-sm whitespace-nowrap">${baht(amt)}</div>
            <button onclick="toggleStatus(${it.id})" class="text-xs bg-green-500 text-white px-3 py-1 rounded-lg whitespace-nowrap">จ่ายแล้ว</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // pie chart
  const byCat = {};
  monthItems.forEach(it => {
    const cat = it.categories?.name || 'อื่นๆ';
    byCat[cat] = (byCat[cat] || 0) + (Number(it.amount) || 0);
  });
  const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316'];
  if (pieChartInst) pieChartInst.destroy();
  pieChartInst = new Chart(document.getElementById('pieChart'), {
    type: 'doughnut',
    data: { labels: Object.keys(byCat), datasets: [{ data: Object.values(byCat), backgroundColor: colors }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { family: 'Sarabun' } } } } }
  });

  // bar chart 6 เดือน
  const labels = [], totals = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(thisYear, now.getMonth() - i, 1);
    labels.push(MONTHS[d.getMonth()]);
    const m = d.getMonth() + 1, y = d.getFullYear();
    totals.push(EXPENSES.filter(it => it.month === m && it.year === y).reduce((s, it) => s + (Number(it.amount) || 0), 0));
  }
  if (barChartInst) barChartInst.destroy();
  barChartInst = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'ยอดรวม (฿)', data: totals, backgroundColor: '#3b82f6', borderRadius: 6 }] },
    options: { responsive: true, plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { font: { family: 'Sarabun' } } }, x: { ticks: { font: { family: 'Sarabun' } } } } }
  });
}

// ==========================================
// 📝 Expenses Page
// ==========================================
function renderExpensesPage() {
  const now = new Date();
  const mSel = document.getElementById('filterMonth');
  if (!mSel.value) mSel.value = now.getMonth() + 1;
  const month = Number(mSel.value), year = now.getFullYear();
  const filterStatus = document.getElementById('filterStatus').value;

  const monthItems = EXPENSES.filter(it => it.month === month && it.year === year);
  renderExpenseSummary(monthItems);

  const grouped = {};
  monthItems.forEach(it => {
    if (filterStatus && getStatus(it) !== filterStatus) return;
    const catName = it.categories?.name || 'อื่นๆ';
    if (!grouped[catName]) grouped[catName] = { icon: it.categories?.icon || '📁', items: [], total: 0 };
    grouped[catName].items.push(it);
    grouped[catName].total += Number(it.amount) || 0;
  });

  const box = document.getElementById('list');
  if (Object.keys(grouped).length === 0) {
    box.innerHTML = `<div class="card bg-white rounded-xl p-8 shadow text-center text-slate-400">
      ยังไม่มีรายการในเดือนนี้<br>
      <button onclick="switchTab('templates')" class="mt-3 bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">🚀 ดึงรายการประจำมาใช้</button>
    </div>`;
    return;
  }

  box.innerHTML = Object.entries(grouped).map(([cat, g]) => `
    <div class="card bg-white dark:bg-slate-800 rounded-xl shadow mb-3 overflow-hidden">
      <div class="flex justify-between items-center p-3 border-b dark:border-slate-700 cursor-pointer" onclick="toggleAccordion(this)">
        <div class="flex items-center gap-2">
          <span class="text-xl">${g.icon}</span>
          <span class="font-bold">${cat}</span>
          <span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">${g.items.length}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-bold text-slate-700 dark:text-slate-200">${baht(g.total)}</span>
          <span class="text-slate-400">▼</span>
        </div>
      </div>
      <div class="p-2 space-y-2">${g.items.map(renderExpenseItem).join('')}</div>
    </div>
  `).join('');
}

function renderExpenseItem(it) {
  const st = getStatus(it);
  const amt = Number(it.amount) || 0;
  const isPaid = st === 'paid';
  const isOverdue = st === 'overdue';
  const isDueSoon = st === 'due-soon';

  const borderColor = isPaid ? 'border-green-500'
                    : isOverdue ? 'border-red-500'
                    : isDueSoon ? 'border-orange-500'
                    : 'border-yellow-400';

  let badge = '';
  if (isPaid) {
    badge = '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ จ่ายแล้ว</span>';
  } else if (isOverdue) {
    badge = '<span class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">⚠️ เลยกำหนด</span>';
  } else if (isDueSoon) {
    badge = '<span class="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">🔔 ใกล้ครบกำหนด</span>';
  } else {
    badge = '<span class="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">⏳ รอจ่าย</span>';
  }

  let dueText = '';
  if (it.due_day && it.month && it.year) {
    const days = daysUntilDue(it);
    let extra = '';
    if (!isPaid && days !== null) {
      if (days < 0) extra = ` • เลย ${Math.abs(days)} วัน`;
      else if (days === 0) extra = ' • ครบวันนี้!';
      else if (days === 1) extra = ' • พรุ่งนี้';
      else if (days <= 7) extra = ` • อีก ${days} วัน`;
    }
    dueText = `<span>📅 ครบ ${formatDueDate(it)}${extra}</span>`;
  } else {
    dueText = '<span class="text-slate-400">📅 ไม่กำหนดวัน</span>';
  }

  return `
    <div class="fade-in bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border-l-4 ${borderColor} flex justify-between items-center gap-2">
      <div class="flex-1 min-w-0">
        <div class="font-semibold ${isPaid ? 'line-through text-slate-400' : ''} truncate">${it.title}</div>
        <div class="text-xs text-slate-500 mt-0.5 flex gap-2 items-center flex-wrap">
          ${dueText}
          ${badge}
        </div>
      </div>
      <div class="flex items-center gap-1">
        <input type="number" value="${amt}" onchange="updateAmount(${it.id}, this.value)"
               class="w-20 text-right border rounded px-2 py-1 text-sm font-bold">
        <button onclick="toggleStatus(${it.id})"
          class="text-xs px-2 py-1 rounded-lg ${isPaid ? 'bg-gray-200 dark:bg-slate-600' : 'bg-green-500 text-white'}">
          ${isPaid ? '↩️' : '✓ จ่าย'}
        </button>
        <button onclick="editExpense(${it.id})" class="text-xs p-1">✏️</button>
        <button onclick="openConfirm(${it.id})" class="text-xs p-1">🗑️</button>
      </div>
    </div>
  `;
}

function renderExpenseSummary(items) {
  let total = 0, paid = 0, pending = 0;
  items.forEach(it => {
    const amt = Number(it.amount) || 0;
    total += amt;
    if (getStatus(it) === 'paid') paid += amt; else pending += amt;
  });
  document.getElementById('expenseSummary').innerHTML = `
    <div class="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-2">
      <div class="text-xs text-slate-500">รวม</div>
      <div class="font-bold text-blue-600">${baht(total)}</div>
    </div>
    <div class="bg-green-50 dark:bg-green-900/30 rounded-lg p-2">
      <div class="text-xs text-slate-500">จ่ายแล้ว</div>
      <div class="font-bold text-green-600">${baht(paid)}</div>
    </div>
    <div class="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-2">
      <div class="text-xs text-slate-500">รอจ่าย</div>
      <div class="font-bold text-yellow-600">${baht(pending)}</div>
    </div>
  `;
}

function toggleAccordion(el) {
  const body = el.nextElementSibling;
  const arrow = el.querySelector('.text-slate-400');
  const hidden = body.style.display === 'none';
  body.style.display = hidden ? '' : 'none';
  if (arrow) arrow.textContent = hidden ? '▼' : '▶';
}

function expandAll() {
  document.querySelectorAll('#list > div > .p-2').forEach(b => b.style.display = '');
}
function collapseAll() {
  document.querySelectorAll('#list > div > .p-2').forEach(b => b.style.display = 'none');
}

async function addExpense() {
  const title = document.getElementById('newTitle').value.trim();
  const amount = Number(document.getElementById('newAmount').value) || 0;
  const categoryId = document.getElementById('newCategory').value;
  const month = Number(document.getElementById('filterMonth').value);
  const year = new Date().getFullYear();

  // due day: เอาจาก input ก่อน ถ้าไม่กรอกเอาจาก dropdown
  let dueDay = null;
  const dueDayInput = document.getElementById('newDueDay').value.trim();
  const dueDaySelect = document.getElementById('newDueDaySelect').value;

  if (dueDayInput !== '') {
    const n = Number(dueDayInput);
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      return toast('วันครบกำหนดต้องเป็นเลข 1-31', 'error');
    }
    dueDay = n;
  } else if (dueDaySelect !== '') {
    dueDay = Number(dueDaySelect);
  }

  if (!title) return toast('ใส่ชื่อรายการก่อน', 'error');
  if (!categoryId) return toast('เลือกหมวดหมู่', 'error');

  const { error } = await sb.from('expenses').insert({
    title, amount, category_id: categoryId, due_day: dueDay, month, year, status: 'pending'
  });
  if (error) return toast('ไม่สำเร็จ: ' + error.message, 'error');

  toast('✅ บันทึกแล้ว');
  document.getElementById('newTitle').value = '';
  document.getElementById('newAmount').value = '';
  document.getElementById('newDueDay').value = '';
  document.getElementById('newDueDaySelect').value = '';
  await fetchAllExpenses();
  renderExpensesPage();
}

async function toggleStatus(id) {
  const it = EXPENSES.find(x => x.id === id);
  if (!it) return;
  const newStatus = it.status === 'paid' ? 'pending' : 'paid';
  const { error } = await sb.from('expenses').update({
    status: newStatus, paid_at: newStatus === 'paid' ? new Date().toISOString() : null
  }).eq('id', id);
  if (error) return toast('ไม่สำเร็จ', 'error');
  toast(newStatus === 'paid' ? '✅ จ่ายแล้ว' : '↩️ ยกเลิก', newStatus === 'paid' ? 'success' : 'info');
  await fetchAllExpenses();
  renderExpensesPage();
  renderDashboard();
}

async function updateAmount(id, value) {
  await sb.from('expenses').update({ amount: Number(value) || 0 }).eq('id', id);
  toast('💾 อัปเดตแล้ว');
  await fetchAllExpenses();
  renderExpensesPage();
}

async function editExpense(id) {
  const it = EXPENSES.find(x => x.id === id);
  if (!it) return;

  const title = prompt('ชื่อรายการ:', it.title);
  if (title === null) return;

  const amount = prompt('จำนวนเงิน:', it.amount);
  if (amount === null) return;

  const dueDay = prompt(
    `วันครบกำหนด (1-31, เว้นว่าง = ไม่กำหนด)\nเดือน: ${MONTHS[it.month-1]} ${it.year+543}`,
    it.due_day || ''
  );
  if (dueDay === null) return;

  let dueVal = null;
  if (dueDay.trim() !== '') {
    const n = Number(dueDay);
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      return toast('วันครบกำหนดต้องเป็นเลข 1-31', 'error');
    }
    dueVal = n;
  }

  const { error } = await sb.from('expenses').update({
    title,
    amount: Number(amount) || 0,
    due_day: dueVal
  }).eq('id', id);

  if (error) return toast('แก้ไขไม่สำเร็จ: ' + error.message, 'error');
  toast('✏️ แก้ไขแล้ว');
  await fetchAllExpenses();
  renderExpensesPage();
  renderDashboard();
}

function openConfirm(id) {
  deleteId = id;
  const m = document.getElementById('confirmModal');
  m.classList.remove('hidden'); m.classList.add('flex');
  document.getElementById('confirmDeleteBtn').onclick = async () => {
    await sb.from('expenses').delete().eq('id', deleteId);
    closeConfirm();
    toast('🗑️ ลบแล้ว', 'info');
    await fetchAllExpenses();
    renderExpensesPage();
    renderDashboard();
  };
}
function closeConfirm() {
  const m = document.getElementById('confirmModal');
  m.classList.add('hidden'); m.classList.remove('flex');
}

async function addNewCategory() {
  const name = prompt('ชื่อหมวดหมู่ใหม่:');
  if (!name) return;
  const icon = prompt('อิโมจิ (เช่น 🍔):', '📁') || '📁';
  const { error } = await sb.from('categories').insert({ name: name.trim(), icon, color: '#3b82f6', sort_order: 100 });
  if (error) return toast('ไม่สำเร็จ: ' + error.message, 'error');
  toast('✅ เพิ่มหมวดหมู่แล้ว');
  await fetchCategories();
  refreshCategoryDropdowns();
}

function refreshCategoryDropdowns() {
  const opts = CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  ['newCategory','tplCategory'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = opts;
    if (cur) el.value = cur;
  });
}

// ==========================================
// 📋 Templates Page
// ==========================================
function renderTemplatesPage() {
  const now = new Date();
  const mSel = document.getElementById('genMonth');
  const ySel = document.getElementById('genYear');
  if (mSel && mSel.options.length === 0) {
    mSel.innerHTML = MONTHS_FULL.map((m, i) => `<option value="${i+1}" ${i+1 === now.getMonth()+1 ? 'selected' : ''}>${m}</option>`).join('');
  }
  if (ySel && ySel.options.length === 0) {
    const y = now.getFullYear();
    ySel.innerHTML = [y-1, y, y+1].map(v => `<option value="${v}" ${v === y ? 'selected' : ''}>${v+543}</option>`).join('');
  }

  const grouped = {};
  TEMPLATES.forEach(t => {
    const catName = t.categories?.name || 'อื่นๆ';
    if (!grouped[catName]) grouped[catName] = { icon: t.categories?.icon || '📁', items: [], total: 0 };
    grouped[catName].items.push(t);
    grouped[catName].total += Number(t.default_amount) || 0;
  });

  const box = document.getElementById('templateList');
  if (!box) return;
  if (Object.keys(grouped).length === 0) {
    box.innerHTML = '<div class="card bg-white rounded-xl p-6 shadow text-center text-slate-400">ยังไม่มีแม่แบบรายการ เพิ่มด้านบนได้เลย</div>';
    return;
  }

  box.innerHTML = Object.entries(grouped).map(([cat, g]) => `
    <div class="card bg-white dark:bg-slate-800 rounded-xl shadow mb-3">
      <div class="flex justify-between items-center p-3 border-b dark:border-slate-700">
        <div class="flex items-center gap-2">
          <span class="text-xl">${g.icon}</span>
          <span class="font-bold">${cat}</span>
          <span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">${g.items.length}</span>
        </div>
        <span class="font-bold text-slate-700 dark:text-slate-200">${baht(g.total)}</span>
      </div>
      <div class="p-2 space-y-2">
        ${g.items.map(t => `
          <div class="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2 flex justify-between items-center gap-2">
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-sm truncate">${t.title}</div>
              <div class="text-xs text-slate-500">${t.due_day ? `📅 ครบวันที่ ${t.due_day}` : 'ไม่กำหนดวัน'}</div>
            </div>
            <input type="number" value="${t.default_amount}" onchange="updateTemplateAmount(${t.id}, this.value)"
                   class="w-20 text-right border rounded px-2 py-1 text-sm">
            <button onclick="editTemplate(${t.id})" class="text-xs p-1">✏️</button>
            <button onclick="deleteTemplateConfirm(${t.id})" class="text-xs p-1">🗑️</button>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

async function generateMonth() {
  const month = Number(document.getElementById('genMonth').value);
  const year = Number(document.getElementById('genYear').value);
  if (!confirm(`สร้างรายการทั้งหมดสำหรับเดือน ${MONTHS_FULL[month-1]} ${year+543}?`)) return;
  try {
    const count = await generateMonthFromTemplates(month, year);
    toast(`✅ สร้าง ${count} รายการแล้ว`);
    await fetchAllExpenses();
    document.getElementById('filterMonth').value = month;
    switchTab('expenses');
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function addTemplate() {
  const title = document.getElementById('tplTitle').value.trim();
  const amount = Number(document.getElementById('tplAmount').value) || 0;
  const catId = document.getElementById('tplCategory').value;

  let dueDay = null;
  const dueDayInput = document.getElementById('tplDueDay').value.trim();
  const dueDaySelect = document.getElementById('tplDueDaySelect').value;

  if (dueDayInput !== '') {
    const n = Number(dueDayInput);
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      return toast('วันครบกำหนดต้องเป็นเลข 1-31', 'error');
    }
    dueDay = n;
  } else if (dueDaySelect !== '') {
    dueDay = Number(dueDaySelect);
  }

  if (!title) return toast('ใส่ชื่อรายการ', 'error');
  if (!catId) return toast('เลือกหมวดหมู่', 'error');

  const { error } = await sb.from('expense_templates').insert({
    title, default_amount: amount, category_id: catId, due_day: dueDay, is_active: true, sort_order: 999
  });
  if (error) return toast('ไม่สำเร็จ: ' + error.message, 'error');
  toast('✅ เพิ่มแม่แบบแล้ว');
  document.getElementById('tplTitle').value = '';
  document.getElementById('tplAmount').value = '';
  document.getElementById('tplDueDay').value = '';
  document.getElementById('tplDueDaySelect').value = '';
  await fetchTemplates();
  renderTemplatesPage();
}

async function updateTemplateAmount(id, value) {
  await sb.from('expense_templates').update({ default_amount: Number(value) || 0 }).eq('id', id);
  toast('💾 อัปเดตแล้ว');
  await fetchTemplates();
  renderTemplatesPage();
}

async function editTemplate(id) {
  const t = TEMPLATES.find(x => x.id === id);
  if (!t) return;
  const title = prompt('ชื่อรายการ:', t.title); if (title === null) return;
  const amount = prompt('จำนวนเงินเริ่มต้น:', t.default_amount); if (amount === null) return;
  const dueDay = prompt('วันครบกำหนด (1-31, เว้นว่าง):', t.due_day || ''); if (dueDay === null) return;

  let dueVal = null;
  if (dueDay.trim() !== '') {
    const n = Number(dueDay);
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      return toast('วันครบกำหนดต้องเป็นเลข 1-31', 'error');
    }
    dueVal = n;
  }

  await sb.from('expense_templates').update({
    title, default_amount: Number(amount) || 0, due_day: dueVal
  }).eq('id', id);
  toast('✏️ แก้ไขแล้ว');
  await fetchTemplates();
  renderTemplatesPage();
}

async function deleteTemplateConfirm(id) {
  if (!confirm('ลบแม่แบบรายการนี้?')) return;
  await sb.from('expense_templates').delete().eq('id', id);
  toast('🗑️ ลบแล้ว', 'info');
  await fetchTemplates();
  renderTemplatesPage();
}

// ==========================================
// 📈 Report
// ==========================================
function renderReport() {
  const ySel = document.getElementById('reportYear');
  const mSel = document.getElementById('reportMonth');
  if (mSel.options.length === 1) {
    mSel.innerHTML = '<option value="">ทั้งปี</option>' +
      MONTHS_FULL.map((m, i) => `<option value="${i+1}">${m}</option>`).join('');
  }
  const year = Number(ySel.value);
  const month = mSel.value ? Number(mSel.value) : null;

  const items = EXPENSES.filter(it => it.year === year && (!month || it.month === month));
  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const paid = items.filter(it => it.status === 'paid').reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const pending = total - paid;

  document.getElementById('reportSummary').innerHTML = `
    <div class="card bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
      <div class="text-xs text-slate-500">ยอดรวม</div>
      <div class="font-bold text-blue-600">${baht(total)}</div>
    </div>
    <div class="card bg-green-50 dark:bg-green-900/30 rounded-lg p-3">
      <div class="text-xs text-slate-500">จ่ายแล้ว</div>
      <div class="font-bold text-green-600">${baht(paid)}</div>
    </div>
    <div class="card bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-3">
      <div class="text-xs text-slate-500">คงเหลือ</div>
      <div class="font-bold text-yellow-600">${baht(pending)}</div>
    </div>
    <div class="card bg-purple-50 dark:bg-purple-900/30 rounded-lg p-3">
      <div class="text-xs text-slate-500">จำนวนรายการ</div>
      <div class="font-bold text-purple-600">${items.length}</div>
    </div>
  `;

  const byCat = {};
  items.forEach(it => {
    const cat = it.categories?.name || 'อื่นๆ';
    if (!byCat[cat]) byCat[cat] = { total: 0, count: 0, paid: 0 };
    byCat[cat].total += Number(it.amount) || 0;
    byCat[cat].count += 1;
    if (it.status === 'paid') byCat[cat].paid += Number(it.amount) || 0;
  });

  if (reportChartInst) reportChartInst.destroy();
  reportChartInst = new Chart(document.getElementById('reportChart'), {
    type: 'bar',
    data: {
      labels: Object.keys(byCat),
      datasets: [{ label: 'ยอดรวม (฿)', data: Object.values(byCat).map(v => v.total), backgroundColor: '#3b82f6', borderRadius: 6 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { font: { family: 'Sarabun' } } }, x: { ticks: { font: { family: 'Sarabun' } } } } }
  });

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
            <td class="py-2 text-right text-green-600">${baht(v.paid)}</td>
            <td class="py-2 text-right font-semibold">${baht(v.total)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function exportCSV() {
  const rows = [['ชื่อ','หมวดหมู่','จำนวนเงิน','สถานะ','วันครบกำหนด','เดือน','ปี']];
  EXPENSES.forEach(it => {
    rows.push([it.title, it.categories?.name || '', it.amount, getStatus(it), it.due_day || '', it.month, it.year]);
  });
  const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `รายงานค่าใช้จ่าย_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('📥 ดาวน์โหลดแล้ว');
}

// ==========================================
// 🚀 Init
// ==========================================
async function init() {
  const now = new Date();
  document.getElementById('todayText').textContent =
    `วันนี้ ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear() + 543}`;

  const mSel = document.getElementById('filterMonth');
  mSel.innerHTML = MONTHS.map((m, i) =>
    `<option value="${i+1}" ${i === now.getMonth() ? 'selected' : ''}>${m}</option>`
  ).join('');

  const ySel = document.getElementById('reportYear');
  const y = now.getFullYear();
  ySel.innerHTML = [y-2, y-1, y, y+1].map(v => `<option value="${v}" ${v === y ? 'selected' : ''}>${v+543}</option>`).join('');

  if (localStorage.dark === '1') document.documentElement.classList.add('dark');

  try {
    await fetchCategories();
    await fetchTemplates();
    await fetchAllExpenses();
    refreshCategoryDropdowns();
  } catch (e) {
    console.error(e);
    toast('โหลดข้อมูลไม่สำเร็จ: ' + e.message, 'error');
  }

  switchTab('dash');
}

window.addEventListener('DOMContentLoaded', init);
