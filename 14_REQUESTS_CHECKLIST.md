# v3.2 — all fourteen requested updates

| # | Request | Implemented behavior | Validation |
|---|---|---|---|
| 1 | Dynamic portfolio graph | Recorded net worth = cash + marked holdings. History persists, the latest point matches Portfolio, and the visible resource refreshes every five seconds. Period filters use recorded timestamps. | Price-change unit test, API test and browser equality check |
| 2 | PDF quiz creation | Choose PDF question paper in the controlled quiz form, upload a PDF up to 25 MB, publish for an enrolled learner, accept written answers and manually grade out of 100 with feedback. MCQ creation remains available. | Provider → learner → provider browser test and API access checks |
| 3 | Video Edit should move up | Clicking Edit automatically scrolls/focuses the lesson editor above the list, including repeated clicks on the same lesson. Save/Cancel remain available. | Browser edits and saves the uploaded video title |
| 4 | Instructor Send Notification | Dedicated composer with selected-student checkboxes/search or All assigned active students. Server validates every recipient before creating notifications. | Selected/all browser sends; unauthorized-recipient API rejection |
| 5 | Center instructor Earnings/Analysis | Both use the same centered 1200 px width and responsive gutters as the dashboard. | Bounding-box checks and rendered visual inspection |
| 6 | Remove redundant user-growth section and update counts | Removed the second repeated count block from active admin dashboards. Upper cards use platform aggregates, including Payment Admin, without granting user-management access. | Cross-role actor creation updates Payment Admin counts |
| 7 | Populate platform analytics | Actual course, enrollment/completion, paper-trade/turnover and quiz totals, plus seven days of activity grouped by IST. | API counters and rendered browser report |
| 8 | Payment Admin recent activity | Saved workflow/session events, course enrollments and filled paper orders. No invented activity or health percentages. | Browser verifies real activity appears |
| 9 | Institute submission loading | Kept because it retrieves rosters submitted through intake links. Auto-load on open, explicit loading/error/empty state, Refresh institute submissions, and Review submitted CSV. Direct CSV upload still works. | Create intake, submit CSV, refresh and load into review textarea |
| 10 | User Admin recent activity | Same sanitized real-event report used for User Admin. | Browser verifies activity and API data |
| 11 | Filter users by admin | All actors, learners, instructors, providers, all admins, each admin division and Super Admin. Filters combine with text search. | Browser selects All Admins and verifies learner exclusion |
| 12 | Ask actor first when creating accounts | Controlled actor selector precedes the form. Learner, instructor, provider and admin show their own fields; unrelated fields disappear. | Browser creates all four actor types |
| 13 | Separate Super Admin assignments/sessions | Assignments contains assignments only; sessions and scheduling remain in the Sessions tab. Instructor combined view is retained. | Browser checks no Schedule Session button on Super Admin Assignments |
| 14 | One consistent dark-mode control | Exactly one ThemeToggle component/button across Home, Login, Register, intake and all dashboards. Fixed bottom-left position, shared palette, persistence and cross-tab preference listener. | One-button count/position on six roles; persistence across reload/navigation; visual contrast review |

## Important behavior

- The equity chart records actual valuations after this update. It does not invent historical prices for older accounts. A flat curve is correct when prices and positions do not change.
- PDF quizzes are written-answer assessments with manual creator grading, not automatic PDF-to-MCQ extraction. Learners see their saved score/feedback after grading.
- Notifications are in-app messages. Selecting All targets the instructor's active assigned students, not every learner on the platform.
- Reports and portfolio resources refresh every five seconds while visible and on focus. Other standard panels use their existing polling interval. This is polling, not WebSocket streaming.
- Institute submissions are rosters returned through the private intake invitation, not arbitrary files uploaded elsewhere.

## Tests and source

`npm run build`, `npm test` (**36 passing tests**) and `npm run test:browser` passed. New tests: `tests/round2.test.mjs`, `tests/valuation.test.mjs` and `tests/browser-round2.cjs`.

Main React files: `pages/Dashboard.jsx`, `components/Learning.jsx`, `components/Management.jsx`, `components/Institutes.jsx`, `components/NotificationComposer.jsx`, `components/PlatformReports.jsx`, `components/ThemeToggle.jsx`, `main.jsx`, and `styles/theme.css` under `frontend/src/`.

Backend changes cover reports, quiz PDF upload/submission/grading, recipient validation, account field validation, safe activity auditing and saved marked-value history. Existing JWT authentication, private service configuration and paper-trading isolation remain in use.

The individual contribution template and viva guide remain in the ZIP. Each student must record their actual work/commits; suggested responsibilities are not fabricated contributions.
