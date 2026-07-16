# Noxelle Travel — Authentication & Authorisation

*Your journey, our priority.*

This document covers my assigned part of the C237 CA2 project: registration, login, logout, password hashing, sessions, flash messages, authentication and role-based authorisation middleware, protected routes, the access-denied page, and the auth-related design.

It follows the Lesson 19 flow (registration → validation → hash → MySQL insert → login → session → `checkAuthenticated` → `checkAdmin` → page shown or access denied → logout destroys session), with **bcrypt** used instead of the SHA1 shown in the lesson because bcrypt is a slow, salted hashing algorithm designed for passwords.

---

## 1. Setup

```bash
npm install
cp .env.example .env        # then fill in your MySQL details and a SESSION_SECRET
# Import db/noxelle_users.sql in MySQL Workbench
npm run dev                 # or: npm start
```

Never commit the real `.env` file — it is listed in `.gitignore`.

## 2. Registration flow (`GET /register`, `POST /register`)

1. User submits full name, email, password and confirm password.
2. `validateRegistration` middleware checks server-side that: full name is not empty; email is not empty, is valid, and is lowercased; password is not empty and at least 8 characters; confirm password is present and matches. On failure it flashes the errors, preserves only the full name and email (never the passwords) and redirects back to `/register`.
3. The route then checks the email is not already registered using a parameterised query (`SELECT userId FROM users WHERE email = ?`).
4. The password is hashed with `bcrypt.hash(password, 10)` (via the `bcryptjs` library).
5. The new user is inserted with `INSERT INTO users (fullName, email, passwordHash, role) VALUES (?, ?, ?, ?)` — the role is **always `'traveler'`**; there is no role selector on the public form, so nobody can register themselves as an admin.
6. A success flash message is shown and the user is redirected to `/login`.

## 3. Login flow (`GET /login`, `POST /login`)

1. The route checks that both email and password were entered.
2. The user is looked up by email only, with a parameterised query (`SELECT * FROM users WHERE email = ?`). The password is **not** compared inside SQL.
3. `bcrypt.compare` checks the submitted password against the stored hash.
4. Whether the email is unknown or the password is wrong, the same message is shown: **"Invalid email or password"** — this avoids telling an attacker which part was incorrect.
5. On success, `req.session.regenerate()` gives the user a fresh session ID (prevents session fixation), and only safe fields are stored in the session: `userId`, `fullName`, `email`, `role`. Passwords and hashes are never stored in the session.
6. Travelers are redirected to `/dashboard`; admins are redirected to `/admin`.

## 4. Password hashing

* Algorithm: bcrypt with 10 salt rounds, implemented by the pure-JavaScript `bcryptjs` library (same algorithm and hash format as native bcrypt, but installs without compiling C++ on Windows).
* Only the hash is stored in the `passwordHash` column — never the plain-text password.
* bcrypt hashes include their own random salt, so two users with the same password get different hashes.

## 5. Sessions

Configured in `app.js` with `express-session`:

| Option | Value | Why |
|---|---|---|
| `secret` | `process.env.SESSION_SECRET` | Never hardcoded in the code |
| `resave` | `false` | Don't rewrite unchanged sessions |
| `saveUninitialized` | `false` | No cookies for visitors who haven't logged in |
| `cookie.httpOnly` | `true` | Browser JS cannot read the cookie |
| `cookie.sameSite` | `'lax'` | Basic CSRF protection |
| `cookie.secure` | `true` in production | Cookie only sent over HTTPS on Render |
| `cookie.maxAge` | 1 day | Session expires after a day |

Flash messages use `connect-flash`, which stores one-time messages in the session (e.g. "Invalid email or password", "Traveler profile created!").

## 6. `checkAuthenticated`

```js
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    req.flash('error', 'Please log in to access this page');
    res.redirect('/login');
};
```

Applied to all traveler routes: `/dashboard`, `/trips`, `/itinerary`, `/budget`, `/expenses`, `/packing-list`, `/shared-trips`, `/profile` (and every admin route).

## 7. `checkAdmin`

```js
const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') return next();
    res.status(403).render('access-denied');
};
```

* Safely checks `req.session.user` exists first, so an undefined session never crashes the app.
* Non-admins get the boarding-pass style **Access Denied** page ("STATUS CANCELLED") with HTTP status **403**.
* Applied (after `checkAuthenticated`) to `/admin`, `/admin/users`, `/admin/trips`, `/admin/shared-trips`, `/admin/reports`, `/admin/settings`.

## 8. Forgot / reset password

Because this project has no email service, the reset link is printed in the **server console** (terminal) instead of being emailed — it is never shown in the browser, so the form can't be used to take over someone else's account.

1. `GET /forgot-password` shows the email form (linked from the login page).
2. `POST /forgot-password` looks the email up with a parameterised query. Whether or not the account exists, the browser gets the **same generic message**, preventing attackers from discovering registered emails. If the account exists, a 32-byte random token is generated with `crypto.randomBytes`; only its **SHA-256 hash** is stored in `resetTokenHash` (the token is treated like a password), with a 15-minute expiry in `resetTokenExpiry`. The full link is printed in the console.
3. `GET /reset-password/:token` hashes the token from the URL and matches it against `resetTokenHash` with `resetTokenExpiry > NOW()`; invalid or expired links are rejected.
4. `POST /reset-password/:token` re-validates the token, applies the same password rules as registration (min 8 chars, must match confirm), bcrypt-hashes the new password, and **clears the token columns so the link is single-use**.

