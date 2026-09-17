// ============================================
// ====== State ================================
// ============================================
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let allTransactions = [];
let allIncomes = [];
let pieChartInstance, barChartInstance, compareChartInstance;
let categoriesLoaded = false;

// ============================================
// ====== Loading ==============================
// ============================================
function showLoading() {
  const el = document.getElementById('loadingOverlay');
  if (el) el.style.display = 'flex';
}
function hideLoading() {
  const el = document.getElementById('loadingOverlay');
  if (el) el.style.display = 'none';
}

// ============================================
// ====== Init =================================
// ============================================
async function init() {
  const monthNames = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                      'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const selMonth = document.getElementById('selMonth');
  selMonth.innerHTML = '';
  monthNames.forEach((m, i) => {
    const o = document.createElement('option');
    o.value = i + 1; o.textContent = m;
    if (i + 1 === currentMonth) o.selected = true;
    selMonth.appendChild(o);
  });

  const selYear = document.getElementById('selYear');
  selYear.innerHTML = '';
  for (let y = currentYear - 2; y <= currentYear + 1; y++) {
    const o = document.createElement('option');
    o.value = y; o.textContent = y + 543;
    if (y === currentYear) o.selected = true;
    selYear.appendChild(o);
  }

  await loadAll();
}

// ============================================
// ====== Load all data ========================
// ============================================
async function loadAll(forceRefresh = false) {
  currentMonth = parseInt(document.getElementById('selMonth').value);
  currentYear = parseInt(document.getElementById('selYear').value);
  document.getElementById('reportYearLabel').textContent = currentYear + 543;

  showLoading();
  const t0 = performance.now();
  try {
    const data = await API.getDashboard(currentYear, currentMonth);
    const t1 = performance.now();
    console.log(`⏱️ getDashboard loaded in ${Math.round(t1 - t0)} ms`);

    if (!categoriesLoaded && data.categories) {
      const selF = document.getElementById('fCategory');
      selF.innerHTML = '';
      data.categories.categories.forEach(c => selF.appendChild(new Option(c, c)));

      const selI = document.getElementById('incCategory');
      selI.innerHTML = '';
      data.categories.incomeCategories.forEach(c => selI.appendChild(new Option(c, c)));

      categoriesLoaded = true;
    }

    allTransactions = data.transactions || [];
    allIncomes = data.incomes || [];

    try {
      localStorage.setItem(`dash_${currentYear}_${currentMonth}`, JSON.stringify({
        data, ts: Date.now()
      }));
    } catch (e) {}

    renderTables();
    renderIncomeTable();
    renderSummary(data.summary);

    if (document.getElementById('panel-report').classList.contains('active')) {
      loadYearlyReport();
    }
  } catch (err) {
    console.error('loadAll error:', err);

    const cached = localStorage.getItem(`dash_${currentYear}_${currentMonth}`);
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        const ageMin = Math.round((Date.now() - ts) / 60000);
        console.log(`⚠️ ใช้ cache อายุ ${ageMin} นาที`);
        allTransactions = data.transactions || [];
        allIncomes = data.incomes || [];
        renderTables();
        renderIncomeTable();
        renderSummary(data.summary);
        return;
      } catch (e) {}
    }

    alert('❌ โหลดข้อมูลไม่สำเร็จ: ' + err.message);
  } finally {
    hideLoading();
  }
}

// ============================================
// ====== Utils ================================
// ============================================
function fmt(n) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' ฿';
}

function statusBadge(status) {
  if (status === 'จ่ายแล้ว') return '<span class="status-badge status-paid">จ่ายแล้ว</span>';
  if (status === 'ไม่มียอดค้าง') return '<span class="status-badge status-none">ไม่มียอดค้าง</span>';
  return '<span class="status-badge status-unpaid">รอจ่าย</span>';
}

