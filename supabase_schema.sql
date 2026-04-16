-- ============================================================
-- SBA ACCOUNTING SUITE — SUPABASE DATABASE SCHEMA
-- Run this in Supabase SQL Editor (in order)
-- ============================================================

-- 1. ORGANISATIONS
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert SBA and Dwarka
INSERT INTO organisations (name, short_name, address, phone, email) VALUES
('Saket Bar Association', 'SBA', 'Saket Court Complex, Saket, New Delhi - 110017', '011-47586747', 'saketbarassociation@gmail.com'),
('Dwarka Court Bar Association', 'DCBA', 'Dwarka Court Complex, Dwarka, New Delhi', '', '');

-- 2. USER ROLES TABLE (links Supabase auth users to orgs with roles)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'cashier', 'management')),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, org_id)
);

-- 3. CHART OF ACCOUNTS
CREATE TABLE account_heads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expenditure', 'balance_sheet')),
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE account_sub_heads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  head_id UUID NOT NULL REFERENCES account_heads(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BANK ACCOUNTS
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT,
  account_type TEXT,
  opening_balance NUMERIC(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CASHIER CASH ACCOUNTS
CREATE TABLE cash_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  cashier_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  opening_balance NUMERIC(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. VENDOR CATEGORIES
CREATE TABLE vendor_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  income_sub_head_id UUID REFERENCES account_sub_heads(id),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

-- 7. VENDORS (Spaces/Tenants)
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES vendor_categories(id),
  name TEXT NOT NULL,
  floor TEXT,
  location TEXT,
  mobile TEXT,
  monthly_rent NUMERIC(10,2) DEFAULT 0,
  security_deposit NUMERIC(10,2) DEFAULT 0,
  opening_arrears NUMERIC(10,2) DEFAULT 0,
  arrears_as_of DATE,
  paid_upto_month INTEGER,
  paid_upto_year INTEGER,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'vacant', 'closed')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. RENT COLLECTIONS
CREATE TABLE rent_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  receipt_no TEXT,
  collection_date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_mode TEXT CHECK (payment_mode IN ('cash', 'cheque', 'upi', 'card', 'neft')),
  months_covered TEXT,
  from_month INTEGER,
  from_year INTEGER,
  to_month INTEGER,
  to_year INTEGER,
  collected_by UUID REFERENCES auth.users(id),
  bank_account_id UUID REFERENCES bank_accounts(id),
  cash_account_id UUID REFERENCES cash_accounts(id),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. RENT WAIVERS
CREATE TABLE rent_waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  waiver_date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  from_month INTEGER,
  from_year INTEGER,
  to_month INTEGER,
  to_year INTEGER,
  reason TEXT NOT NULL,
  approved_by TEXT,
  waived_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. INCOME REGISTER (non-rent)
CREATE TABLE income_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  head_id UUID REFERENCES account_heads(id),
  sub_head_id UUID REFERENCES account_sub_heads(id),
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  receipt_no TEXT,
  payment_mode TEXT,
  bank_account_id UUID REFERENCES bank_accounts(id),
  cash_account_id UUID REFERENCES cash_accounts(id),
  entered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. EXPENDITURE REGISTER
CREATE TABLE expenditure_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  head_id UUID REFERENCES account_heads(id),
  sub_head_id UUID REFERENCES account_sub_heads(id),
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  voucher_no TEXT,
  payment_mode TEXT,
  bank_account_id UUID REFERENCES bank_accounts(id),
  cash_account_id UUID REFERENCES cash_accounts(id),
  cheque_no TEXT,
  payee_name TEXT,
  entered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. STAFF
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  designation TEXT,
  gross_salary NUMERIC(10,2),
  esi_employee NUMERIC(8,2) DEFAULT 0,
  pf_employee NUMERIC(8,2) DEFAULT 0,
  esi_employer NUMERIC(8,2) DEFAULT 0,
  pf_employer NUMERIC(8,2) DEFAULT 0,
  bank_account_no TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. SALARY PAYMENTS
CREATE TABLE salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id),
  pay_month INTEGER NOT NULL,
  pay_year INTEGER NOT NULL,
  gross_salary NUMERIC(10,2),
  days_present INTEGER,
  days_absent INTEGER,
  due_salary NUMERIC(10,2),
  esi_employee NUMERIC(8,2) DEFAULT 0,
  pf_employee NUMERIC(8,2) DEFAULT 0,
  advance_deduction NUMERIC(10,2) DEFAULT 0,
  loan_deduction NUMERIC(10,2) DEFAULT 0,
  other_deduction NUMERIC(10,2) DEFAULT 0,
  net_payable NUMERIC(10,2),
  payment_date DATE,
  bank_account_id UUID REFERENCES bank_accounts(id),
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. SALARY ADVANCES
CREATE TABLE salary_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id),
  advance_date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  purpose TEXT,
  recovery_per_month NUMERIC(10,2),
  balance_outstanding NUMERIC(10,2),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. EXPERIENCE LETTERS
