// ==================================================
// Authentication & Authorisation + Packing List Feature
// ==================================================
// Silence internal dependency deprecation warnings (e.g. util.isArray in mysql2 sub-packages)
process.noDeprecation = true;

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
// Database connection
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
        return;
    }

    console.log('Connected to MySQL database.');

    // Auto-create the table in whichever database Node is connected to
    const initTableSql = `
        CREATE TABLE IF NOT EXISTS packing_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            trip_id INT NOT NULL DEFAULT 1,
            item_name VARCHAR(255) NOT NULL,
            category VARCHAR(100) NOT NULL DEFAULT 'Misc',
            quantity INT NOT NULL DEFAULT 1,
            is_packed TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_packing_trip (trip_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    db.query(initTableSql, (tableErr) => {
        if (tableErr) {
            console.error('Error initializing packing_items table:', tableErr.message);
            return;
        }

        db.query('SELECT COUNT(*) AS count FROM packing_items', (countErr, results) => {
            if (countErr) {
                console.error('Error checking packing_items count:', countErr.message);
                return;
            }

            if (results[0].count === 0) {
                const seedSql = `
                    INSERT INTO packing_items (trip_id, item_name, category, quantity, is_packed) VALUES
                    (1, 'Passport & Visa', 'Documents', 1, 1),
                    (1, 'Phone Charger', 'Electronics', 1, 0),
                    (1, 'T-Shirts', 'Clothing', 5, 0),
                    (1, 'Toothbrush', 'Toiletries', 1, 1);
                `;
                db.query(seedSql, (seedErr) => {
                    if (seedErr) {
                        console.error('Error seeding packing_items:', seedErr.message);
                        return;
                    }
                    console.log('Sample packing items seeded!');
                });
            }
        });
    });
});

db.on('error', (err) => {
    console.error('MySQL connection error:', err.message);
});

// ==================================================
// App setup
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
// Middleware: validation, authentication, authorisation
// ==================================================

const strongPasswordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const passwordRequirementsMessage =
    'Password must contain at least 8 characters, including one uppercase letter, one lowercase letter, one number and one symbol.';

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
    res.redirect('/dashboard');
};

// Default available categories for packing
const PACKING_CATEGORIES = ['Clothing', 'Toiletries', 'Electronics', 'Documents', 'Medical / First Aid', 'Misc'];

// ==================================================
// Public routes
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

            const insertSql = "INSERT INTO users (fullName, email, passwordHash, role) VALUES (?, ?, ?, 'traveler')";
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

                req.flash('success', 'Welcome back, ' + account.fullName + '!');
                if (account.role === 'admin') {
                    return res.redirect('/admin');
                }
                res.redirect('/dashboard');
            });
        });
    });
});

// ---------- Forgot password ----------
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

// ---------- Reset password ----------
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
// Traveler routes
// ==================================================
app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('user', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

// ==================================================
// PACKING LIST ROUTES 
// ==================================================

// 1. VIEW PACKING LIST (or default for trip)
app.get('/trips/:tripId/packing-list', checkAuthenticated, (req, res) => {
    const tripId = req.params.tripId;
    const filterStatus = req.query.filterStatus || 'all';
    const filterCategory = req.query.filterCategory || 'All';

    // Fetch all items for overall stats calculation
    let sqlAll = 'SELECT * FROM packing_items WHERE trip_id = ?';
    db.query(sqlAll, [tripId], (err, allItems) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Could not load packing list.');
            return res.redirect('/dashboard');
        }

        const totalItems = allItems.length;
        // Handles both numbers (1) and booleans (true) reliably
        const packedCount = allItems.filter(i => Number(i.is_packed) === 1 || i.is_packed === true).length;
        const unpackedCount = totalItems - packedCount;
        const overallProgress = totalItems > 0 ? Math.round((packedCount / totalItems) * 100) : 0;
        
        // Category breakdown calculation
        const categoryStats = PACKING_CATEGORIES.map(cat => {
        const catItems = allItems.filter(i => i.category === cat);
        const total = catItems.length;
        const packed = catItems.filter(i => Number(i.is_packed) === 1 || i.is_packed === true).length;
        const percentage = total > 0 ? Math.round((packed / total) * 100) : 0;
        return { name: cat, total, packed, percentage };
    }).filter(c => c.total > 0);

        // Filter items for display
        let filteredItems = [...allItems];
        if (filterStatus === 'packed') filteredItems = filteredItems.filter(i => Number(i.is_packed) === 1 || i.is_packed === true);
        if (filterStatus === 'unpacked') filteredItems = filteredItems.filter(i => !(Number(i.is_packed) === 1 || i.is_packed === true));
        if (filterCategory !== 'All') filteredItems = filteredItems.filter(i => i.category === filterCategory);

        res.render('packing-list', {
            tripId,
            items: filteredItems,
            totalItems,
            packedCount,
            unpackedCount,
            overallProgress,
            categoryStats,
            categories: PACKING_CATEGORIES,
            filterStatus,
            filterCategory,
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    });
});

// Fallback shortcut route: /packing-list (Redirects or uses default trip 1)
app.get('/packing-list', checkAuthenticated, (req, res) => {
    res.redirect('/trips/1/packing-list');
});

// 2. GET ADD ITEM FORM
app.get('/trips/:tripId/packing-list/add', checkAuthenticated, (req, res) => {
    res.render('add-packing-item', { // <--- ✅ NOW MATCHES add-packing-item.ejs
        tripId: req.params.tripId,
        categories: PACKING_CATEGORIES,
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

// 3. POST ADD ITEM
app.post('/trips/:tripId/packing-list/add', checkAuthenticated, (req, res) => {
    const tripId = req.params.tripId;
    const { item_name, category, quantity } = req.body;

    if (!item_name || !item_name.trim()) {
        req.flash('error', 'Item name is required.');
        return res.redirect(`/trips/${tripId}/packing-list/add`);
    }

    const sql = 'INSERT INTO packing_items (trip_id, item_name, category, quantity, is_packed) VALUES (?, ?, ?, ?, 0)';
    db.query(sql, [tripId, item_name.trim(), category || 'Misc', parseInt(quantity) || 1], (err) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Failed to add item.');
            return res.redirect(`/trips/${tripId}/packing-list/add`);
        }
        req.flash('success', 'Item added to packing list!');
        res.redirect(`/trips/${tripId}/packing-list`);
    });
});

// 4. TOGGLE PACKED STATUS (Quick Checkbox)
app.post('/packing-list/:id/toggle', checkAuthenticated, (req, res) => {
    const itemId = req.params.id;
    const { trip_id, is_packed } = req.body;

    const sql = 'UPDATE packing_items SET is_packed = ? WHERE id = ?';
    db.query(sql, [is_packed, itemId], (err) => {
        if (err) console.error(err);
        res.redirect(`/trips/${trip_id || 1}/packing-list`);
    });
});

// 5. GET EDIT ITEM FORM
app.get('/packing-list/:id/edit', checkAuthenticated, (req, res) => {
    const itemId = req.params.id;

    db.query('SELECT * FROM packing_items WHERE id = ?', [itemId], (err, results) => {
        if (err || results.length === 0) {
            req.flash('error', 'Item not found.');
            return res.redirect('/packing-list');
        }

        res.render('edit-packing-item', {
            item: results[0],
            categories: PACKING_CATEGORIES,
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    });
});

// 6. POST EDIT ITEM (UPDATE)
app.post('/packing-list/:id/edit', checkAuthenticated, (req, res) => {
    const itemId = req.params.id;
    const { trip_id, item_name, category, quantity, is_packed } = req.body;

    if (!item_name || !item_name.trim()) {
        req.flash('error', 'Item name cannot be empty.');
        return res.redirect(`/packing-list/${itemId}/edit`);
    }

    const sql = 'UPDATE packing_items SET item_name = ?, category = ?, quantity = ?, is_packed = ? WHERE id = ?';
    db.query(sql, [item_name.trim(), category, parseInt(quantity) || 1, is_packed ? 1 : 0, itemId], (err) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Failed to update item.');
            return res.redirect(`/packing-list/${itemId}/edit`);
        }
        req.flash('success', 'Item updated successfully!');
        res.redirect(`/trips/${trip_id || 1}/packing-list`);
    });
});

// 7. POST DELETE ITEM
app.post('/packing-list/:id/delete', checkAuthenticated, (req, res) => {
    const itemId = req.params.id;
    const tripId = req.body.trip_id || 1;

    const sql = 'DELETE FROM packing_items WHERE id = ?';
    db.query(sql, [itemId], (err) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Failed to delete item.');
        } else {
            req.flash('success', 'Item deleted.');
        }
        res.redirect(`/trips/${tripId}/packing-list`);
    });
});

// ==================================================
// Admin routes
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