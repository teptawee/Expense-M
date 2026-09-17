// ====== API Wrapper for Supabase ======
const API = (() => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, TABLES } = window.APP_CONFIG;
  const BASE = `${SUPABASE_URL}/rest/v1`;
  
  const HEADERS = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // ===== Helper: REST call =====
  async function rest(endpoint, options = {}) {
    const url = `${BASE}${endpoint}`;
    const t0 = performance.now();
    console.log(`[SB] ${options.method || 'GET'} ${endpoint}`);
    
    const res = await fetch(url, {
      ...options,
      headers: { ...HEADERS, ...(options.headers || {}) }
    });
    
    const t1 = performance.now();
    console.log(`[SB] ← ${res.status} (${Math.round(t1 - t0)}ms)`);
    
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HTTP ${res.status}: ${err}`);
    }
    
    // สำหรับ DELETE/PATCH ที่ไม่มี body
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  // ===== Helper: RPC call (เรียก function ใน Postgres) =====
  async function rpc(fnName, params = {}) {
    return rest(`/rpc/${fnName}`, {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  return {
    // ==================== DASHBOARD (ตัวหลัก) ====================
    async getDashboard(year, month) {
      // ดึงข้อมูลขนานกันเพื่อความเร็ว
      const [transactions, incomes, templates] = await Promise.all([
        rest(`/${TABLES.TRANSACTIONS}?year=eq.${year}&month=eq.${month}&order=id.asc`),
        rest(`/${TABLES.INCOMES}?year=eq.${year}&month=eq.${month}&order=id.asc`),
        rest(`/${TABLES.TEMPLATES}?order=id.asc`)
      ]);

      // ===== คำนวณ summary ฝั่ง client =====
      let totalPaid = 0, totalUnpaid = 0, totalNoBalance = 0, totalAll = 0;
      let totalIncome = 0;
      const byCategory = {};

      transactions.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        totalAll += amt;
        if (t.status === 'จ่ายแล้ว') totalPaid += amt;
        else if (t.status === 'ไม่มียอดค้าง') totalNoBalance += amt;
        else totalUnpaid += amt;

        if (!byCategory[t.category]) {
          byCategory[t.category] = { paid: 0, unpaid: 0, noBalance: 0, total: 0 };
        }
        byCategory[t.category].total += amt;
        if (t.status === 'จ่ายแล้ว') byCategory[t.category].paid += amt;
        else if (t.status === 'ไม่มียอดค้าง') byCategory[t.category].noBalance += amt;
        else byCategory[t.category].unpaid += amt;
      });

      incomes.forEach(inc => {
        totalIncome += parseFloat(inc.amount) || 0;
      });

      // ===== จัดกลุ่ม templates =====
      const categories = [...new Set(templates.map(t => t.category))];
      const incomeCategories = [
        'เงินเดือน', 'โบนัส/OT', 'รายได้เสริม/ฟรีแลนซ์',
        'ดอกเบี้ย/เงินปันผล', 'ขายของ', 'ได้รับ/ของขวัญ', 'อื่นๆ'
      ];

      return {
        transactions: transactions.map(t => ({
          id: t.id, year: t.year, month: t.month,
          category: t.category, item: t.item,
          amount: t.amount, status: t.status,
          dueDate: t.due_date || '',
          paidDate: t.paid_date || '',
          note: t.note || ''
        })),
        incomes: incomes.map(i => ({
          id: i.id, year: i.year, month: i.month,
          category: i.category, item: i.item,
          amount: i.amount,
          date: i.date || '',
          note: i.note || ''
        })),
        summary: {
          totalPaid, totalUnpaid, totalNoBalance, totalAll,
          byCategory, count: transactions.length,
          totalIncome, incomeCount: incomes.length,
          netBalance: totalIncome - totalAll,
          netAfterPaid: totalIncome - totalPaid
        },
        categories: { categories, incomeCategories }
      };
    },

    // ==================== YEARLY SUMMARY ====================
    async getYearlySummary(year) {
      const [transactions, incomes] = await Promise.all([
        rest(`/${TABLES.TRANSACTIONS}?year=eq.${year}&select=month,amount,category`),
        rest(`/${TABLES.INCOMES}?year=eq.${year}&select=month,amount`)
      ]);

      const byMonth = {}, byCategory = {}, incomeByMonth = {};
      transactions.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        byMonth[t.month] = (byMonth[t.month] || 0) + amt;
        byCategory[t.category] = (byCategory[t.category] || 0) + amt;
      });
      incomes.forEach(i => {
        const amt = parseFloat(i.amount) || 0;
        incomeByMonth[i.month] = (incomeByMonth[i.month] || 0) + amt;
      });

      const totalExpenseYear = Object.values(byMonth).reduce((a, b) => a + b, 0);
      const totalIncomeYear = Object.values(incomeByMonth).reduce((a, b) => a + b, 0);

      return {
        byMonth, byCategory, incomeByMonth,
        totalExpenseYear, totalIncomeYear,
        netYear: totalIncomeYear - totalExpenseYear
      };
    },

    // ==================== TRANSACTIONS CRUD ====================
    async addTransaction(d) {
      return rest(`/${TABLES.TRANSACTIONS}`, {
        method: 'POST',
        body: JSON.stringify({
          year: +d.year, month: +d.month,
          category: d.category, item: d.item,
          amount: parseFloat(d.amount),
          status: d.status || 'รอจ่าย',
          due_date: d.dueDate || null,
          paid_date: d.status === 'จ่ายแล้ว' 
            ? new Date().toISOString().split('T')[0] : null,
          note: d.note || ''
        })
      });
    },

    async updateTransaction(d) {
      return rest(`/${TABLES.TRANSACTIONS}?id=eq.${d.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          category: d.category, item: d.item,
          amount: parseFloat(d.amount),
          status: d.status,
          due_date: d.dueDate || null,
          paid_date: d.status === 'จ่ายแล้ว'
            ? new Date().toISOString().split('T')[0] : null,
          note: d.note || ''
        })
      });
    },

    async deleteTransaction(id) {
      return rest(`/${TABLES.TRANSACTIONS}?id=eq.${id}`, {
        method: 'DELETE'
      });
    },

    async markAsPaid(id) {
      return rest(`/${TABLES.TRANSACTIONS}?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'จ่ายแล้ว',
          paid_date: new Date().toISOString().split('T')[0]
        })
      });
    },

    async markAsUnpaid(id) {
      return rest(`/${TABLES.TRANSACTIONS}?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'รอจ่าย', paid_date: null })
      });
    },

    async markAsNoBalance(id) {
      return rest(`/${TABLES.TRANSACTIONS}?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ไม่มียอดค้าง', paid_date: null })
      });
    },

    // ==================== INCOMES CRUD ====================
    async addIncome(d) {
      return rest(`/${TABLES.INCOMES}`, {
        method: 'POST',
        body: JSON.stringify({
          year: +d.year, month: +d.month,
          category: d.category, item: d.item,
          amount: parseFloat(d.amount),
          date: d.date || new Date().toISOString().split('T')[0],
          note: d.note || ''
        })
      });
    },

    async updateIncome(d) {
      return rest(`/${TABLES.INCOMES}?id=eq.${d.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          category: d.category, item: d.item,
          amount: parseFloat(d.amount),
          date: d.date || null,
          note: d.note || ''
        })
      });
    },

    async deleteIncome(id) {
      return rest(`/${TABLES.INCOMES}?id=eq.${id}`, { method: 'DELETE' });
    },

    // ==================== GENERATE MONTH ====================
    async generateForMonth(year, month) {
      const result = await rpc('generate_monthly_transactions', {
        p_year: year, p_month: month
      });
      return { generated: result || 0 };
    },

    // Backward compatible stubs
    getTransactions: (y, m) => rest(`/${TABLES.TRANSACTIONS}?year=eq.${y}&month=eq.${m}`),
    getIncomes: (y, m) => rest(`/${TABLES.INCOMES}?year=eq.${y}&month=eq.${m}`),
  };
})();
