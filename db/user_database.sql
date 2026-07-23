-- =============================================================
-- This script creates the local database and the users table used
-- by app.js for registration, login, admin access and password reset.
-- =============================================================

CREATE DATABASE IF NOT EXISTS c237_007_team4_travelplanner
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE c237_007_team4_travelplanner;

-- -------------------------------------------------------------
-- Users
-- Website only can registration a traveler account.
-- Admin accounts are created using mysql database.
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
-- Trips
-- One row per trip a traveler plans. `destination` is free text
-- (not a lookup table) — admins can browse/rename these values
-- from the Manage Destinations page.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trips (
    tripId      INT AUTO_INCREMENT PRIMARY KEY,
    userId      INT NOT NULL,
    tripName    VARCHAR(150) NOT NULL,
    destination VARCHAR(150) NOT NULL,
    startDate   DATE NOT NULL,
    endDate     DATE NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'Upcoming',
    image       VARCHAR(255) NULL,
    createdAt   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_trips_user FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
    INDEX idx_trips_user (userId),
    INDEX idx_trips_destination (destination)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Trip shares
-- Tracks a trip being shared with another user, and whether
-- they've accepted.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trip_share (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    trip_id   INT NOT NULL,
    user_id   INT NOT NULL,
    status    VARCHAR(20) NOT NULL DEFAULT 'Pending',
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_trip_share_trip FOREIGN KEY (trip_id) REFERENCES trips(tripId) ON DELETE CASCADE,
    CONSTRAINT fk_trip_share_user FOREIGN KEY (user_id) REFERENCES users(userId) ON DELETE CASCADE,
    INDEX idx_trip_share_user (user_id)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Verification commands
-- -------------------------------------------------------------
SHOW TABLES;
DESCRIBE users;
DESCRIBE trips;
DESCRIBE trip_share;