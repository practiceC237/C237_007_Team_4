# Library Management System

==================================================
TEAM MEMBERS & RESPONSIBILITIES
==================================================

Please only work on your assigned feature unless discussed with the team.

Member     : Xylon
Feature    : Authentication
Responsibilities:
- Sign Up
- Login / Logout
- Password Hashing (bcrypt)
- Sessions
- User & Admin Middleware

--------------------------------------------------

Member     : Syafiq
Feature    : BookCRUD
Responsibilities:
- Add Book
- Edit Book
- Delete Book
- Update Book Status

--------------------------------------------------

Member     : Ai Li
Feature    : BookListing
Responsibilities:
- Display Book List
- Search Books
- Filter Books

--------------------------------------------------

Member     : Min
Feature    : Reservation
Responsibilities:
- Create Reservations
- Reservation Expiry Logic

--------------------------------------------------

Member     : Tristan
Feature    : AdminDashboard
Responsibilities:
- Admin Dashboard
- Approve Reservations
- Delete Books

--------------------------------------------------

Member     : Hazirah
Feature    : UIIntegration
Responsibilities:
- Navbar
- Shared Layout
- My Reservations
- Overall UI Integration

==================================================
RESERVED FEATURE NAMES
==================================================

Please use these EXACT feature names for your folders and branch names.

Member      Feature Name        Branch Example
--------------------------------------------------------
Xylon       Authentication      Authentication/v1
Syafiq      BookCRUD            BookCRUD/v1
Ai Li       BookListing         BookListing/v1
Min         Reservation         Reservation/v1
Tristan     AdminDashboard      AdminDashboard/v1
Hazirah     UIIntegration       UIIntegration/v1

Do NOT rename your feature or use variations such as:
- admin-dashboard
- dashboard
- admin_dashboard
- book-crud

Always use the reserved feature name above.

==================================================
PROJECT FOLDER STRUCTURE
==================================================

Each member owns ONE feature folder.

Library-System/
│
├── app.js
├── package.json
├── package-lock.json
├── README.md
│
├── config/
│     └── db.js
│
├── middleware/
│     ├── auth.js
│     └── admin.js
│
├── public/
│     ├── css/
│     ├── js/
│     └── images/
│
├── views/
│     └── partials/
│           ├── navbar.ejs
│           └── footer.ejs
│
├── features/
│
│     ├── Authentication (Xylon)/

│     ├── BookCRUD (Syafiq)/
│
│     ├── BookListing (Ai Li)/
│
│     ├── Reservation (Min)/
│
│     ├── AdminDashboard (Tristan)/
│
│     └── UIIntegration (Hazirah)/
│
└── database/
       └── schema.sql

Notes:
- Only work inside your assigned feature folder.
- Do NOT modify another teammate's feature folder unless everyone has agreed to it.
- You may freely create additional files or folders inside your own feature folder.

==================================================
GOLDEN RULES
==================================================

Rule 1
Never develop directly on the main branch.
Always create a new feature branch first.

--------------------------------------------------

Rule 2
Always start from the latest version of main.

Before starting any work, follow the Standard Workflow below.

--------------------------------------------------

Rule 3
Create a NEW branch every time you are ready to save a new version of your work.

Example:

Authentication/v1
Authentication/v2

AdminDashboard/v1
AdminDashboard/v2

BookCRUD/v1

BookListing/v1

Reservation/v1

UIIntegration/v1

--------------------------------------------------

Rule 4
Never push directly to the main branch.

Always create a Pull Request.

At least ONE teammate must approve before merging.

--------------------------------------------------

Rule 5
Only work inside your assigned feature folder.

If another file needs to be changed, discuss it with the team first.

--------------------------------------------------

Rule 6
Never commit node_modules.

Simply run:

npm install

--------------------------------------------------

Rule 7
Always test your code before committing.

Checklist:
✓ Application runs successfully
✓ Feature works correctly
✓ Browser console (F12) has no errors
✓ Terminal has no errors
✓ Existing features are not broken

==================================================
GIT WORKFLOW
==================================================

LIST 1 - FIRST TIME CLONING THE REPOSITORY

1. Clone the repository

git clone <repository_url>

2. Enter the project

cd <project_name>

3. Install dependencies

npm install

4. Run the application

npx nodemon app.js

==================================================

LIST 2 - STANDARD WORKFLOW (START FRESH EVERY TIME)

1. Stop the application

Ctrl + C

2. Switch to main

git checkout main

3. Pull the latest changes

git pull origin main

4. Create a NEW feature branch

git checkout -b <FeatureName>/v<VersionNumber>

Example:

git checkout -b AdminDashboard/v2

5. Develop and test your feature.

6. Check your modified files

git status

7. Stage your files

git add .

8. Commit

git commit -m "Describe your changes"

9. Push your branch

git push -u origin <FeatureName>/v<VersionNumber>

Example:

git push -u origin AdminDashboard/v2

10. Go to GitHub

Create a Pull Request.

Ask another teammate to review and approve it before merging.

==================================================

LIST 3 - EMERGENCY WORKFLOW (YOU HAVE UNCOMMITTED CHANGES)

1. Stop the application

Ctrl + C

2. Check your changes

git status

3. Create a NEW branch

git checkout -b <FeatureName>/v<VersionNumber>

4. Save your work

git add .

git commit -m "Work in progress"

5. Switch back to main

git checkout main

git pull origin main

6. Return to your feature branch

git checkout <FeatureName>/v<VersionNumber>

7. Continue developing.

8. When finished:

git add .

git commit -m "Complete feature"

git push -u origin <FeatureName>/v<VersionNumber>

10. Create a Pull Request.

Wait for approval before merging.

==================================================

Happy Coding! 🚀