// ============================================
// ====== Render Summary =======================
// ============================================
function renderSummary(s) {
  if (!s) return;
  document.getElementById('cardIncome').textContent = fmt(s.totalIncome);
  document.getElementById('cardTotal').textContent = fmt(s.totalAll);
  document.getElementById('cardPaid').textContent = fmt(s.totalPaid);
  document.getElementById('cardUnpaid').textContent = fmt(s.totalUnpaid);
  document.getElementById('cardNoBalance').textContent = fmt(s.totalNoBalance);
  document.getElementById('cardCount').textContent = s.count;

  const netEl = document.getElementById('cardNet');
  netEl.textContent = fmt(s.netBalance);
  netEl.classList.toggle('negative', s.netBalance < 0);

  const banner = document.getElementById('negativeBanner');
  const bannerText = document.getElementById('negativeBannerText');
  if (s.netBalance < 0) {
    bannerText.textContent = `ยอดคงเหลือเดือนนี้ติดลบ ${Math.abs(s.netBalance).toLocaleString()} ฿ — รายจ่ายเกินรายรับ กรุณาตรวจสอบ!`;
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }

  const container = document.getElementById('categoryBars');
  container.innerHTML = '';
  const byCat = s.byCategory || {};
  const maxVal = Math.max(...Object.values(byCat).map(c => c.total), 1);
  const labels = [], values = [];

  for (const cat in byCat) {
    const c = byCat[cat];
    labels.push(cat);
    values.push(c.total);
    const div = document.createElement('div');
    div.className = 'category-bar';
    div.innerHTML = `<div class="label-row"><span>${cat}</span><span>${c.total.toLocaleString()} ฿</span></div>
      <div class="bar-bg"><div class="bar-fill" style="width:${(c.total/maxVal*100)}%"></div></div>`;
    container.appendChild(div);
  }

  if (pieChartInstance) pieChartInstance.destroy();
  pieChartInstance = new Chart(document.getElementById('pieChart').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['#4285F4','#34A853','#FBBC04','#EA4335','#AB47BC',
                          '#26A69A','#FF7043','#8D6E63','#789262','#5C6BC0']
      }]
    },
    options: {
      maintainAspectRatio: true,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } } }
    }
  });

  if (compareChartInstance) compareChartInstance.destroy();
  compareChartInstance = new Chart(document.getElementById('compareChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['เดือนนี้'],
      datasets: [
        { label: 'รายรับ', data: [s.totalIncome], backgroundColor: '#0F9D58' },
        { label: 'รายจ่าย', data: [s.totalAll], backgroundColor: '#EA4335' }
      ]
    },
    options: {
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// ============================================
// ====== Render Tables ========================
// ============================================
function renderTables() {
  const tbAll = document.querySelector('#tableAll tbody');
  const tbUnpaid = document.querySelector('#tableUnpaid tbody');
  const tbPaid = document.querySelector('#tablePaid tbody');
  const tbNone = document.querySelector('#tableNoBalance tbody');
  tbAll.innerHTML = ''; tbUnpaid.innerHTML = ''; tbPaid.innerHTML = ''; tbNone.innerHTML = '';

  allTransactions.forEach(t => {
    const badge = statusBadge(t.status);
    const amt = Number(t.amount).toLocaleString() + ' ฿';

    tbAll.innerHTML += `<tr>
      <td data-label="หมวดหมู่">${t.category}</td>
      <td data-label="รายการ">${t.item}</td>
      <td data-label="จำนวนเงิน">${amt}</td>
      <td data-label="สถานะ">${badge}</td>
      <td data-label="กำหนดจ่าย">${t.dueDate || '-'}</td>
      <td class="actions-cell" data-label="จัดการ">${actionButtons(t)}</td></tr>`;

    if (t.status === 'รอจ่าย') {
      tbUnpaid.innerHTML += `<tr>
        <td data-label="หมวดหมู่">${t.category}</td>
        <td data-label="รายการ">${t.item}</td>
        <td data-label="จำนวนเงิน">${amt}</td>
        <td data-label="กำหนดจ่าย">${t.dueDate || '-'}</td>
        <td class="actions-cell" data-label="จัดการ">${actionButtons(t)}</td></tr>`;
    } else if (t.status === 'จ่ายแล้ว') {
      tbPaid.innerHTML += `<tr>
        <td data-label="หมวดหมู่">${t.category}</td>
        <td data-label="รายการ">${t.item}</td>
        <td data-label="จำนวนเงิน">${amt}</td>
        <td data-label="วันที่จ่าย">${t.paidDate || '-'}</td>
        <td class="actions-cell" data-label="จัดการ">${actionButtons(t)}</td></tr>`;
    } else if (t.status === 'ไม่มียอดค้าง') {
      tbNone.innerHTML += `<tr>
        <td data-label="หมวดหมู่">${t.category}</td>
        <td data-label="รายการ">${t.item}</td>
        <td data-label="จำนวนเงิน">${amt}</td>
        <td class="actions-cell" data-label="จัดการ">${actionButtons(t)}</td></tr>`;
    }
  });

  if (allTransactions.length === 0) {
    tbAll.innerHTML = '<tr><td colspan="6" class="empty-state">ยังไม่มีรายการ กดปุ่ม "สร้างรายการเดือนนี้"</td></tr>';
  }
  if (tbUnpaid.innerHTML === '') tbUnpaid.innerHTML = '<tr><td colspan="5" class="empty-state">ไม่มีรายการรอจ่าย 🎉</td></tr>';
  if (tbPaid.innerHTML === '') tbPaid.innerHTML = '<tr><td colspan="5" class="empty-state">ยังไม่มีรายการที่จ่ายแล้ว</td></tr>';
  if (tbNone.innerHTML === '') tbNone.innerHTML = '<tr><td colspan="4" class="empty-state">ไม่มีรายการในหมวดนี้</td></tr>';
}

function renderIncomeTable() {
  const tb = document.querySelector('#tableIncome tbody');
  tb.innerHTML = '';
  allIncomes.forEach(inc => {
    const incJson = JSON.stringify(inc).replace(/'/g, "&#39;");
    tb.innerHTML += `<tr>
      <td data-label="หมวดหมู่">${inc.category}</td>
      <td data-label="รายการ">${inc.item}</td>
      <td data-label="จำนวนเงิน">${Number(inc.amount).toLocaleString()} ฿</td>
      <td data-label="วันที่รับ">${inc.date || '-'}</td>
      <td class="actions-cell" data-label="จัดการ">
        <button class="btn btn-primary btn-sm" onclick='editIncomeRow(${incJson})'>แก้ไข</button>
        <button class="btn btn-danger btn-sm" onclick="deleteIncomeRow(${inc.id})">ลบ</button>
      </td></tr>`;
  });
  if (allIncomes.length === 0) {
    tb.innerHTML = '<tr><td colspan="5" class="empty-state">ยังไม่มีรายการรายรับในเดือนนี้ กดปุ่ม "เพิ่มรายรับ"</td></tr>';
  }
}

function actionButtons(t) {
  const tJson = JSON.stringify(t).replace(/'/g, "&#39;");
  let b = '';
  if (t.status === 'รอจ่าย') {
    b += `<button class="btn btn-success btn-sm" onclick="markPaid(${t.id})">จ่ายแล้ว</button>`;
    b += `<button class="btn btn-neutral btn-sm" onclick="markNoBalance(${t.id})">ไม่มียอดค้าง</button>`;
  } else if (t.status === 'จ่ายแล้ว') {
    b += `<button class="btn btn-warning btn-sm" onclick="markUnpaid(${t.id})">ยกเลิกจ่าย</button>`;
  } else {
    b += `<button class="btn btn-primary btn-sm" onclick="markUnpaid(${t.id})">กลับเป็นรอจ่าย</button>`;
  }
  b += `<button class="btn btn-primary btn-sm" onclick='editTransaction(${tJson})'>แก้ไข</button>`;
  b += `<button class="btn btn-danger btn-sm" onclick="deleteTransaction(${t.id})">ลบ</button>`;
  return b;
}

// ============================================
// ====== Actions ==============================
// ============================================
async function markPaid(id) {
  try { await API.markAsPaid(id); loadAll(); }
  catch (e) { alert('❌ ' + e.message); }
}
async function markUnpaid(id) {
  try { await API.markAsUnpaid(id); loadAll(); }
  catch (e) { alert('❌ ' + e.message); }
}
async function markNoBalance(id) {
  try { await API.markAsNoBalance(id); loadAll(); }
  catch (e) { alert('❌ ' + e.message); }
}
async function deleteTransaction(id) {
  if (!confirm('ยืนยันการลบ?')) return;
  try { await API.deleteTransaction(id); loadAll(); }
  catch (e) { alert('❌ ' + e.message); }
}
async function deleteIncomeRow(id) {
  if (!confirm('ยืนยันการลบรายรับนี้?')) return;
  try { await API.deleteIncome(id); loadAll(); }
  catch (e) { alert('❌ ' + e.message); }
}

// ============================================
// ====== Modal รายจ่าย ========================
// ============================================
function openAddModal() {
  document.getElementById('modalTitle').textContent = 'เพิ่มรายการรายจ่าย';
  ['editId', 'fItem', 'fAmount', 'fDueDate', 'fNote'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('fStatus').value = 'รอจ่าย';
  document.getElementById('modalForm').classList.add('active');
}

function editTransaction(t) {
  document.getElementById('modalTitle').textContent = 'แก้ไขรายการ';
  document.getElementById('editId').value = t.id;
  document.getElementById('fCategory').value = t.category;
  document.getElementById('fItem').value = t.item;
  document.getElementById('fAmount').value = t.amount;
  document.getElementById('fStatus').value = t.status;
  document.getElementById('fDueDate').value = t.dueDate || '';
  document.getElementById('fNote').value = t.note || '';
  document.getElementById('modalForm').classList.add('active');
}

function closeModal() {
  document.getElementById('modalForm').classList.remove('active');
}

async function saveTransaction() {
  const id = document.getElementById('editId').value;
  const data = {
    id, year: currentYear, month: currentMonth,
    category: document.getElementById('fCategory').value,
    item: document.getElementById('fItem').value,
    amount: document.getElementById('fAmount').value,
    status: document.getElementById('fStatus').value,
    dueDate: document.getElementById('fDueDate').value,
    note: document.getElementById('fNote').value
  };
  if (!data.item || data.amount === '') {
    alert('กรุณากรอกรายการและจำนวนเงิน'); return;
  }
  try {
    if (id) await API.updateTransaction(data);
    else await API.addTransaction(data);
    closeModal(); loadAll();
  } catch (e) { alert('❌ บันทึกไม่สำเร็จ: ' + e.message); }
}

// ============================================
// ====== Modal รายรับ =========================
// ============================================
function openIncomeModal() {
  document.getElementById('incomeModalTitle').textContent = 'เพิ่มรายรับใหม่';
  ['incomeEditId', 'incItem', 'incAmount', 'incNote'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('incDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('modalIncome').classList.add('active');
}

function editIncomeRow(inc) {
  document.getElementById('incomeModalTitle').textContent = 'แก้ไขรายรับ';
  document.getElementById('incomeEditId').value = inc.id;
  document.getElementById('incCategory').value = inc.category;
  document.getElementById('incItem').value = inc.item;
  document.getElementById('incAmount').value = inc.amount;
  document.getElementById('incDate').value = inc.date || '';
  document.getElementById('incNote').value = inc.note || '';
  document.getElementById('modalIncome').classList.add('active');
}

function closeIncomeModal() {
  document.getElementById('modalIncome').classList.remove('active');
}

async function saveIncome() {
  const id = document.getElementById('incomeEditId').value;
  const data = {
    id, year: currentYear, month: currentMonth,
    category: document.getElementById('incCategory').value,
    item: document.getElementById('incItem').value,
    amount: document.getElementById('incAmount').value,
    date: document.getElementById('incDate').value,
    note: document.getElementById('incNote').value
  };
  if (!data.item || data.amount === '') {
    alert('กรุณากรอกรายการและจำนวนเงิน'); return;
  }
  try {
    if (id) await API.updateIncome(data);
    else await API.addIncome(data);
    closeIncomeModal(); loadAll();
  } catch (e) { alert('❌ บันทึกไม่สำเร็จ: ' + e.message); }
}

// ============================================
// ====== Generate month =======================
// ============================================
async function generateMonth() {
  if (!confirm(`สร้างรายการสำหรับเดือน ${currentMonth}/${currentYear}?`)) return;
  showLoading();
  try {
    const res = await API.generateForMonth(currentYear, currentMonth);
    alert(`✅ สร้างรายการใหม่ ${res.generated} รายการ`);
    loadAll();
  } catch (e) {
    hideLoading();
    alert('❌ สร้างรายการไม่สำเร็จ: ' + e.message);
  }
}

// ============================================
// ====== Yearly report ========================
// ============================================
async function loadYearlyReport() {
  showLoading();
  try {
    const data = await API.getYearlySummary(currentYear);
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                    'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const expenseValues = months.map((_, i) => data.byMonth[i + 1] || 0);
    const incomeValues = months.map((_, i) => data.incomeByMonth[i + 1] || 0);

    if (barChartInstance) barChartInstance.destroy();
    barChartInstance = new Chart(document.getElementById('barChart').getContext('2d'), {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          { label: 'รายรับ', data: incomeValues, backgroundColor: '#0F9D58' },
          { label: 'รายจ่าย', data: expenseValues, backgroundColor: '#EA4335' }
        ]
      },
      options: {
        plugins: { legend: { position: 'bottom' } },
        scales: { x: { ticks: { font: { size: 10 } } } }
      }
    });

    document.getElementById('cardYearIncome').textContent = fmt(data.totalIncomeYear);
    document.getElementById('cardYearExpense').textContent = fmt(data.totalExpenseYear);
    const netEl = document.getElementById('cardYearNet');
    netEl.textContent = fmt(data.netYear);
    netEl.classList.toggle('negative', data.netYear < 0);

    const tb = document.querySelector('#tableReport tbody');
    tb.innerHTML = '';
    for (const cat in data.byCategory) {
      tb.innerHTML += `<tr><td data-label="หมวดหมู่">${cat}</td>
        <td data-label="ยอดรวม">${data.byCategory[cat].toLocaleString()} ฿</td></tr>`;
    }
  } catch (e) {
    alert('❌ โหลดรายงานไม่สำเร็จ: ' + e.message);
  } finally {
    hideLoading();
  }
}

// ============================================
// ====== Tabs =================================
// ============================================
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  if (tab === 'report') loadYearlyReport();
}

// ============================================
// ====== Start ================================
// ============================================
window.addEventListener('DOMContentLoaded', init);