CREATE TABLE experience_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  letter_no TEXT NOT NULL,
  issue_date DATE NOT NULL,
  member_name TEXT NOT NULL,
  father_name TEXT,
  enrollment_no TEXT,
  enrollment_date DATE,
  purpose TEXT,
  signatory_name TEXT,
  signatory_designation TEXT,
  generated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_sub_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_waivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenditure_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE experience_letters ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their org data
CREATE POLICY "Users can view their org data" ON organisations
  FOR SELECT USING (
    id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE)
  );

CREATE POLICY "Users can view their roles" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Generic org-based policies for all tables
CREATE POLICY "Org members can view" ON account_heads FOR SELECT USING (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE));
CREATE POLICY "Org members can view" ON account_sub_heads FOR SELECT USING (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE));
CREATE POLICY "Org members can view" ON bank_accounts FOR SELECT USING (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE));
CREATE POLICY "Org members can view" ON cash_accounts FOR SELECT USING (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE));
CREATE POLICY "Org members can view" ON vendor_categories FOR SELECT USING (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE));
CREATE POLICY "Org members can view" ON vendors FOR SELECT USING (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE));
CREATE POLICY "Org members can view" ON rent_collections FOR SELECT USING (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE));
CREATE POLICY "Org members can view" ON rent_waivers FOR SELECT USING (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE));
CREATE POLICY "Org members can view" ON income_entries FOR SELECT USING (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE));
CREATE POLICY "Org members can view" ON expenditure_entries FOR SELECT USING (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE));
CREATE POLICY "Org members can view" ON staff FOR SELECT USING (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE));
CREATE POLICY "Org members can view" ON salary_payments FOR SELECT USING (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE));
CREATE POLICY "Org members can view" ON salary_advances FOR SELECT USING (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE));
CREATE POLICY "Org members can view" ON experience_letters FOR SELECT USING (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE));

-- Insert/Update policies (admin + cashier, not management)
CREATE POLICY "Active members can insert" ON rent_collections FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE AND role IN ('admin','cashier')));
CREATE POLICY "Active members can insert" ON expenditure_entries FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE AND role IN ('admin','cashier')));
CREATE POLICY "Active members can insert" ON income_entries FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE AND role IN ('admin','cashier')));
CREATE POLICY "Active members can insert" ON salary_payments FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE AND role IN ('admin','cashier')));
CREATE POLICY "Active members can insert" ON experience_letters FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE AND role IN ('admin','cashier')));
CREATE POLICY "Active members can insert" ON rent_waivers FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE AND role IN ('admin','cashier')));

-- Admin only policies
CREATE POLICY "Admin can manage heads" ON account_heads FOR ALL USING (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE AND role = 'admin'));
CREATE POLICY "Admin can manage sub heads" ON account_sub_heads FOR ALL USING (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE AND role = 'admin'));
CREATE POLICY "Admin can manage vendors" ON vendors FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE AND role IN ('admin','cashier')));
CREATE POLICY "Admin can update vendors" ON vendors FOR UPDATE USING (org_id IN (SELECT org_id FROM user_roles WHERE user_id = auth.uid() AND is_active = TRUE AND role = 'admin'));

-- ============================================================
-- SEED DATA — SBA Chart of Accounts
-- ============================================================

-- Get SBA org id for seeding
DO $$
DECLARE
  sba_id UUID;
