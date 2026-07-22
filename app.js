// ==================================================
// Authentication, Authorization & Budget Management
// ==================================================

require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

// ==================================================
// Database Connection
// ==================================================
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined
});

db.connect((err) => {
    if (err) {
        console.error('Could not connect to MySQL:', err.message);
        console.error('Check your .env values (and DB_SSL=true for Azure).');
    } else {
        console.log('Connected to MySQL database.');
    }
});

db.on('error', (err) => {
    console.error('MySQL connection error:', err.message);
});

// ==================================================
// App Setup
// ==================================================
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24
    }
}));

app.use(flash());

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// ==================================================
// Middleware
// ==================================================
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const passwordRequirementsMessage = 'Password must contain at least 8 characters, including one uppercase letter, one lowercase letter, one number and one symbol.';

const validateRegistration = (req, res, next) => {
    const { fullName, password, confirmPassword } = req.body;
    const email = (req.body.email || '').trim().toLowerCase();
    const errors = [];

    if (!fullName || !fullName.trim()) errors.push('Full name is required.');
    if (!email) errors.push('Email address is required.');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Please enter a valid email address.');
    if (!password) errors.push('Password is required.');
    else if (!strongPasswordRegex.test(password)) errors.push(passwordRequirementsMessage);
    if (!confirmPassword) errors.push('Please confirm your password.');
    else if (password && password !== confirmPassword) errors.push('Password and confirm password do not match.');

    if (errors.length > 0) {
        req.flash('error', errors);
        req.flash('formData', { fullName, email });
        return res.redirect('/register');
    }

    req.body.email = email;
    next();
};

const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    req.flash('error', 'Please log in to access this page');
    res.redirect('/login');
};

const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    req.flash('error', "You don't have permission to access that page.");
    res.redirect('/');
};

