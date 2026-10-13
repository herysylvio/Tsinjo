ALTER TABLE accounts ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
UPDATE accounts SET sort_order = sub.rn FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY is_default DESC, created_at) AS rn
  FROM accounts
) sub WHERE accounts.id = sub.id;