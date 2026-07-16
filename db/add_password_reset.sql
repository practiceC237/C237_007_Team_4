-- ==================================================
-- Noxelle Travel — add password-reset columns
-- Run this ONLY if your users table already exists
-- (e.g. on the Azure database) and does not yet have
-- these two columns. New installs don't need it —
-- the main migration already includes them.
-- ==================================================
ALTER TABLE users
    ADD COLUMN resetTokenHash   VARCHAR(64) NULL,
    ADD COLUMN resetTokenExpiry DATETIME    NULL;