New columns (already in the main migration; for an existing table run `db/add_password_reset.sql`): `resetTokenHash VARCHAR(64) NULL`, `resetTokenExpiry DATETIME NULL`.

## 9. Logout (`POST /logout`)

Logout is a **POST form** (in the navbar/sidebar), not a plain link, so a simple page navigation cannot fake it. The route destroys the session, clears the session cookie, and redirects to `/login`:

```js
app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});
```

After logout, pressing the browser Back button may show a cached page, but any request to a protected route redirects to `/login` because the session is gone.

## 10. Database

Table `users` (see `db/noxelle_users.sql`):

| Field | Type | Notes |
|---|---|---|
| `userId` | INT AUTO_INCREMENT | Primary key |
| `fullName` | VARCHAR(100) | Not null |
| `email` | VARCHAR(255) | Not null, **UNIQUE**, stored lowercase |
| `passwordHash` | VARCHAR(255) | bcrypt hash only |
| `role` | VARCHAR(20) | Defaults to `'traveler'` |
| `createdAt` | TIMESTAMP | Defaults to `CURRENT_TIMESTAMP` |

All queries use `?` placeholders — user input is never concatenated into SQL.

## 11. Creating the first admin

Public registration can never create an admin. To create the first admin safely:

```bash
node scripts/create-admin.js "Admin Name" admin@noxelle.travel
```

The script prompts for the password at a hidden prompt (so it never appears in a file or shell history), bcrypt-hashes it, and inserts the account with `role = 'admin'` using a parameterised query.

## 12. Deployment (Lesson 20)

Three-tier structure: **Presentation** (EJS + `public/css/style.css`), **Logic** (Express, sessions, auth middleware), **Data** (MySQL).

Environment variables (see `.env.example`): `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SESSION_SECRET`, `PORT`. The app listens on `process.env.PORT || 3000`, so Render can assign its own port. Set `NODE_ENV=production` on Render so the session cookie becomes HTTPS-only. `package.json` has a valid `start` script for Render.

Steps: push to GitHub (without `.env`) → import `db/noxelle_users.sql` into Azure MySQL (remove the `CREATE DATABASE`/`USE` lines and select your team database) → create a Render Web Service from the repo → add the environment variables in the Render dashboard.

## 13. Authentication testing table

Run these after `npm run dev` and fill in the last two columns.

| # | Test case | Steps | Expected result | Actual result | Pass/Fail |
|---|---|---|---|---|---|
| 1 | Successful traveler registration | Register with valid details | Success flash, redirected to `/login`, row in `users` with role `traveler` and a bcrypt hash | | |
| 2 | Empty registration field | Leave full name blank | Error flash on `/register`; email preserved, passwords cleared | | |
| 3 | Invalid email | Register with `not-an-email` | "Please enter a valid email address" flash | | |
| 4 | Short password | Password of fewer than 8 characters | "Password must be at least 8 characters long" flash | | |
| 5 | Password mismatch | Different password / confirm password | "Password and confirm password do not match" flash | | |
| 6 | Duplicate email | Register the same email twice | "This email is already registered" flash | | |
| 7 | Correct traveler login | Log in with valid traveler account | Redirected to `/dashboard`, name + Traveler badge shown | | |
| 8 | Wrong password | Valid email, wrong password | "Invalid email or password" flash, stays on `/login` | | |
| 9 | Unknown email | Email not in database | Same "Invalid email or password" flash | | |
| 10 | Admin login | Log in with admin account | Redirected to `/admin` with Admin badge | | |
| 11 | Logged-out user opens `/dashboard` | Visit while logged out | Redirected to `/login` with "Please log in" flash | | |
| 12 | Logged-out user opens `/admin` | Visit while logged out | Redirected to `/login` | | |
| 13 | Traveler opens `/admin` | Log in as traveler, visit `/admin` | **403** boarding-pass Access Denied page | | |
| 14 | Admin opens `/admin` | Log in as admin, visit `/admin` | Admin dashboard shown | | |
| 15 | Logout | Click Log Out | Session destroyed, redirected to `/login` | | |
| 16 | Protected route after logout | After logout, visit `/dashboard` | Redirected to `/login` | | |
| 17 | Browser Back after logout | Log out, press Back, click any protected link | Redirected to `/login` (session is gone) | | |
| 18 | Flash messages | Trigger any error/success | Message appears once, gone after refresh, dismissable | | |
| 19 | Responsive login | Open `/login` at mobile width | Single column, full-width form, no horizontal scroll | | |
| 20 | Responsive registration | Open `/register` at mobile width | Single column, full-width form, no horizontal scroll | | |
| 21 | Forgot password (unknown email) | Submit an unregistered email | Same generic "If that email is registered..." message; no hint that the account doesn't exist | | |
| 22 | Forgot password (real email) | Submit a registered email | Same generic message in browser; reset link printed in the server console | | |
| 23 | Invalid/expired reset link | Open `/reset-password/wrongtoken` | Redirected to `/forgot-password` with "invalid or expired" flash | | |
| 24 | Reset password mismatch | Enter two different passwords on the reset form | Validation flash, stays on the reset page | | |
| 25 | Successful reset | Set a valid new password via the console link | Success flash, redirected to `/login`; old password fails, new password works | | |
| 26 | Reset link single-use | Open the same link again after a successful reset | Redirected to `/forgot-password` with "invalid or expired" flash | | |
