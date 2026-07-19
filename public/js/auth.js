// ==================================================
// JourneySpark Travel Planner — public/js/auth.js
// Browser interactions only. All authentication,
// authorisation and database logic stays in Express.
// ==================================================
(function () {
    'use strict';

    // ---------- Show / hide password ----------
    document.querySelectorAll('.toggle-password').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var input = document.getElementById(btn.getAttribute('data-target'));
            if (!input) return;
            var show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            btn.classList.toggle('is-visible', show);
            btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        });
    });

    // ---------- Confirm-password live feedback ----------
    var password = document.getElementById('password');
    var confirmPassword = document.getElementById('confirmPassword');
    var matchHint = document.querySelector('[data-match-hint]');
    if (password && confirmPassword && matchHint) {
        var checkMatch = function () {
            if (!confirmPassword.value) {
                matchHint.hidden = true;
                confirmPassword.classList.remove('input-mismatch', 'input-match');
                return;
            }
            var matches = password.value === confirmPassword.value;
            matchHint.hidden = matches;
            confirmPassword.classList.toggle('input-mismatch', !matches);
            confirmPassword.classList.toggle('input-match', matches);
        };
        password.addEventListener('input', checkMatch);
        confirmPassword.addEventListener('input', checkMatch);
    }

    // ---------- Dismissable flash alerts ----------
    document.querySelectorAll('.alert-close').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var alert = btn.closest('.alert');
            if (alert) alert.remove();
        });
    });

    // ---------- Mobile navigation (public navbar) ----------
    var navToggle = document.querySelector('.navbar .nav-toggle');
    var navLinks = document.querySelector('.navbar .nav-links');
    if (navToggle && navLinks) {
        navToggle.addEventListener('click', function () {
            navLinks.classList.toggle('open');
        });
    }

    // ---------- Mobile sidebar (dashboards) ----------
    var sidebarToggle = document.querySelector('.sidebar-toggle');
    var sidebar = document.querySelector('.sidebar');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function () {
            sidebar.classList.toggle('open');
        });
    }
})();
