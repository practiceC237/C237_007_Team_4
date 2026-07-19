// ==================================================
// My assigned part (Authentication & Authorisation):
// Registration -> validation -> bcrypt hash -> MySQL insert
// -> Login -> session -> checkAuthenticated -> checkAdmin
// -> page shown or access denied -> logout destroys session
// (Based on the C237 Lesson 19 flow, with bcrypt instead of SHA1)
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
// Database connection (Lesson 20: credentials come
// from environment variables, never hardcoded)
// Azure MySQL requires SSL, so set DB_SSL=true in .env
// when using the Azure database (leave it out for localhost).
// ==================================================
const db = mysql.createConnection({
    host: process.env.DB_HOST ,
    port: process.env.DB_PORT ,
    user: process.env.DB_USER ,
    password: process.env.DB_PASSWORD ,
    database: process.env.DB_NAME ,
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

// Keep the app alive and log the reason if the connection drops later
db.on('error', (err) => {
    console.error('MySQL connection error:', err.message);
});

// ==================================================
// App setup
// ==================================================
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

// Session middleware (Lesson 19, hardened for deployment)
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,                                  // JS in the browser cannot read the cookie
        sameSite: 'lax',                                 // basic CSRF protection
        secure: process.env.NODE_ENV === 'production',   // HTTPS-only cookie in production
        maxAge: 1000 * 60 * 60 * 24                      // session expires after 1 day
    }
}));

app.use(flash());

// Make the logged-in user available to every EJS page
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// ==================================================
// Middleware: validation, authentication, authorisation
// ==================================================

// Password strength: at least 8 characters, one uppercase, one lowercase,
// one number and one symbol. Enforced here (server-side) for both
// registration and password reset — never relying on the HTML
// `minlength`/`required` attributes alone, since those can be bypassed.
const strongPasswordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const passwordRequirementsMessage =
    'Password must contain at least 8 characters, including one uppercase letter, one lowercase letter, one number and one symbol.';

// Server-side validation for the registration form (Lesson 19 Step 1)
// Public registration never accepts a role from the browser — every
// account created here is a traveler. Admin accounts are promoted
// manually (SQL), never through this form.
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
        // Preserve only full name and email — never the passwords
        req.flash('formData', { fullName, email });
        return res.redirect('/register');
    }

    req.body.email = email; // pass the cleaned email on to the route
    next();
};

// Authentication: is the user logged in? (Lesson 19)
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    req.flash('error', 'Please log in to access this page');
    res.redirect('/login');
};

// Authorisation: does the logged-in user have the admin role? (Lesson 19)
// Safe even when req.session.user is undefined.
const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    req.flash('error', "You don't have permission to access that page.");
    res.redirect('/dashboard');
};

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

// 1. Check the email is not already registered (parameterised query)
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

        // 2. Hash the password with bcrypt (never store plain text)
        bcrypt.hash(password, 10, (hashErr, passwordHash) => {
            if (hashErr) {
                console.error(hashErr);
                req.flash('error', 'Something went wrong. Please try again.');
                return res.redirect('/register');
            }

            // 3. Insert the new user — always as a traveler. Admin accounts
            // are never created through public registration.
            const insertSql = 'INSERT INTO users (fullName, email, passwordHash, role) VALUES (?, ?, ?, \'traveler\')';
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

app.get('/trips', checkAuthenticated, (req,res)=> {
    const userId = req.session.user.userId;
    db.query('SELECT * FROM trips WHERE userId = ?', [userId],(err,results)=>{
        if (err) return res.send('Error loading trips');
        res.render('trips',{trips:results});
    });

});
app.get('/trips/new', checkAuthenticated, (req,res)=>{
    res.render('Newtrip');
});

app.post('/trips', checkAuthenticated, (req,res)=>{
   const userId = req.session.user.userId;
    const tripName = req.body.tripName;
    const destination= req.body.destination;
    const startDate = req.body.startDate;
    const endDate = req.body.endDate;
    const status = req.body.status;
    const image = req.body.image;
    

    db.query(
        'INSERT INTO trips (userId,tripName, destination, startDate, endDate, status,image) VALUES (?,?,?,?,?,?,?)',
        [userId,tripName, destination, startDate,endDate,status,image],
        (err, result) => {
            if(err) {
                console.log(err);
                return res.send('Error saving trip');
            }
            res.redirect('/trips');
        }
    );
    
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

    // Look up the user by email only — the bcrypt compare happens in Node,
    // never in the SQL query.
    const sql = 'SELECT * FROM users WHERE email = ?';
    db.query(sql, [email], (err, results) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Something went wrong. Please try again.');
            return res.redirect('/login');
        }

        // Same message whether the email or the password is wrong
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

            // Regenerate the session ID after login (prevents session fixation)
            req.session.regenerate((regenErr) => {
                if (regenErr) {
                    console.error(regenErr);
                    req.flash('error', 'Something went wrong. Please try again.');
                    return res.redirect('/login');
                }

                // Store only safe fields in the session — never the hash
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
// The user asks for a reset link. Because this project has no email
// service, the link is printed in the SERVER CONSOLE (never shown in
// the browser, so nobody can reset another person's account).
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

    // Always show the same message whether or not the email exists,
    // so the form cannot be used to discover registered accounts.
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

        // Random token: the plain value goes into the link, only its
        // SHA-256 hash is stored in the database (like a password).
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

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

// ---------- Reset password (via the token link) ----------
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
        // Redirecting back to the same token URL preserves it for the retry
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
            // Save the new hash and clear the token so the link is single-use
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

// ---------- Logout (POST so a link cannot fake it) ----------
app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid'); // remove the session cookie
        res.redirect('/login');
    });
});

// ==================================================
// Traveler routes (protected by checkAuthenticated)
// ==================================================
app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('user', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

// ==================================================
// Admin routes (checkAuthenticated + checkAdmin)
// ==================================================
app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

app.listen(port, () => {
    console.log('Noxelle Travel running at http://localhost:' + port);
});
