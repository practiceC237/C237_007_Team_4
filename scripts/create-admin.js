// ==================================================
// Noxelle Travel — safe first-admin creation
// Usage: node scripts/create-admin.js "Full Name" admin@email.com
// The password is typed at a hidden prompt, bcrypt-hashed,
// and inserted with a parameterised query.
// ==================================================
require('dotenv').config();
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const fullName = process.argv[2];
const email = (process.argv[3] || '').trim().toLowerCase();

if (!fullName || !email) {
    console.log('Usage: node scripts/create-admin.js "Full Name" admin@email.com');
    process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// Hide the password while it is typed
rl.stdoutMuted = true;
rl._writeToOutput = function (str) {
    if (rl.stdoutMuted && str.trim() && !str.includes('Password')) {
        rl.output.write('*');
    } else {
        rl.output.write(str);
    }
};

rl.question('Password for the new admin: ', (password) => {
    rl.close();
    console.log('');
    if (!password || password.length < 8) {
        console.log('Password must be at least 8 characters.');
        process.exit(1);
    }

    const db = mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'noxelle_travel',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined
    });

    // Show a clean message instead of crashing if MySQL is unreachable
    // or the .env credentials are wrong.
    db.on('error', (err) => {
        console.error('Database error:', err.message);
        process.exit(1);
    });

    bcrypt.hash(password, 10, (hashErr, passwordHash) => {
        if (hashErr) { console.error(hashErr); process.exit(1); }
        const sql = 'INSERT INTO users (fullName, email, passwordHash, role) VALUES (?, ?, ?, ?)';
        db.query(sql, [fullName, email, passwordHash, 'admin'], (err) => {
            if (err) {
                console.error('Could not create admin:', err.message);
            } else {
                console.log('Admin account created for ' + email);
            }
            db.end();
        });
    });
});
