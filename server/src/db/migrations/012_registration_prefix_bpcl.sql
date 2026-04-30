-- Rebrand: default registration public-code prefix for new tournament rows
ALTER TABLE tournaments ALTER COLUMN registration_code_prefix SET DEFAULT 'BPCL';
