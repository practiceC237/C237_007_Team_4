// ==================================================
// Shu Koon — Itinerary & Activity Management
// Flow: user action -> route -> SQL query -> database -> response
//   GET  /trips/:tripId/itinerary            list, grouped by travel day
//   GET  /trips/:tripId/itinerary/add        show "add activity" form
//   POST /trips/:tripId/itinerary/add        validate + INSERT
//   GET  /trips/:tripId/itinerary/:id/edit   show "edit activity" form
//   POST /trips/:tripId/itinerary/:id/edit   validate + UPDATE
//   POST /trips/:tripId/itinerary/:id/delete DELETE
//
// Mounted from app.js with:
//   const itineraryRoutes = require('./routes/itinerary');
//   app.use('/trips/:tripId/itinerary', itineraryRoutes(db, checkAuthenticated));
// ==================================================

const express = require('express');

const CATEGORIES = ['Activity', 'Food', 'Transport', 'Accommodation', 'Sightseeing', 'Other'];

module.exports = function itineraryRouter(db, checkAuthenticated) {
    const router = express.Router({ mergeParams: true });

    // Fallback so this router still works if it's ever tested on its own,
    // without app.js's real checkAuthenticated wired in.
    if (typeof checkAuthenticated !== 'function') {
        checkAuthenticated = (req, res, next) => {
            if (req.session.user) return next();
            req.flash('error', 'Please log in to access this page');
            res.redirect('/login');
        };
    }

    // --------------------------------------------------
    // Access control: every route here needs a logged-in
    // user AND a trip that user is allowed to see.
    // Right now "allowed" = the trip owner (or an admin).
    // Once Hao Jun's SharedTripsAdmin trip_members table
    // adds Editor/Viewer roles, this is the one place that
    // needs to grow to also accept accepted shared members.
    // --------------------------------------------------
    function loadTrip(req, res, next) {
        const tripId = parseInt(req.params.tripId, 10);
        if (Number.isNaN(tripId)) {
            req.flash('error', 'Invalid trip.');
            return res.redirect('/itinerary');
        }

        db.query('SELECT * FROM trips WHERE tripId = ?', [tripId], (err, results) => {
            if (err) {
                console.error(err);
                req.flash('error', 'Something went wrong loading that trip.');
                return res.redirect('/itinerary');
            }
            if (results.length === 0) {
                req.flash('error', 'Trip not found.');
                return res.redirect('/itinerary');
            }

            const trip = results[0];
            const isOwner = trip.userId === req.session.user.userId;
            const isAdmin = req.session.user.role === 'admin';
            if (!isOwner && !isAdmin) {
                req.flash('error', "You don't have access to this trip's itinerary.");
                return res.redirect('/itinerary');
            }

            req.trip = trip;
            next();
        });
    }

    router.use(checkAuthenticated);
    router.use(loadTrip);

    // ---------- List: activities sorted + grouped by travel day ----------
    router.get('/', (req, res) => {
        const trip = req.trip;
        const sql = 'SELECT * FROM itinerary_items WHERE tripId = ? ORDER BY activityDate ASC, startTime ASC';

        db.query(sql, [trip.tripId], (err, items) => {
            if (err) {
                console.error(err);
                req.flash('error', 'Could not load the itinerary.');
                items = [];
            }

            const days = buildDayGroups(trip.startDate, trip.endDate, items);

            res.render('itinerary', {
                trip,
                days,
                messages: req.flash('success'),
                errors: req.flash('error')
            });
        });
    });

    // ---------- Add activity ----------
    router.get('/add', (req, res) => {
        const saved = req.flash('formData');
        res.render('add-activity', {
            trip: req.trip,
            categories: CATEGORIES,
            formData: saved.length > 0 ? saved[0] : {},
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    });

    router.post('/add', (req, res) => {
        saveActivity(req, res, db, null);
    });

    // ---------- Edit activity ----------
    router.get('/:itemId/edit', (req, res) => {
        const itemId = parseInt(req.params.itemId, 10);
        const sql = 'SELECT * FROM itinerary_items WHERE itemId = ? AND tripId = ?';

        db.query(sql, [itemId, req.trip.tripId], (err, results) => {
            if (err || results.length === 0) {
                req.flash('error', 'Activity not found.');
                return res.redirect(`/trips/${req.trip.tripId}/itinerary`);
            }

            // If we just bounced back from a failed validation, show what
            // the user typed instead of overwriting it with the saved row.
            const saved = req.flash('formData');
            const item = saved.length > 0 ? Object.assign({}, results[0], saved[0]) : results[0];
            item.activityDate = formatDateOnly(item.activityDate);
            item.startTime = String(item.startTime).slice(0, 5);
            item.endTime = String(item.endTime).slice(0, 5);

            res.render('edit-activity', {
                trip: req.trip,
                item,
                categories: CATEGORIES,
                messages: req.flash('success'),
                errors: req.flash('error')
            });
        });
    });

    router.post('/:itemId/edit', (req, res) => {
        const itemId = parseInt(req.params.itemId, 10);
        saveActivity(req, res, db, itemId);
    });

    // ---------- Delete activity ----------
    router.post('/:itemId/delete', (req, res) => {
        const itemId = parseInt(req.params.itemId, 10);
        const tripId = req.trip.tripId;

        db.query('DELETE FROM itinerary_items WHERE itemId = ? AND tripId = ?', [itemId, tripId], (err) => {
            if (err) {
                console.error(err);
                req.flash('error', 'Could not delete that activity.');
            } else {
                req.flash('success', 'Activity deleted.');
            }
            res.redirect(`/trips/${tripId}/itinerary`);
        });
    });

    return router;
};

// ==================================================
// Shared validation + INSERT/UPDATE logic for both
// "add" and "edit", so the two forms enforce exactly
// the same rules.
// ==================================================
function saveActivity(req, res, db, editingItemId) {
    const trip = req.trip;
    let { title, category, location, notes, activityDate, startTime, endTime } = req.body;

    title = (title || '').trim();
    location = (location || '').trim();
    notes = (notes || '').trim();

    const errors = [];

    if (!title) errors.push('Activity title is required.');
    if (!CATEGORIES.includes(category)) errors.push('Please choose a valid category.');
    if (!activityDate) errors.push('Activity date is required.');
    if (!startTime) errors.push('Start time is required.');
    if (!endTime) errors.push('End time is required.');

    // Activity date must fall inside the trip's own date range
    const tripStart = formatDateOnly(trip.startDate);
    const tripEnd = formatDateOnly(trip.endDate);
    if (activityDate && (activityDate < tripStart || activityDate > tripEnd)) {
        errors.push(`Activity date must be between ${tripStart} and ${tripEnd} (the trip's dates).`);
    }

    // Start time must be before end time
    if (startTime && endTime && startTime >= endTime) {
        errors.push('Start time must be before end time.');
    }

    const redirectBack = () => {
        const path = editingItemId
            ? `/trips/${trip.tripId}/itinerary/${editingItemId}/edit`
            : `/trips/${trip.tripId}/itinerary/add`;
        res.redirect(path);
    };

    if (errors.length > 0) {
        req.flash('error', errors);
        req.flash('formData', { title, category, location, notes, activityDate, startTime, endTime });
        return redirectBack();
    }

    // Overlap check: two activities on the same day overlap when
    // one starts before the other ends AND ends after the other starts.
    // (excludes the row being edited)
    let overlapSql = `
        SELECT itemId, title, startTime, endTime FROM itinerary_items
        WHERE tripId = ? AND activityDate = ? AND startTime < ? AND endTime > ?`;
    const overlapParams = [trip.tripId, activityDate, endTime, startTime];
    if (editingItemId) {
        overlapSql += ' AND itemId != ?';
        overlapParams.push(editingItemId);
    }

    db.query(overlapSql, overlapParams, (err, overlaps) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Something went wrong. Please try again.');
            return redirectBack();
        }
        if (overlaps.length > 0) {
            const clash = overlaps[0];
            req.flash('error', `That time overlaps with "${clash.title}" (${clash.startTime}–${clash.endTime}).`);
            return redirectBack();
        }

        if (editingItemId) {
            const sql = `
                UPDATE itinerary_items
                SET title = ?, category = ?, location = ?, notes = ?, activityDate = ?, startTime = ?, endTime = ?
                WHERE itemId = ? AND tripId = ?`;
            db.query(sql, [title, category, location || null, notes || null, activityDate, startTime, endTime, editingItemId, trip.tripId], (updateErr) => {
                if (updateErr) {
                    console.error(updateErr);
                    req.flash('error', 'Could not update that activity.');
                    return redirectBack();
                }
                req.flash('success', 'Activity updated.');
                res.redirect(`/trips/${trip.tripId}/itinerary`);
            });
        } else {
            const sql = `
                INSERT INTO itinerary_items (tripId, title, category, location, notes, activityDate, startTime, endTime)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            db.query(sql, [trip.tripId, title, category, location || null, notes || null, activityDate, startTime, endTime], (insertErr) => {
                if (insertErr) {
                    console.error(insertErr);
                    req.flash('error', 'Could not add that activity.');
                    return redirectBack();
                }
                req.flash('success', 'Activity added.');
                res.redirect(`/trips/${trip.tripId}/itinerary`);
            });
        }
    });
}

// mysql2 returns DATE columns as JS Date objects — normalise to 'YYYY-MM-DD'
// so it can be compared directly against the <input type="date"> string.
function formatDateOnly(value) {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
}

// Build one entry per calendar day of the trip (even days with zero
// activities), each holding the activities that fall on that day.
function buildDayGroups(tripStartDate, tripEndDate, items) {
    const byDate = {};
    items.forEach((item) => {
        const key = formatDateOnly(item.activityDate);
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(item);
    });

    const days = [];
    const cursor = new Date(formatDateOnly(tripStartDate) + 'T00:00:00');
    const end = new Date(formatDateOnly(tripEndDate) + 'T00:00:00');
    let dayNumber = 1;

    while (cursor <= end) {
        const key = cursor.toISOString().slice(0, 10);
        days.push({
            dayNumber,
            date: key,
            activities: byDate[key] || []
        });
        cursor.setDate(cursor.getDate() + 1);
        dayNumber++;
    }

    return days;
}
