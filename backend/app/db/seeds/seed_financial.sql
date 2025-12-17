-- =============================================================================
-- Life Navigator - Financial Database Seed Data
-- =============================================================================
-- Seeds: Financial Accounts, Transactions, Budgets, Investments
-- Run on: ln-finance-db-beta / lifenavigator_finance
-- NOTE: Uses same tenant_id and user_id as Core database for cross-reference
-- =============================================================================

-- Demo user/tenant IDs (must match Core database)
-- tenant_id: b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
-- user_id: c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11

-- Create financial accounts
INSERT INTO financial_accounts (id, tenant_id, user_id, account_name, account_type, institution_name, account_number_last4, currency, current_balance, available_balance, status, is_manual)
VALUES
    -- Primary Checking
    ('11eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'Primary Checking', 'checking', 'Chase Bank', '4567', 'USD', 5432.18, 5432.18, 'active', true),
    -- Emergency Fund Savings
    ('12eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'Emergency Fund', 'savings', 'Marcus by Goldman Sachs', '8901', 'USD', 15000.00, 15000.00, 'active', true),
    -- Credit Card
    ('13eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'Chase Sapphire Preferred', 'credit_card', 'Chase Bank', '2345', 'USD', -1250.00, 8750.00, 'active', true),
    -- Investment Account
    ('14eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'Fidelity Brokerage', 'investment', 'Fidelity Investments', '6789', 'USD', 45678.90, 45678.90, 'active', true),
    -- 401k
    ('15eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '401(k) Retirement', 'retirement', 'Fidelity Investments', '1234', 'USD', 125000.00, 125000.00, 'active', true);

-- Update credit card with additional fields
UPDATE financial_accounts SET credit_limit = 10000.00, interest_rate = 19.99, minimum_payment = 35.00 WHERE id = '13eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
UPDATE financial_accounts SET interest_rate = 4.50 WHERE id = '12eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

-- Create sample transactions (last 30 days)
INSERT INTO transactions (id, tenant_id, user_id, account_id, transaction_date, amount, currency, description, merchant_name, category, subcategory, transaction_type, is_recurring, is_pending)
VALUES
    -- Income
    ('0a01ebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '11eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', (CURRENT_DATE - INTERVAL '15 days')::date, 4500.00, 'USD', 'Direct Deposit - Salary',
     'Tech Corp Inc', 'Income', 'Salary', 'credit', true, false),
    ('0a02ebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '11eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', (CURRENT_DATE - INTERVAL '45 days')::date, 4500.00, 'USD', 'Direct Deposit - Salary',
     'Tech Corp Inc', 'Income', 'Salary', 'credit', true, false),
    -- Groceries
    ('0a03ebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '11eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', (CURRENT_DATE - INTERVAL '2 days')::date, 127.43, 'USD', 'Whole Foods Market',
     'Whole Foods', 'Groceries', 'Supermarket', 'debit', false, false),
    ('0a04ebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '11eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', (CURRENT_DATE - INTERVAL '9 days')::date, 89.76, 'USD', 'Trader Joes',
     'Trader Joes', 'Groceries', 'Supermarket', 'debit', false, false),
    -- Restaurants
    ('0a05ebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '13eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', (CURRENT_DATE - INTERVAL '1 day')::date, 45.67, 'USD', 'DoorDash - Thai Food',
     'DoorDash', 'Food & Drink', 'Restaurants', 'debit', false, true),
    ('0a06ebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '13eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', (CURRENT_DATE - INTERVAL '4 days')::date, 5.75, 'USD', 'Starbucks',
     'Starbucks', 'Food & Drink', 'Coffee', 'debit', false, false),
    ('0a07ebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '13eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', (CURRENT_DATE - INTERVAL '7 days')::date, 78.45, 'USD', 'Nice Restaurant',
     'Local Restaurant', 'Food & Drink', 'Restaurants', 'debit', false, false),
    -- Utilities (Recurring)
    ('0a08ebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '11eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', (CURRENT_DATE - INTERVAL '5 days')::date, 125.00, 'USD', 'PG&E Electric',
     'PG&E', 'Utilities', 'Electric', 'debit', true, false),
    ('0a09ebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '11eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', (CURRENT_DATE - INTERVAL '6 days')::date, 89.99, 'USD', 'Comcast Internet',
     'Comcast', 'Utilities', 'Internet', 'debit', true, false),
    -- Entertainment
    ('0a10ebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '13eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', (CURRENT_DATE - INTERVAL '10 days')::date, 15.99, 'USD', 'Netflix',
     'Netflix', 'Entertainment', 'Streaming', 'debit', true, false),
    ('0a11ebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '13eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', (CURRENT_DATE - INTERVAL '10 days')::date, 10.99, 'USD', 'Spotify',
     'Spotify', 'Entertainment', 'Music', 'debit', true, false),
    -- Shopping
    ('0a12ebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '13eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', (CURRENT_DATE - INTERVAL '3 days')::date, 156.78, 'USD', 'Amazon.com',
     'Amazon', 'Shopping', 'Online', 'debit', false, false),
    -- Transportation
    ('0a13ebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '11eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', (CURRENT_DATE - INTERVAL '8 days')::date, 65.00, 'USD', 'Shell Gas Station',
     'Shell', 'Transportation', 'Gas', 'debit', false, false),
    -- Transfer to savings
    ('0a14ebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '11eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', (CURRENT_DATE - INTERVAL '14 days')::date, 500.00, 'USD', 'Transfer to Emergency Fund',
     'Internal Transfer', 'Transfer', 'Savings', 'transfer', true, false),
    ('0a15ebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '12eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', (CURRENT_DATE - INTERVAL '14 days')::date, 500.00, 'USD', 'Transfer from Checking',
     'Internal Transfer', 'Transfer', 'Savings', 'credit', true, false);

-- Create budgets
INSERT INTO budgets (id, tenant_id, user_id, name, category, amount, period, currency, start_date, alert_threshold, alert_enabled, status)
VALUES
    ('21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'Groceries Budget', 'Groceries', 600.00, 'monthly', 'USD', DATE_TRUNC('month', CURRENT_DATE)::date, 0.80, true, 'active'),
    ('22eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'Dining Out Budget', 'Food & Drink', 300.00, 'monthly', 'USD', DATE_TRUNC('month', CURRENT_DATE)::date, 0.80, true, 'active'),
    ('23eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'Entertainment Budget', 'Entertainment', 200.00, 'monthly', 'USD', DATE_TRUNC('month', CURRENT_DATE)::date, 0.80, true, 'active'),
    ('24eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'Shopping Budget', 'Shopping', 400.00, 'monthly', 'USD', DATE_TRUNC('month', CURRENT_DATE)::date, 0.80, true, 'active'),
    ('25eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'Transportation Budget', 'Transportation', 250.00, 'monthly', 'USD', DATE_TRUNC('month', CURRENT_DATE)::date, 0.80, true, 'active');

-- Create investments
INSERT INTO investments (id, tenant_id, user_id, account_id, symbol, name, investment_type, quantity, cost_basis, current_price, current_value, currency, total_return_percentage, purchase_date)
VALUES
    ('31eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '14eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'VTI', 'Vanguard Total Stock Market ETF', 'etf', 100.00, 200.00, 245.50, 24550.00, 'USD', 22.75, (CURRENT_DATE - INTERVAL '365 days')::date),
    ('32eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '14eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'VXUS', 'Vanguard Total International Stock ETF', 'etf', 150.00, 55.00, 58.25, 8737.50, 'USD', 5.91, (CURRENT_DATE - INTERVAL '365 days')::date),
    ('33eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '14eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'BND', 'Vanguard Total Bond Market ETF', 'etf', 100.00, 78.00, 72.50, 7250.00, 'USD', -7.05, (CURRENT_DATE - INTERVAL '365 days')::date),
    ('34eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '14eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'AAPL', 'Apple Inc', 'stock', 25.00, 150.00, 185.50, 4637.50, 'USD', 23.67, (CURRENT_DATE - INTERVAL '180 days')::date),
    ('35eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '15eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'FXAIX', 'Fidelity 500 Index Fund', 'mutual_fund', 250.00, 145.00, 178.00, 44500.00, 'USD', 22.76, (CURRENT_DATE - INTERVAL '1095 days')::date);

-- Create tax document record for upcoming tax season
INSERT INTO tax_documents (id, tenant_id, user_id, document_type, tax_year, issuer_name, status)
VALUES
    ('0d1ebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'w2', 2024, 'Tech Corp Inc', 'expected'),
    ('0d2ebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '1099_div', 2024, 'Fidelity Investments', 'expected'),
    ('0d3ebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     '1099_int', 2024, 'Marcus by Goldman Sachs', 'expected');

-- Create financial audit log entry
INSERT INTO financial_audit_logs (id, tenant_id, user_id, target_user_id, event_type, event_action, event_description, resource_type, pii_accessed, payment_amount, payment_currency)
VALUES
    ('0f1ebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '21eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
     'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'system.seed', 'create', 'Initial seed data creation for financial records',
     'financial_accounts', true, NULL, NULL);

-- Summary
SELECT 'Financial database seeded successfully!' as status;
SELECT COUNT(*) as accounts FROM financial_accounts;
SELECT COUNT(*) as transactions FROM transactions;
SELECT COUNT(*) as budgets FROM budgets;
SELECT COUNT(*) as investments FROM investments;
SELECT SUM(current_balance) as total_checking_savings FROM financial_accounts WHERE account_type IN ('checking', 'savings');
SELECT SUM(current_value) as total_investments FROM investments;
