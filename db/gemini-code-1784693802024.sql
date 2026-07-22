USE c237_007_team4_travelplanner;

-- -------------------------------------------------------------
-- Expenses
-- Tracks traveler expenses with description, amount, category, 
-- and expense date, linked directly to the users table.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    expenseId   INT AUTO_INCREMENT PRIMARY KEY,
    userId      INT NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount      DECIMAL(10, 2) NOT NULL,
    category    VARCHAR(50) NOT NULL,
    expenseDate DATE NOT NULL,
    createdAt   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_expenses_users FOREIGN KEY (userId) REFERENCES users (userId) ON DELETE CASCADE,
    INDEX idx_expenses_user (userId)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;