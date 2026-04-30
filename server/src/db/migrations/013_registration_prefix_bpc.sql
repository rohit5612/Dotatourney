-- Align default registration public-code prefix with BPC League branding (short code: BPC).
ALTER TABLE tournaments ALTER COLUMN registration_code_prefix SET DEFAULT 'BPC';