// ==================================================
// Public Routes
// ==================================================
app.get('/', (req, res) => {
    res.render('index', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

// ---------- Registration ----------
app.get('/register', (req, res) => {
    const saved = req.flash('formData');
    res.render('register', {
        messages: req.flash('success'),
        errors: req.flash('error'),
        formData: saved.length > 0 ? saved[0] : {}
    });
});

app.post('/register', validateRegistration, (req, res) => {
    const { fullName, email, password } = req.body;

    const checkSql = 'SELECT userId FROM users WHERE email = ?';
    db.query(checkSql, [email], (err, results) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Something went wrong. Please try again.');
            return res.redirect('/register');
        }
        if (results.length > 0) {
            req.flash('error', 'This email is already registered. Please log in instead.');
            req.flash('formData', { fullName, email });
            return res.redirect('/register');
        }

        bcrypt.hash(password, 10, (hashErr, passwordHash) => {
            if (hashErr) {
                console.error(hashErr);
                req.flash('error', 'Something went wrong. Please try again.');
                return res.redirect('/register');
            }

            const insertSql = 'INSERT INTO users (fullName, email, passwordHash, role, totalBudget) VALUES (?, ?, ?, \'traveler\', 1000.00)';
            db.query(insertSql, [fullName.trim(), email, passwordHash], (insertErr) => {
                if (insertErr) {
                    console.error(insertErr);
                    req.flash('error', 'Something went wrong. Please try again.');
                    return res.redirect('/register');
                }
                req.flash('success', 'Traveler profile created! Please log in to start your journey.');
                res.redirect('/login');
            });
        });
    });
});

// ---------- Login ----------
app.get('/login', (req, res) => {
    res.render('login', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

app.post('/login', (req, res) => {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!email || !password) {
        req.flash('error', 'Please enter both email and password.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ?';
    db.query(sql, [email], (err, results) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Something went wrong. Please try again.');
            return res.redirect('/login');
        }

        if (results.length === 0) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/login');
        }

        const account = results[0];
        bcrypt.compare(password, account.passwordHash, (compareErr, match) => {
            if (compareErr || !match) {
                req.flash('error', 'Invalid email or password');
                return res.redirect('/login');
            }

            req.session.regenerate((regenErr) => {
                if (regenErr) {
                    console.error(regenErr);
                    req.flash('error', 'Something went wrong. Please try again.');
                    return res.redirect('/login');
                }

                req.session.user = {
                    userId: account.userId,
                    fullName: account.fullName,
                    email: account.email,
                    role: account.role
                };

                req.session.tripBudget = account.totalBudget ? Number(account.totalBudget) : 1000.00;

                req.flash('success', 'Welcome back, ' + account.fullName + '!');
                if (account.role === 'admin') {
                    return res.redirect('/admin');
                }
                res.redirect('/');
            });
        });
    });
});

// ---------- Forgot Password & Reset ----------
app.get('/forgot-password', (req, res) => {
    res.render('forgot_password', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

app.post('/forgot-password', (req, res) => {
    const email = (req.body.email || '').trim().toLowerCase();

    if (!email) {
        req.flash('error', 'Please enter your email address.');
        return res.redirect('/forgot-password');
    }

    const finish = () => {
        req.flash('success',
            'If that email is registered, a reset link has been generated. ' +
            'In this project the link is printed in the server console instead of being emailed.');
        res.redirect('/forgot-password');
    };

    db.query('SELECT userId FROM users WHERE email = ?', [email], (err, results) => {
        if (err || results.length === 0) {
            return finish();
        }

        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiry = new Date(Date.now() + 15 * 60 * 1000);

        const sql = 'UPDATE users SET resetTokenHash = ?, resetTokenExpiry = ? WHERE userId = ?';
        db.query(sql, [tokenHash, expiry, results[0].userId], (updateErr) => {
            if (!updateErr) {
                console.log('--------------------------------------------------');
                console.log('Password reset link for ' + email + ' (valid 15 min):');
                console.log('http://localhost:' + port + '/reset-password/' + token);
                console.log('--------------------------------------------------');
            }
            finish();
        });
    });
});

app.get('/reset-password/:token', (req, res) => {
    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const sql = 'SELECT userId FROM users WHERE resetTokenHash = ? AND resetTokenExpiry > NOW()';
    db.query(sql, [tokenHash], (err, results) => {
        if (err || results.length === 0) {
            req.flash('error', 'This reset link is invalid or has expired. Please request a new one.');
            return res.redirect('/forgot-password');
        }
        res.render('reset_password', {
            token: req.params.token,
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    });
});

app.post('/reset-password/:token', (req, res) => {
    const { password, confirmPassword } = req.body;
    const errors = [];

    if (!password) errors.push('Password is required.');
    else if (!strongPasswordRegex.test(password)) errors.push(passwordRequirementsMessage);
    if (!confirmPassword) errors.push('Please confirm your password.');
    else if (password && password !== confirmPassword) errors.push('Password and confirm password do not match.');

    if (errors.length > 0) {
        req.flash('error', errors);
        return res.redirect('/reset-password/' + req.params.token);
    }

    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const findSql = 'SELECT userId FROM users WHERE resetTokenHash = ? AND resetTokenExpiry > NOW()';
    db.query(findSql, [tokenHash], (err, results) => {
        if (err || results.length === 0) {
            req.flash('error', 'This reset link is invalid or has expired. Please request a new one.');
            return res.redirect('/forgot-password');
        }

        bcrypt.hash(password, 10, (hashErr, passwordHash) => {
            if (hashErr) {
                req.flash('error', 'Something went wrong. Please try again.');
                return res.redirect('/reset-password/' + req.params.token);
            }
            const updateSql = 'UPDATE users SET passwordHash = ?, resetTokenHash = NULL, resetTokenExpiry = NULL WHERE userId = ?';
            db.query(updateSql, [passwordHash, results[0].userId], (updateErr) => {
                if (updateErr) {
                    req.flash('error', 'Something went wrong. Please try again.');
                    return res.redirect('/reset-password/' + req.params.token);
                }
                req.flash('success', 'Password updated! Please log in with your new password.');
                res.redirect('/login');
            });
        });
    });
});

// ---------- Logout ----------
app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

// ==================================================
// Traveler / Budget Routes
// ==================================================

// GET /budget
app.get('/budget', checkAuthenticated, (req, res) => {
    const userId = req.session.user.userId;
    const editId = req.query.editId || null;

    const userSql = 'SELECT totalBudget FROM users WHERE userId = ?';
    db.query(userSql, [userId], (userErr, userResults) => {
        const savedBudget = (!userErr && userResults.length > 0) ? Number(userResults[0].totalBudget) : (req.session.tripBudget || 1000.00);
        req.session.tripBudget = savedBudget;

        const expensesSql = 'SELECT * FROM budget WHERE userId = ?';
        db.query(expensesSql, [userId], (err, expensesResults) => {
            if (err) {
                console.error('MySQL Select Expenses Error:', err);
                req.flash('error', 'Unable to fetch budget items.');
                return res.render('budget', {
                    expenses: [],
                    categoryBreakdown: [],
                    totalSpent: 0,
                    editingExpense: null,
                    trip: { totalBudget: savedBudget },
                    messages: req.flash('success'),
                    errors: req.flash('error')
                });
            }

            const categorySql = 'SELECT category, SUM(amount) AS total FROM budget WHERE userId = ? GROUP BY category';
            db.query(categorySql, [userId], (catErr, categoryResults) => {
                const totalSpent = expensesResults.reduce((sum, item) => sum + Number(item.amount || item.Amount || 0), 0);
                
                let editingExpense = null;
                if (editId) {
                    editingExpense = expensesResults.find(e => 
                        String(e.expenseId || e.budgetid || e.id) === String(editId)
                    ) || null;
                }

                res.render('budget', {
                    expenses: expensesResults,
                    categoryBreakdown: catErr ? [] : categoryResults,
                    totalSpent: totalSpent,
                    editingExpense: editingExpense,
                    trip: { totalBudget: savedBudget },
                    messages: req.flash('success'),
                    errors: req.flash('error')
                });
            });
        });
    });
});

// POST /budget/set-trip-budget
app.post('/budget/set-trip-budget', checkAuthenticated, (req, res) => {
    const { totalBudget } = req.body;
    const userId = req.session.user.userId;

    if (totalBudget && Number(totalBudget) > 0) {
        const newBudget = Number(totalBudget);
        const sql = 'UPDATE users SET totalBudget = ? WHERE userId = ?';
        
        db.query(sql, [newBudget, userId], (err) => {
            if (err) {
                console.error('MySQL Update Budget Error:', err);
                req.flash('error', 'Failed to update trip budget in database.');
            } else {
                req.session.tripBudget = newBudget;
                req.flash('success', 'Total trip budget updated successfully!');
            }
            res.redirect('/budget');
        });
    } else {
        req.flash('error', 'Please enter a valid budget amount greater than 0.');
        res.redirect('/budget');
    }
});

// POST /budget/add
app.post(['/budget', '/budget/add'], checkAuthenticated, (req, res) => {
    const { description, amount, category, expenseDate } = req.body;
    const userId = req.session.user.userId;

    if (!description || !amount) {
        req.flash('error', 'Please provide both description and amount.');
        return res.redirect('/budget#expense-history');
    }

    const sql = 'INSERT INTO budget (userId, description, amount, category, expenseDate) VALUES (?, ?, ?, ?, ?)';
    const selectedCategory = category ? category.trim() : 'Other';
    const selectedDate = expenseDate || new Date();

    db.query(sql, [userId, description, Number(amount), selectedCategory, selectedDate], (err) => {
        if (err) {
            console.error('MySQL Insert Error:', err);
            req.flash('error', 'Failed to add budget item.');
            return res.redirect('/budget#expense-history');
        }
        req.flash('success', 'Budget item added successfully!');
        res.redirect('/budget#expense-history');
    });
});

// POST /budget/update/:id
app.post('/budget/update/:id', checkAuthenticated, (req, res) => {
    const editId = req.params.id;
    const userId = req.session.user.userId;
    const { description, amount, category, expenseDate } = req.body;

    if (!description || !amount) {
        req.flash('error', 'Please provide both description and amount.');
        return res.redirect('/budget#expense-history');
    }

    const selectedCategory = category ? category.trim() : 'Other';
    const selectedDate = expenseDate ? new Date(expenseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    const sqlExpenseId = 'UPDATE budget SET description = ?, amount = ?, category = ?, expenseDate = ? WHERE expenseId = ? AND userId = ?';
    db.query(sqlExpenseId, [description, Number(amount), selectedCategory, selectedDate, editId, userId], (err, result) => {
        if (err || (result && result.affectedRows === 0)) {
            const sqlBudgetId = 'UPDATE budget SET description = ?, amount = ?, category = ?, expenseDate = ? WHERE budgetid = ? AND userId = ?';
            db.query(sqlBudgetId, [description, Number(amount), selectedCategory, selectedDate, editId, userId], (err2) => {
                if (err2) {
                    console.error('MySQL Update Error:', err2);
                    req.flash('error', 'Failed to update expense item.');
                    return res.redirect('/budget#expense-history');
                }
                req.flash('success', 'Expense updated successfully!');
                res.redirect('/budget#expense-history');
            });
            return;
        }

        req.flash('success', 'Expense updated successfully!');
        res.redirect('/budget#expense-history');
    });
});

// POST /budget/delete/:id
app.post('/budget/delete/:id', checkAuthenticated, (req, res) => {
    const editId = req.params.id;
    const userId = req.session.user.userId;

    const sqlExpenseId = 'DELETE FROM budget WHERE expenseId = ? AND userId = ?';
    db.query(sqlExpenseId, [editId, userId], (err, result) => {
        if (err || (result && result.affectedRows === 0)) {
            const sqlBudgetId = 'DELETE FROM budget WHERE budgetid = ? AND userId = ?';
            db.query(sqlBudgetId, [editId, userId], (err2) => {
                if (err2) {
                    console.error('MySQL Delete Error:', err2);
                    req.flash('error', 'Failed to delete expense item.');
                    return res.redirect('/budget#expense-history');
                }
                req.flash('success', 'Expense deleted successfully!');
                res.redirect('/budget#expense-history');
            });
            return;
        }

        req.flash('success', 'Expense deleted successfully!');
        res.redirect('/budget#expense-history');
    });
});

// ==================================================
// Admin Routes
// ==================================================
app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

app.listen(port, () => {
    console.log('JourneySpark Travel Planner running at http://localhost:' + port);
});