BEGIN
  SELECT id INTO sba_id FROM organisations WHERE short_name = 'SBA';

  -- INCOME HEADS
  INSERT INTO account_heads (org_id, type, name, sort_order) VALUES
  (sba_id, 'income', 'Membership Income', 1),
  (sba_id, 'income', 'Vendor Rent Income', 2),
  (sba_id, 'income', 'Canopy Income', 3),
  (sba_id, 'income', 'Utility Reimbursements', 4),
  (sba_id, 'income', 'Welfare Income', 5),
  (sba_id, 'income', 'Miscellaneous Income', 6);

  -- EXPENDITURE HEADS
  INSERT INTO account_heads (org_id, type, name, sort_order) VALUES
  (sba_id, 'expenditure', 'Staff Salary', 1),
  (sba_id, 'expenditure', 'Staff Welfare', 2),
  (sba_id, 'expenditure', 'Financial Assistance to Members', 3),
  (sba_id, 'expenditure', 'Functions & Celebrations', 4),
  (sba_id, 'expenditure', 'Printing & Stationery', 5),
  (sba_id, 'expenditure', 'Utilities & Communications', 6),
  (sba_id, 'expenditure', 'Repairs & Maintenance', 7),
  (sba_id, 'expenditure', 'Miscellaneous Expenditure', 8);

  -- BALANCE SHEET HEADS
  INSERT INTO account_heads (org_id, type, name, sort_order) VALUES
  (sba_id, 'balance_sheet', 'Security Deposits Received', 1),
  (sba_id, 'balance_sheet', 'Salary Advances to Staff', 2),
  (sba_id, 'balance_sheet', 'PF Payable', 3),
  (sba_id, 'balance_sheet', 'ESI Payable', 4);

  -- SUB HEADS — Membership Income
  INSERT INTO account_sub_heads (org_id, head_id, name, sort_order)
  SELECT sba_id, id, sub, ord FROM account_heads,
    (VALUES ('Admission Fees',1),('Annual Subscription',2),('I-Card Fees',3),('Vehicle Sticker Sales',4)) AS t(sub,ord)
  WHERE name = 'Membership Income' AND org_id = sba_id;

  -- SUB HEADS — Vendor Rent Income
  INSERT INTO account_sub_heads (org_id, head_id, name, sort_order)
  SELECT sba_id, id, sub, ord FROM account_heads,
    (VALUES ('Typists',1),('Photostat Vendors',2),('Tea Stalls',3),('Stationery',4),('Canteen & Kiosks',5)) AS t(sub,ord)
  WHERE name = 'Vendor Rent Income' AND org_id = sba_id;

  -- SUB HEADS — Utility Reimbursements
  INSERT INTO account_sub_heads (org_id, head_id, name, sort_order)
  SELECT sba_id, id, sub, ord FROM account_heads,
    (VALUES ('BSES',1),('PNG',2)) AS t(sub,ord)
  WHERE name = 'Utility Reimbursements' AND org_id = sba_id;

  -- SUB HEADS — Welfare Income
  INSERT INTO account_sub_heads (org_id, head_id, name, sort_order)
  SELECT sba_id, id, sub, ord FROM account_heads,
    (VALUES ('Sale of Welfare Stamps',1),('Welfare Fund Collections',2)) AS t(sub,ord)
  WHERE name = 'Welfare Income' AND org_id = sba_id;

  -- SUB HEADS — Staff Salary
  INSERT INTO account_sub_heads (org_id, head_id, name, sort_order)
  SELECT sba_id, id, sub, ord FROM account_heads,
    (VALUES ('Cashier',1),('Sub Staff',2),('Library Staff',3),('Homeopathic Doctor',4)) AS t(sub,ord)
  WHERE name = 'Staff Salary' AND org_id = sba_id;

  -- SUB HEADS — Staff Welfare
  INSERT INTO account_sub_heads (org_id, head_id, name, sort_order)
  SELECT sba_id, id, sub, ord FROM account_heads,
    (VALUES ('PF Contribution',1),('ESI Contribution',2)) AS t(sub,ord)
  WHERE name = 'Staff Welfare' AND org_id = sba_id;

  -- SUB HEADS — Functions & Celebrations
  INSERT INTO account_sub_heads (org_id, head_id, name, sort_order)
  SELECT sba_id, id, sub, ord FROM account_heads,
    (VALUES ('Diwali',1),('Holi',2),('Republic Day',3),('Independence Day',4),('Other Festivals',5)) AS t(sub,ord)
  WHERE name = 'Functions & Celebrations' AND org_id = sba_id;

  -- SUB HEADS — Utilities
  INSERT INTO account_sub_heads (org_id, head_id, name, sort_order)
  SELECT sba_id, id, sub, ord FROM account_heads,
    (VALUES ('Electricity',1),('Phone',2),('Internet',3)) AS t(sub,ord)
  WHERE name = 'Utilities & Communications' AND org_id = sba_id;

  -- BANK ACCOUNTS
  INSERT INTO bank_accounts (org_id, account_name, bank_name, account_number, account_type) VALUES
  (sba_id, 'SBA Current Account', 'State Bank of India', 'XXXXXX14849', 'Current'),
  (sba_id, 'SBA Welfare Fund Account', 'State Bank of India', 'XXXXXX85000', 'Savings');

  -- CASH ACCOUNTS
  INSERT INTO cash_accounts (org_id, cashier_name) VALUES
  (sba_id, 'Aftab Alam'),
  (sba_id, 'Surendra Singh');

  -- VENDOR CATEGORIES
  INSERT INTO vendor_categories (org_id, name, sort_order) VALUES
  (sba_id, 'Typist Pool 1', 1),
  (sba_id, 'Typist Pool 2', 2),
  (sba_id, 'Photostat Vendor', 3),
  (sba_id, 'Tea Stall', 4),
  (sba_id, 'Stationery', 5),
  (sba_id, 'Canteen / Kiosk', 6);

END $$;
