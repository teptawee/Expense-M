// ==========================================
// 🗂️ CATEGORIES
// ==========================================
async function fetchCategories() {
  const { data, error } = await sb.from('categories').select('*').order('sort_order');
  if (error) throw error;
  CATEGORIES = data || [];
  return CATEGORIES;
}

async function addCategory(name, icon = '📁', color = '#3b82f6') {
  const { error } = await sb.from('categories').insert({ name, icon, color, sort_order: 100 });
  if (error) throw error;
  await fetchCategories();
}

async function updateCategory(id, payload) {
  const { error } = await sb.from('categories').update(payload).eq('id', id);
  if (error) throw error;
  await fetchCategories();
}

async function deleteCategory(id) {
  const { error } = await sb.from('categories').delete().eq('id', id);
  if (error) throw error;
  await fetchCategories();
}

// ==========================================
// 📋 TEMPLATES (รายการประจำ)
// ==========================================
async function fetchTemplates() {
  const { data, error } = await sb.from('expense_templates')
    .select('*, categories(name, icon, color)')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  TEMPLATES = data || [];
  return TEMPLATES;
}

async function addTemplate(payload) {
  const { error } = await sb.from('expense_templates').insert(payload);
  if (error) throw error;
  await fetchTemplates();
}

async function updateTemplate(id, payload) {
  const { error } = await sb.from('expense_templates').update(payload).eq('id', id);
  if (error) throw error;
  await fetchTemplates();
}

async function deleteTemplate(id) {
  const { error } = await sb.from('expense_templates').delete().eq('id', id);
  if (error) throw error;
  await fetchTemplates();
}

// ==========================================
// 💰 EXPENSES (รายการของเดือน)
// ==========================================
async function fetchExpensesByMonth(month, year) {
  const { data, error } = await sb.from('expenses')
    .select('*, categories(name, icon, color)')
    .eq('month', month)
    .eq('year', year)
    .order('id');
  if (error) throw error;
  EXPENSES = data || [];
  return EXPENSES;
}

async function fetchAllExpenses() {
  const { data, error } = await sb.from('expenses')
    .select('*, categories(name, icon, color)')
    .order('id');
  if (error) throw error;
  EXPENSES = data || [];
  return EXPENSES;
}

async function addExpense(payload) {
  const { error } = await sb.from('expenses').insert(payload);
  if (error) throw error;
}

async function updateExpense(id, payload) {
  const { error } = await sb.from('expenses').update(payload).eq('id', id);
  if (error) throw error;
}

async function deleteExpense(id) {
  const { error } = await sb.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

// ==========================================
// 🚀 ดึง template ทั้งหมด → สร้างรายการสำหรับเดือนที่เลือก
// ==========================================
async function generateMonthFromTemplates(month, year) {
  // ตรวจว่ามีรายการของเดือนนี้อยู่แล้วหรือยัง
  const { data: existing } = await sb.from('expenses')
    .select('id')
    .eq('month', month)
    .eq('year', year);

  if (existing && existing.length > 0) {
    throw new Error(`มีรายการของเดือนนี้อยู่แล้ว ${existing.length} รายการ`);
  }

  const tpls = await fetchTemplates();
  if (tpls.length === 0) throw new Error('ยังไม่มีแม่แบบรายการ');

  const rows = tpls.map(t => ({
    template_id: t.id,
    title: t.title,
    amount: t.default_amount || 0,
    category_id: t.category_id,
    due_day: t.due_day,
    note: t.note,
    month,
    year,
    status: 'pending'
  }));

  const { error } = await sb.from('expenses').insert(rows);
  if (error) throw error;
  return rows.length;
}
