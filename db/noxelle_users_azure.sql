-- ==================================================
-- Noxelle Travel — users table (AZURE VERSION)
-- Lesson 20: no CREATE DATABASE / USE statements here.
-- In MySQL Workbench, connect to Azure, select your team
-- database (c237_007_team4_travelplanner) as the default
-- schema, then run this script.
-- ==================================================

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

-- First admin account: run  node scripts/create-admin.js "Admin Name" admin@email.com
-- (with the Azure values in .env) — it prompts for the password,
-- bcrypt-hashes it, and inserts with role = 'admin'.
