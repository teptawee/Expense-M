// ==========================================
// 🚀 หน้า Templates: ดึงรายการประจำมาใช้ทั้งเดือน
// ==========================================
function renderTemplatesPage() {
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();

  const mSel = document.getElementById('genMonth');
  const ySel = document.getElementById('genYear');

  if (mSel && mSel.options.length === 0) {
    mSel.innerHTML = MONTHS_FULL.map((m, i) =>
      `<option value="${i + 1}" ${i + 1 === curMonth ? 'selected' : ''}>${m}</option>`
    ).join('');
  }
  if (ySel && ySel.options.length === 0) {
    ySel.innerHTML = [curYear - 1, curYear, curYear + 1]
      .map(y => `<option value="${y}" ${y === curYear ? 'selected' : ''}>${y + 543}</option>`).join('');
  }

  // จัดกลุ่ม template ตามหมวดหมู่
  const grouped = {};
  TEMPLATES.forEach(t => {
    const catName = t.categories?.name || 'อื่นๆ';
    if (!grouped[catName]) grouped[catName] = { icon: t.categories?.icon || '📁', items: [], total: 0 };
    grouped[catName].items.push(t);
    grouped[catName].total += Number(t.default_amount) || 0;
  });

  const box = document.getElementById('templateList');
  if (!box) return;
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
              <div class="text-xs text-slate-500">
                ${t.due_day ? `📅 ครบวันที่ ${t.due_day}` : 'ไม่กำหนดวัน'}
              </div>
            </div>
            <input type="number" value="${t.default_amount}"
                   onchange="updateTemplateAmount(${t.id}, this.value)"
                   class="w-20 text-right border rounded px-2 py-1 text-sm">
            <button onclick="editTemplate(${t.id})" class="text-xs p-1">✏️</button>
            <button onclick="deleteTemplateConfirm(${t.id})" class="text-xs p-1">🗑️</button>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// ------------------------------------------
// 🚀 สร้างรายการของเดือนจาก Template
// ------------------------------------------
async function generateMonth() {
  const month = Number(document.getElementById('genMonth').value);
  const year = Number(document.getElementById('genYear').value);

  if (!confirm(`สร้างรายการทั้งหมดสำหรับเดือน ${MONTHS_FULL[month - 1]} ${year + 543}?`)) return;

  try {
    const count = await generateMonthFromTemplates(month, year);
    toast(`✅ สร้าง ${count} รายการแล้ว`);
    switchTab('expenses');
    // set filter ไปที่เดือนที่เพิ่งสร้าง
    const mSel = document.getElementById('filterMonth');
    if (mSel) mSel.value = month;
    renderExpensesPage();
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ------------------------------------------
// ➕ เพิ่ม template ใหม่
// ------------------------------------------
async function addTemplate() {
  const title = document.getElementById('tplTitle').value.trim();
  const amount = Number(document.getElementById('tplAmount').value) || 0;
  const catId = document.getElementById('tplCategory').value;
  const dueDay = Number(document.getElementById('tplDueDay').value) || null;

  if (!title) return toast('ใส่ชื่อรายการ', 'error');
  if (!catId) return toast('เลือกหมวดหมู่', 'error');

  try {
    await addTemplate({
      title, default_amount: amount, category_id: catId,
      due_day: dueDay, is_active: true, sort_order: 999
    });
    toast('✅ เพิ่มแม่แบบแล้ว');
    document.getElementById('tplTitle').value = '';
    document.getElementById('tplAmount').value = '';
    document.getElementById('tplDueDay').value = '';
    renderTemplatesPage();
  } catch (e) {
    toast('ไม่สำเร็จ: ' + e.message, 'error');
  }
}

// ------------------------------------------
// 💾 อัปเดตจำนวนเงิน default
// ------------------------------------------
async function updateTemplateAmount(id, value) {
  await updateTemplate(id, { default_amount: Number(value) || 0 });
  toast('💾 อัปเดตแล้ว');
}

// ------------------------------------------
// ✏️ แก้ไข template
// ------------------------------------------
async function editTemplate(id) {
  const t = TEMPLATES.find(x => x.id === id);
  if (!t) return;
  const title = prompt('ชื่อรายการ:', t.title);
  if (title === null) return;
  const amount = prompt('จำนวนเงินเริ่มต้น:', t.default_amount);
  if (amount === null) return;
  const dueDay = prompt('วันครบกำหนด (1-31, เว้นว่าง):', t.due_day || '');
  if (dueDay === null) return;

  await updateTemplate(id, {
    title,
    default_amount: Number(amount) || 0,
    due_day: dueDay ? Number(dueDay) : null
  });
  toast('✏️ แก้ไขแล้ว');
  renderTemplatesPage();
}

// ------------------------------------------
// 🗑️ ลบ template
// ------------------------------------------
async function deleteTemplateConfirm(id) {
  if (!confirm('ลบแม่แบบรายการนี้?')) return;
  await deleteTemplate(id);
  toast('🗑️ ลบแล้ว', 'info');
  renderTemplatesPage();
}

// ------------------------------------------
// 🗂️ เพิ่มหมวดหมู่ใหม่
// ------------------------------------------
async function addNewCategory() {
  const name = prompt('ชื่อหมวดหมู่ใหม่:');
  if (!name) return;
  const icon = prompt('อิโมจิ (เช่น 🍔):', '📁') || '📁';
  try {
    await addCategory(name.trim(), icon);
    toast('✅ เพิ่มหมวดหมู่แล้ว');
    refreshCategoryDropdowns();
  } catch (e) {
    toast('ไม่สำเร็จ: ' + e.message, 'error');
  }
}

// ------------------------------------------
// 🔄 รีเฟรช dropdown หมวดหมู่ทั้งหมด
// ------------------------------------------
function refreshCategoryDropdowns() {
  const opts = CATEGORIES.map(c =>
    `<option value="${c.id}">${c.icon} ${c.name}</option>`
  ).join('');

  ['newCategory', 'tplCategory'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = opts;
    if (cur) el.value = cur;
  });
}
