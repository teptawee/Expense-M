// ==========================================
// 📝 หน้ารายการค่าใช้จ่าย (แยกตามหมวดหมู่)
// ==========================================
async function renderExpensesPage() {
  const now = new Date();
  const month = Number(document.getElementById('filterMonth').value) || (now.getMonth() + 1);
  const year = now.getFullYear();
  const filterStatus = document.getElementById('filterStatus').value;

  // ดึงข้อมูลใหม่
  const { data, error } = await sb.from('expenses')
    .select('*, categories(name, icon, color)')
    .eq('month', month)
    .eq('year', year)
    .order('id');

  if (error) return toast('โหลดไม่สำเร็จ: ' + error.message, 'error');
  const items = data || [];

  // สรุปยอดด้านบน
  renderExpenseSummary(items);

  // จัดกลุ่มตามหมวดหมู่
  const grouped = {};
  items.forEach(it => {
    if (filterStatus && getStatus(it) !== filterStatus) return;
    const catName = it.categories?.name || 'อื่นๆ';
    if (!grouped[catName]) grouped[catName] = { icon: it.categories?.icon || '📁', items: [], total: 0 };
    grouped[catName].items.push(it);
    grouped[catName].total += Number(it.amount) || 0;
  });

  const box = document.getElementById('list');
  if (Object.keys(grouped).length === 0) {
    box.innerHTML = `
      <div class="card bg-white rounded-xl p-8 shadow text-center text-slate-400">
        ยังไม่มีรายการในเดือนนี้<br>
        <button onclick="switchTab('templates')" class="mt-3 bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">
          🚀 ดึงรายการประจำมาใช้
        </button>
      </div>`;
    return;
  }

  // เรนเดอร์เป็น accordion ตามหมวดหมู่
  box.innerHTML = Object.entries(grouped).map(([cat, g]) => `
    <div class="card bg-white dark:bg-slate-800 rounded-xl shadow mb-3 overflow-hidden">
      <div class="flex justify-between items-center p-3 border-b dark:border-slate-700 cursor-pointer"
           onclick="toggleAccordion(this)">
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
      <div class="p-2 space-y-2">
        ${g.items.map(it => renderExpenseItem(it)).join('')}
      </div>
    </div>
  `).join('');
}

