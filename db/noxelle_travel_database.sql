-- =============================================================
-- Noxelle Travel - Complete Database Setup
-- Current project scope: Authentication and Authorisation
-- =============================================================
-- This script creates the local database and the users table used
-- by app.js for registration, login, admin access and password reset.
--
-- LOCAL MYSQL:
-- Run this entire script in MySQL Workbench.
--
-- AZURE MYSQL:
-- Do not run CREATE DATABASE if your lecturer already created the
-- team database. Replace "USE noxelle_travel;" with:
-- USE c237_007_team4_travelplanner;
-- =============================================================

CREATE DATABASE IF NOT EXISTS noxelle_travel
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE noxelle_travel;

-- -------------------------------------------------------------
-- Users
-- Public registration creates a traveler account.
-- Admin accounts are created separately using create-admin.js.
-- Passwords are stored only as bcrypt hashes.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    userId           INT AUTO_INCREMENT PRIMARY KEY,
    fullName         VARCHAR(100) NOT NULL,
    email            VARCHAR(255) NOT NULL,
    passwordHash     VARCHAR(255) NOT NULL,
    role             VARCHAR(20) NOT NULL DEFAULT 'traveler',
    resetTokenHash   VARCHAR(64) NULL,
    resetTokenExpiry DATETIME NULL,
    createdAt        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_users_role CHECK (role IN ('traveler', 'admin')),
    INDEX idx_users_role (role),
    INDEX idx_users_reset_token (resetTokenHash)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Verification commands
-- -------------------------------------------------------------
SHOW TABLES;
DESCRIBE users;

-- -------------------------------------------------------------
-- Create the first administrator safely after importing this file:
-- node scripts/create-admin.js "Admin Name" admin@noxelle.travel
--
-- Do not insert a plain-text password into this SQL file.
-- -------------------------------------------------------------
