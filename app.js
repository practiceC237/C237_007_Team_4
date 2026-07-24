// ==================================================
// Authentication & Authorisation:
// Registration -> validation -> bcrypt hash using SHA1 hash -> MySQL insert
// -> Login -> session -> checkAuthenticated -> checkAdmin
// -> page shown or access denied -> logout destroys session
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
const multer = require('multer');
const itineraryRoutes = require('./routes/itinerary');

const app = express();
const port = process.env.PORT || 3000;

// ==================================================
// Database connection (credentials come
// from environment variables, never hardcoded)
// Azure MySQL requires SSL, so set DB_SSL=true in .env
// when using the Azure database (leave it out for localhost).
// ==================================================
const db = mysql.createConnection({
    host: "c237-asyraf-mysql.mysql.database.azure.com",
    user: "c237_007",
    password: "c237007@2026!",
    database: "c237_007_team4_travelplanner",
    ssl: {
        rejectUnauthorized: true
    }
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
// App Setup
// ==================================================
app.set('view engine', 'ejs');
// Trust Render's reverse proxy so req.secure is detected correctly.
// Without this, express-session silently refuses to set secure cookies
// because it can't see past the proxy to confirm HTTPS.
app.set('trust proxy', 1);
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

// Authorisation: does the logged-in user have the admin role?
// Safe even when req.session.user is undefined.
const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    req.flash('error', "You don't have permission to access that page.");
    res.redirect('/');
};

// Default available categories for packing
const PACKING_CATEGORIES = ['Clothing', 'Toiletries', 'Electronics', 'Documents', 'Medical / First Aid', 'Misc'];

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

const storage = multer.diskStorage(
{
    destination: function (req,file,cb)
    {
        cb(null, 'public/images/');
    },

    filename: function (req,file,cb)
    {
        cb(null, file.originalname);
    }
    
});

const upload = multer({
    storage: storage
});

app.get('/trips', checkAuthenticated, (req,res)=> {
    const userId = req.session.user.userId;
    
    const destination = req.query.destination;
    const status = req.query.status;
    

    let sql = 'SELECT * FROM trips WHERE userId = ?';
    let values= [userId];

    if (destination){
        sql +=' AND destination LIKE ?';
        values.push('%' + destination +  '%');
    }
    if (status) {
        sql +='AND status = ?';
        values.push(status)
    }
   
  

    db.query(sql,values,(err,results) =>{
        if(err)
        {
            return res.send('Error loading trips');
        }
        
        res.render('trips',
        {   
            trips:results

        });
    });
});
    



app.get('/trips/new', checkAuthenticated, (req,res)=>{
    res.render('NewTrip',{
        error:null
    });
});

// When the user clicks Add a New Trip, it will go and check if the user is being authenticated to access the Add a New Trip webpage, if the user is being authenticated, it will render back to the New Trip ejs page. 
// it will check for userId, tripName, destination, startDate and endDate

app.post('/trips', checkAuthenticated, upload.single('image'), (req,res)=>{
    console.log(req.body);
   const userId = req.session.user.userId;
    const tripName = req.body.tripName;
    const destination= req.body.destination;
    const startDate = req.body.startDate;
    const endDate = req.body.endDate;
    const image = req.file ? req.file.filename : null;

    // Get today date
    const today = new Date ();
    today.setHours(0,0,0,0);
    // Convert user's input into Dates
    const start = new Date (startDate);
    start.setHours(0,0,0,0);
    const end = new Date (endDate);
    end.setHours(0,0,0,0);

    // Calculate the trip status
    let status;
    if (today < start) 
    {
        status = "Upcoming";
    }
    else if (today > end)
    {
        status = "Completed";
    }
    else 
    {
        status = "Ongoing";
    }
    console.log("Status:", status);

    // Check for invalid Date and ensures that endDate is before the startDate.
    if (end < start) 
    {
         return res.render('NewTrip',{
            error: "End Date cannot be before the Start Date."

    });

    }
        
    db.query(
        'INSERT INTO trips (userId,tripName, destination, startDate, endDate,status,image) VALUES (?,?,?,?,?,?,?)',
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

app.get('/trips/:id',checkAuthenticated,(req,res)=>{
    const userId = req.session.user.userId;
    const tripId = req.params.id;
    db.query('SELECT * FROM trips WHERE tripId = ? AND userId = ?', [tripId, userId], (err,results)=>{
    
        if (err) return res.send('Error loading trip ');
        if (results.length === 0) return res.send('Trip not found');
        res.render('trip-details',{trip: results[0]});

    });
})
app.post('/trips/:id/delete', checkAuthenticated,(req,res)=>{
    // Which user?
    const userId = req.session.user.userId;
    //Which trip ?
    const tripId = req.params.id;
    db.query('DELETE FROM trips WHERE tripId = ? AND userId = ?', [tripId, userId],(err) =>{
        if(err) return res.send('Error deleting');
        res.redirect('/trips');
    });
});
app.get('/trips/:id/edit',checkAuthenticated,(req,res)=>{
    const userId = req.session.user.userId;
    const tripId = req.params.id;
    console.log('Trip ID:',tripId);
    console.log('User ID:',userId);

    db.query('SELECT * FROM trips WHERE tripId = ? AND userId = ?',[tripId, userId],(err,results)=>{
        if (err) 
            {
                return res.send('Error loading trips');
            }
        if (results.length === 0)
        {   
            return res.send('Trip not found');

        }
    
        res.render('EditTrip', {trip:results[0]});
    });
});
app.post('/trips/:id/edit',checkAuthenticated,(req,res)=>{

    const userId = req.session.user.userId;
    const tripId = req.params.id;
    const tripName = req.body.tripName;
    const destination= req.body.destination;
    const startDate = req.body.startDate;
    const endDate = req.body.endDate;

    

    // Get today date
    const today = new Date ();
    today.setHours(0,0,0,0);
    // Convert user's input into Dates
    const start = new Date (startDate);
    start.setHours(0,0,0,0);
    const end = new Date (endDate);
    end.setHours(0,0,0,0);

    // Calculate the trip status
    let status;
    if (today < start) 
    {
        status = "Upcoming";
    }
    else if (today > end)
    {
        status = "Completed";
    }
    else 
    {
        status = "Ongoing";
    }

    db.query(
        'UPDATE trips SET tripName = ? , destination = ?, startDate = ?, endDate = ?, status = ? WHERE tripId = ? AND userId = ?',
        [tripName, destination,startDate,endDate,status,tripId,userId], (err,result) =>
        {
            if (err)
            {
                console.log(err);
                return res.send("Error updating trip");
            }

            res.redirect('/trips')
        }
    )

});


    





// NOTE: a duplicate/broken 'app.post('/trips/:id', ...)' route used to
// live here. It was dead code (no form in the app posts to that path —
// they all use '/trips/:id/edit') and had a crash bug (referenced an
// undefined 'tripId' variable). Removed since '/trips/:id/edit' above
// already handles updating a trip correctly.


    

    





       

            









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

// ---------- Forgot Password ----------
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
// Itinerary & Activity Management (Shu Koon)
// ==================================================

// GET /itinerary — pick which trip to view/plan the itinerary for
// (entry point from the navbar/sidebar/homepage, same idea as /budget)
app.get('/itinerary', checkAuthenticated, (req, res) => {
    const userId = req.session.user.userId;
    const sql = 'SELECT * FROM trips WHERE userId = ? ORDER BY startDate ASC';

    db.query(sql, [userId], (err, trips) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Could not load your trips.');
            trips = [];
        }
        res.render('itinerary-trips', {
            trips,
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    });
});

// // Itinerary & Activity Management (Shu Koon) — every route below is
// // protected inside routes/itinerary.js (login required + must own the trip)
app.use('/trips/:tripId/itinerary', itineraryRoutes(db, checkAuthenticated));

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
    // Three summary-card totals in one round trip: travelers, admins,
    // and the destination catalog size.
    const countsSql = `
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'traveler') AS totalUsers,
        (SELECT COUNT(*) FROM users WHERE role = 'admin')    AS totalAdmins,
        (SELECT COUNT(DISTINCT destination) FROM trips
         WHERE destination IS NOT NULL AND destination <> '') AS totalDestinations
`;
    db.query(countsSql, (err, results) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Could not load some dashboard totals.');
        }
        const counts = (results && results[0]) || { totalUsers: 0, totalAdmins: 0, totalDestinations: 0 };
        res.render('admin', {
            counts,
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    });
});

// ---------- Manage users ----------
app.get('/admin/users', checkAuthenticated, checkAdmin, (req, res) => {
    const sql = 'SELECT userId, fullName, email, role, createdAt FROM users ORDER BY createdAt DESC';
    db.query(sql, (err, users) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Could not load users.');
            return res.redirect('/admin');
        }
        res.render('admin_users', {
            users,
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    });
});

// Promote a traveler to admin, or demote an admin back to traveler
app.post('/admin/users/:id/role', checkAuthenticated, checkAdmin, (req, res) => {
    const targetId = Number(req.params.id);
    const newRole = req.body.role === 'admin' ? 'admin' : 'traveler';

    if (targetId === req.session.user.userId) {
        req.flash('error', 'You cannot change your own role.');
        return res.redirect('/admin/users');
    }

    db.query('UPDATE users SET role = ? WHERE userId = ?', [newRole, targetId], (err) => {
        if (err) {
            console.error(err);
            req.flash('error', "Could not update that user's role.");
        } else {
            req.flash('success', 'User role updated.');
        }
        res.redirect('/admin/users');
    });
});

// Delete a user account
app.post('/admin/users/:id/delete', checkAuthenticated, checkAdmin, (req, res) => {
    const targetId = Number(req.params.id);

    if (targetId === req.session.user.userId) {
        req.flash('error', 'You cannot delete your own account.');
        return res.redirect('/admin/users');
    }

    db.query('DELETE FROM users WHERE userId = ?', [targetId], (err) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Could not delete that user.');
        } else {
            req.flash('success', 'User deleted.');
        }
        res.redirect('/admin/users');
    });
});

