-- =========================================
-- 🔧 แปลง Database ให้ใช้แบบไม่มี Auth
-- =========================================

-- 1. ลบ trigger ที่ผูกกับ auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trg_templates_user ON templates;
DROP TRIGGER IF EXISTS trg_trans_user ON transactions;
DROP TRIGGER IF EXISTS trg_income_user ON incomes;

-- 2. ลบฟังก์ชันที่เกี่ยวข้อง
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS seed_default_templates(UUID) CASCADE;
DROP FUNCTION IF EXISTS set_user_id() CASCADE;

-- 3. ลบตารางเดิม แล้วสร้างใหม่ (ไม่มี user_id)
DROP TABLE IF EXISTS templates CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS incomes CASCADE;

-- ========== Templates ==========
CREATE TABLE templates (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  item TEXT NOT NULL UNIQUE,
  default_amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== Transactions ==========
CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  category TEXT NOT NULL,
  item TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'รอจ่าย'
    CHECK (status IN ('รอจ่าย','จ่ายแล้ว','ไม่มียอดค้าง')),
  due_date DATE,
  paid_date DATE,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_trans_unique
  ON transactions(year, month, item);
CREATE INDEX idx_trans_year_month ON transactions(year, month);

-- ========== Incomes ==========
CREATE TABLE incomes (
  id BIGSERIAL PRIMARY KEY,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  category TEXT NOT NULL,
  item TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  date DATE DEFAULT CURRENT_DATE,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_income_year_month ON incomes(year, month);

-- ========== RLS: เปิดให้ anon key อ่าน/เขียนได้ ==========
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_anon_all" ON templates
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "trans_anon_all" ON transactions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "income_anon_all" ON incomes
  FOR ALL USING (true) WITH CHECK (true);

-- ========== updated_at trigger ==========
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trans_updated
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_income_updated
  BEFORE UPDATE ON incomes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========== generate_monthly_transactions (ไม่ต้องใช้ auth) ==========
CREATE OR REPLACE FUNCTION generate_monthly_transactions(p_year INT, p_month INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INT := 0;
BEGIN
  INSERT INTO transactions (year, month, category, item, amount, status, due_date)
  SELECT
    p_year,
    p_month,
    t.category,
    t.item,
    t.default_amount,
    CASE WHEN t.default_amount = 0 THEN 'ไม่มียอดค้าง' ELSE 'รอจ่าย' END,
    make_date(p_year, p_month, 5)
  FROM templates t
  ON CONFLICT (year, month, item) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

-- ========== Seed templates เริ่มต้น ==========
INSERT INTO templates (category, item, default_amount) VALUES
  ('ที่พักอาศัย', 'ค่าห้อง', 2200),
  ('ที่พักอาศัย', 'ค่าบ้าน', 8000),
  ('สาธารณูปโภค', 'ค่าเน็ต AIS', 319),
  ('สาธารณูปโภค', 'ค่าเน็ตทรู', 533.93),
  ('สาธารณูปโภค', 'ค่าน้ำ', 0),
  ('สาธารณูปโภค', 'ค่าไฟห้องเช่า', 0),
  ('สาธารณูปโภค', 'ค่าไฟบ้านใหม่', 0),
  ('สาธารณูปโภค', 'ค่าไฟแม่', 0),
  ('สาธารณูปโภค', 'เคเบิล', 200),
  ('โทรศัพท์', 'ค่าโทรเมย์', 200),
  ('โทรศัพท์', 'ค่าโทรเทพ', 416),
  ('โทรศัพท์', 'ค่าโทรตาล', 0),
  ('โทรศัพท์', 'ค่าโทรแม่', 0),
  ('ประกัน', 'ประกันสังคมเมย์', 431),
  ('ยานพาหนะ', 'ที่จอดรถ', 700),
  ('บัตรเครดิต/สินเชื่อ', 'KTC', 0),
  ('บัตรเครดิต/สินเชื่อ', 'K PLUS', 0),
  ('บัตรเครดิต/สินเชื่อ', 'PTT', 0),
  ('บัตรเครดิต/สินเชื่อ', 'TMB FAST', 0),
  ('บัตรเครดิต/สินเชื่อ', 'TMB Smart', 0),
  ('บัตรเครดิต/สินเชื่อ', 'SCB Card', 0),
  ('บัตรเครดิต/สินเชื่อ', 'KPTT', 0),
  ('ช้อปปิ้งออนไลน์', 'Lotus', 0),
  ('ช้อปปิ้งออนไลน์', 'Lazada', 0),
  ('ช้อปปิ้งออนไลน์', 'Shoppee', 0),
  ('ให้ครอบครัว', 'ให้เมีย', 10000),
  ('ให้ครอบครัว', 'ให้แม่', 0),
  ('เงินออม/ลงทุน', 'เงินเก็บ', 0),
  ('เงินออม/ลงทุน', 'เงินออม', 2000),
  ('อื่นๆ', 'Lottery', 0),
  ('อื่นๆ', 'F Chouse', 0)
ON CONFLICT (item) DO NOTHING;

SELECT 'Done! Schema updated to no-auth mode' AS status;
