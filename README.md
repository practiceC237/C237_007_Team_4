# Travel Planning & Management System

==================================================
TEAM MEMBERS & RESPONSIBILITIES
==================================================

Please only work on your assigned feature unless discussed with the team.

Member     : Zhen Yu
Feature    : Authentication
Responsibilities:
- Create register, login, and logout functions
- Register with full name, email, and password
- Prevent duplicate email registration
- Hash passwords using bcrypt
- Use Express sessions to keep users logged in
- Ensure public registration creates traveler accounts only
- Add traveler and admin roles
- Protect logged-in and admin-only routes
- Add account statuses (e.g., active and blocked)
- Prevent blocked users from logging in
- Create an access-denied page
- Use server-side password validation and parameterized SQL queries

--------------------------------------------------

Member     : Brian
Feature    : TripManagement
Responsibilities:
- Add a new personal trip
- View all trips belonging to the logged-in user
- View details, edit, and delete a trip
- Store destination, title, start date, and end date
- Upload a destination image
- Validate that the end date is not before the start date
- Automatically calculate trip status (Upcoming, Ongoing, Completed)
- Add search or filtering by destination and status
- Ensure unrelated travelers cannot access the trip
- Allow accepted shared members to access the trip
- Create the main trip details dashboard

--------------------------------------------------

Member     : Shu Koon
Feature    : ItineraryActivity
Responsibilities:
- Add, view, edit, and delete itinerary activities
- Sort activities by date and time
- Group activities by travel day
- Store activity title, location, notes, and category
- Prevent activities outside the trip start and end dates
- Ensure the activity start time is before the end time
- Detect overlapping activity times
- Show empty travel days with no activities
- Ensure only authorized trip members can manage activities

--------------------------------------------------

Member     : Wen Rou
Feature    : BudgetExpense
Responsibilities:
- Set one total budget for each trip
- Add, view history, edit, and delete expenses
- Categorize expenses and show spending by category
- Calculate total spending, remaining budget, and percentage used
- Reject zero or negative amounts
- Validate that the expense date is within the trip dates
- Dynamic warning levels (<80%: normal, 80%-99%: warning, >=100%: over budget)
- Use DECIMAL data types for money values
- Calculate totals dynamically from the database, not hardcoded values

--------------------------------------------------

Member     : Hnin
Feature    : PackingList
Responsibilities:
- Add, view, edit, and delete packing items
- Mark items as packed or unpacked
- Organize items by category and filter by status/category
- Calculate real packing progress from the database (packed / total items)
- Handle trips gracefully when there are zero packing items
- Show progress metrics for each category
- Prevent or warn about duplicate items
- Allow accepted shared members to update packing items
- Show the number of unpacked items on the trip dashboard

--------------------------------------------------

Member     : Hao Jun
Feature    : SharedTripsAdmin
Responsibilities:
- Invite travelers to a trip (prevent self-invites and duplicate invites)
- Manage invitations with statuses (Pending, Accepted, Rejected, Cancelled)
- Add accepted travelers to the trip members table with permissions (Owner, Editor, Viewer)
- Only allow the owner or admin to manage members
- Ensure unrelated travelers cannot access shared trips
- Administrative controls: view users, block/unblock users, and manage shared trips
- Prevent the final trip owner from being removed

==================================================
RESERVED FEATURE NAMES
==================================================

Please use these EXACT feature names for your folders and branch names.

Member      Feature Name        Branch Example
--------------------------------------------------------
Zhen Yu     Authentication      Authentication/v1
Brian       TripManagement      TripManagement/v1
Shu Koon    ItineraryActivity   ItineraryActivity/v1
Wen Rou     BudgetExpense       BudgetExpense/v1
Hnin        PackingList         PackingList/v1
Hao Jun     SharedTripsAdmin    SharedTripsAdmin/v1

Do NOT rename your feature or use variations such as:
- authentication-and-authorisation
- trip-management
- itinerary_activity
- budgetExpense

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
│        └── style.css/
│     ├── js/
│        └── 
│     └── images/
│        └── icons.svg/
│
├── views/
│     └── partials/
│           ├── navbar.ejs
│           └── footer.ejs
│           └── .ejs
│           └── .ejs
│           └── .ejs
│     └── admin.ejs
│     └── forgot_password.ejs
│     └── index.ejs
│     └── login.ejs
│     └── register.ejs
│     └── reset_password.ejs
│     └── user.ejs
│
├── features/
│
│     ├── Authentication (Zhen Yu)/
│
│     ├── TripManagement (Brian)/
│
│     ├── ItineraryActivity (Shu Koon)/
│
│     ├── BudgetExpense (Wen Rou)/
│
│     ├── PackingList (Hnin)/
│
│     └── SharedTripsAdmin (Hao Jun)/
│
└── db/
       └── user_database.sql

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

TripManagement/v1
TripManagement/v2

ItineraryActivity/v1

BudgetExpense/v1

PackingList/v1

SharedTripsAdmin/v1

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

git checkout -b TripManagement/v2

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

git push -u origin TripManagement/v2

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

9. Create a Pull Request.

Wait for approval before merging.

==================================================
FEATURE DEMO REQUIREMENTS
==================================================

Authentication (Zhen Yu)
1. Register a traveler.
2. Try registering the same email again.
3. Log in successfully.
4. Try opening an admin page as a traveler.
5. Block the traveler using the admin account.
6. Show that the blocked traveler cannot log in.
7. Log out and show that protected pages cannot be accessed.

Trip Management (Brian)
1. Create a trip.
2. Enter an invalid date range and show the error.
3. Upload a trip image.
4. Edit the trip.
5. Show the automatic trip status updating.
6. Show that another unrelated traveler cannot access it.

Itinerary & Activity Management (Shu Koon)
1. Add a valid activity.
2. Try adding an activity outside the trip dates.
3. Try adding an activity that overlaps another activity.
4. Add another valid activity.
5. Show activities sorted and grouped by day.

Budget & Expense Management (Wen Rou)
1. Set a trip budget.
2. Add expenses keeping the budget utilization below 80%.
3. Add another expense to cross the 80% threshold.
4. Show the visual warning changing state.
5. Add another expense to exceed the budget.
6. Edit or delete an expense and show totals updating dynamically.

Packing List Management (Hnin)
1. Add several packing items under different categories.
2. Mark items as packed.
3. Show the packing percentage increasing.
4. Filter to show only unpacked items.
5. Unmark an item and show the percentage decreasing.

Shared Trips & Admin Management (Hao Jun)
1. Invite another traveler and show the pending invitation.
2. Log in as the invited traveler and accept the invitation.
3. Show the traveler inside the trip member list.
4. Show that the accepted traveler can access the shared trip.
5. Show that an unrelated traveler receives an access-denied error.
6. Show functional admin controls.

==================================================

Happy Coding! 🚀
