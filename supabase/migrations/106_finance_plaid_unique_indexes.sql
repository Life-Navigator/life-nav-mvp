-- 106_finance_plaid_unique_indexes.sql
--
-- Plaid sync upserts on plaid_account_id / plaid_transaction_id, but those
-- columns had no unique constraint, so ON CONFLICT failed. Add full unique
-- indexes. The columns are nullable and Postgres treats NULLs as DISTINCT, so
-- manual (non-Plaid) accounts/transactions with NULL ids are unaffected.

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_accounts_plaid_account_id
  ON finance.financial_accounts (plaid_account_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_plaid_transaction_id
  ON finance.transactions (plaid_transaction_id);