// ------------------------------------------
// 📦 การ์ดรายการ 1 รายการ
// ------------------------------------------
function renderExpenseItem(it) {
  const st = getStatus(it);
  const amt = Number(it.amount) || 0;
  const isPaid = st === 'paid';
  const isOverdue = st === 'overdue';
  const borderColor = isPaid ? 'border-green-500' : isOverdue ? 'border-red-500' : 'border-yellow-400';

  const badge = isPaid
    ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ จ่ายแล้ว</span>'
    : isOverdue
      ? '<span class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">⚠️ เลยกำหนด</span>'
      : '<span class="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">⏳ รอจ่าย</span>';

  return `
    <div class="fade-in bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border-l-4 ${borderColor} flex justify-between items-center gap-2">
      <div class="flex-1 min-w-0">
        <div class="font-semibold ${isPaid ? 'line-through text-slate-400' : ''} truncate">${it.title}</div>
        <div class="text-xs text-slate-500 mt-0.5 flex gap-2 items-center flex-wrap">
          ${it.due_day ? `<span>📅 ครบวันที่ ${it.due_day}</span>` : ''}
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

// ------------------------------------------
// 📊 สรุปยอดด้านบนของหน้ารายการ
// ------------------------------------------
function renderExpenseSummary(items) {
  let total = 0, paid = 0, pending = 0;
  items.forEach(it => {
    const amt = Number(it.amount) || 0;
    total += amt;
    if (getStatus(it) === 'paid') paid += amt; else pending += amt;
  });
  const el = document.getElementById('expenseSummary');
  if (!el) return;
  el.innerHTML = `
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

// ------------------------------------------
// 🎬 Accordion
// ------------------------------------------
function toggleAccordion(el) {
  const body = el.nextElementSibling;
  const arrow = el.querySelector('.text-slate-400');
  const hidden = body.style.display === 'none';
  body.style.display = hidden ? '' : 'none';
  if (arrow) arrow.textContent = hidden ? '▼' : '▶';
}

// ------------------------------------------
// ➕ เพิ่มรายการใหม่ (ในเดือนปัจจุบัน)
// ------------------------------------------
async function addExpense() {
  const title = document.getElementById('newTitle').value.trim();
  const amount = Number(document.getElementById('newAmount').value) || 0;
  const categoryId = document.getElementById('newCategory').value;
  const dueDay = Number(document.getElementById('newDueDay').value) || null;
  const month = Number(document.getElementById('filterMonth').value);
  const year = new Date().getFullYear();

  if (!title) return toast('ใส่ชื่อรายการก่อน', 'error');
  if (!categoryId) return toast('เลือกหมวดหมู่', 'error');

  try {
    await addExpenseRecord({
      title, amount, category_id: categoryId, due_day: dueDay,
      month, year, status: 'pending'
    });
    toast('✅ บันทึกแล้ว');
    document.getElementById('newTitle').value = '';
    document.getElementById('newAmount').value = '';
    document.getElementById('newDueDay').value = '';
    renderExpensesPage();
  } catch (e) {
    toast('ไม่สำเร็จ: ' + e.message, 'error');
  }
}

// helper alias (หลบ name ชนกัน)
async function addExpenseRecord(payload) {
  const { error } = await sb.from('expenses').insert(payload);
  if (error) throw error;
}

// ------------------------------------------
// 🔄 toggle สถานะ
// ------------------------------------------
async function toggleStatus(id) {
  const { data } = await sb.from('expenses').select('status').eq('id', id).single();
  const newStatus = data.status === 'paid' ? 'pending' : 'paid';
  const patch = { status: newStatus, paid_at: newStatus === 'paid' ? new Date().toISOString() : null };
  await updateExpense(id, patch);
  toast(newStatus === 'paid' ? '✅ จ่ายแล้ว' : '↩️ ยกเลิก', newStatus === 'paid' ? 'success' : 'info');
  renderExpensesPage();
  renderDashboard();
}

// ------------------------------------------
// 💾 แก้จำนวนเงินแบบ inline
// ------------------------------------------
async function updateAmount(id, value) {
  const amt = Number(value) || 0;
  await updateExpense(id, { amount: amt });
  toast('💾 อัปเดตจำนวนเงินแล้ว');
  renderExpensesPage();
}

// ------------------------------------------
// ✏️ แก้ไขรายการ
// ------------------------------------------
async function editExpense(id) {
  const { data: it } = await sb.from('expenses').select('*').eq('id', id).single();
  if (!it) return;

  const title = prompt('ชื่อรายการ:', it.title);
  if (title === null) return;
  const amount = prompt('จำนวนเงิน:', it.amount);
  if (amount === null) return;
  const dueDay = prompt('วันครบกำหนด (1-31, เว้นว่างได้):', it.due_day || '');
  if (dueDay === null) return;

  await updateExpense(id, {
    title,
    amount: Number(amount),
    due_day: dueDay ? Number(dueDay) : null
  });
  toast('✏️ แก้ไขแล้ว');
  renderExpensesPage();
}

// ------------------------------------------
// 🗑️ ลบ
// ------------------------------------------
let deleteId = null;
function openConfirm(id) {
  deleteId = id;
  const m = document.getElementById('confirmModal');
  m.classList.remove('hidden');
  m.classList.add('flex');
  document.getElementById('confirmDeleteBtn').onclick = async () => {
    await deleteExpense(deleteId);
    closeConfirm();
    toast('🗑️ ลบแล้ว', 'info');
    renderExpensesPage();
    renderDashboard();
  };
}
function closeConfirm() {
  const m = document.getElementById('confirmModal');
  m.classList.add('hidden');
  m.classList.remove('flex');
}
