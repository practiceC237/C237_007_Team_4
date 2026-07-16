-- ==================================================
-- Noxelle Travel — users table migration
-- Run this in MySQL Workbench (or on Azure MySQL).
-- No real passwords or secrets are stored in this file.
-- ==================================================

CREATE DATABASE IF NOT EXISTS noxelle_travel;
USE noxelle_travel;
-- (When importing into Azure, remove the two lines above
--  and select your team's database instead — see Lesson 20.)

CREATE TABLE IF NOT EXISTS users (
    userId       INT AUTO_INCREMENT PRIMARY KEY,
    fullName     VARCHAR(100)  NOT NULL,
    email        VARCHAR(255)  NOT NULL UNIQUE,
    passwordHash VARCHAR(255)  NOT NULL,
    role         VARCHAR(20)   NOT NULL DEFAULT 'traveler',
    resetTokenHash   VARCHAR(64)  NULL,
    resetTokenExpiry DATETIME     NULL,
    createdAt    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- First admin account:
-- Do NOT insert an admin with a plain-text or hand-made hash here.
-- Instead run the helper script, which bcrypt-hashes the password:
--
--   node scripts/create-admin.js "Admin Name" admin@noxelle.travel
--
-- The script prompts for the password so it never appears in a file
-- or in your shell history.
