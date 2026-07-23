-- =============================================================
-- Local database script for JourneySpark Travel Planner
-- Includes: Users table and Packing Items table with sample data.
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
-- Packing Items Table
-- Stores individual packing list items linked to a trip.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS packing_items (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    trip_id     INT NOT NULL DEFAULT 1,
    item_name   VARCHAR(255) NOT NULL,
    category    VARCHAR(100) NOT NULL DEFAULT 'Misc',
    quantity    INT NOT NULL DEFAULT 1,
    is_packed   TINYINT(1) NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_packing_trip (trip_id)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Initial Seed Data for Packing List (Trip ID: 1)
-- -------------------------------------------------------------
INSERT INTO packing_items (trip_id, item_name, category, quantity, is_packed) 
VALUES 
    (1, 'Passport & Visa Documents', 'Documents', 1, 1),
    (1, 'Phone Charger & Power Bank', 'Electronics', 1, 0),
    (1, 'Cotton T-Shirts', 'Clothing', 5, 0),
    (1, 'Toothbrush & Toothpaste', 'Toiletries', 1, 1),
    (1, 'Universal Travel Adapter', 'Electronics', 1, 0);

-- -------------------------------------------------------------
-- Verification Commands
-- -------------------------------------------------------------
SHOW TABLES;
DESCRIBE users;
DESCRIBE packing_items;
SELECT * FROM packing_items;
DESCRIBE trips;
DESCRIBE trip_share;