// ---------- Manage destinations ----------
// Destinations aren't a catalog table — they're the free-text
// `destination` field on each trip. "Managing" them here means
// browsing the distinct values in use and, if needed, renaming one
// (which bulk-updates every trip that uses it, e.g. to fix a typo
// or merge "Bali" and "bali" into one spelling).
app.get('/admin/destinations', checkAuthenticated, checkAdmin, (req, res) => {
    const sql = `
        SELECT destination, COUNT(*) AS tripCount
        FROM trips
        WHERE destination IS NOT NULL AND destination <> ''
        GROUP BY destination
        ORDER BY tripCount DESC, destination ASC
    `;
    db.query(sql, (err, destinations) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Could not load destinations.');
            return res.redirect('/admin');
        }
        res.render('admin_destinations', {
            destinations,
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    });
});

// Rename a destination across every trip that uses it
app.post('/admin/destinations/rename', checkAuthenticated, checkAdmin, (req, res) => {
    const oldName = (req.body.oldName || '').trim();
    const newName = (req.body.newName || '').trim();

    if (!oldName || !newName) {
        req.flash('error', 'Both the current and new destination name are required.');
        return res.redirect('/admin/destinations');
    }
    if (oldName === newName) {
        req.flash('error', 'That destination already has that name.');
        return res.redirect('/admin/destinations');
    }

    db.query('UPDATE trips SET destination = ? WHERE destination = ?', [newName, oldName], (err, result) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Could not rename that destination.');
        } else {
            req.flash('success', `Renamed "${oldName}" to "${newName}" on ${result.affectedRows} trip(s).`);
        }
        res.redirect('/admin/destinations');
    });
});

app.listen(port, () => {
    console.log('JourneySpark Travel Planner running at http://localhost:' + port);
});
