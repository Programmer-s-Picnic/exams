# Phase 1 — Routing correction and read-only data architecture audit

Date: 2026-11-04
Scope: ExamPreps / UP NaukriGuru website; no database migrations.

## Frontend findings
- Frontend is a hash-routed single-page application in `assets/app.js` with student and admin routes.
- `initialise()` loads header/footer and JSON content, verifies any existing authorization token, and dispatches the route.
- Route guards require authentication for protected screens and an exam selection for exam-scoped screens.
- This phase added a session-tab fallback to remember valid hash routes and restore them only after a browser reload when the hash is absent.
- Temporary guest report/answer review and guest attempts are deliberately never restored.
- `assets/test-engine.js` now gives a saved attempt's timing and feedback settings precedence over newly supplied settings. Saved absolute timer deadlines remain unchanged.

## Backend repository findings (Programmer-s-Picnic/cserver)
- `exams/database/connection.php` loads a dedicated private configuration file outside the public application directory (`private/exams-db.php`) and uses PDO with native prepared statements.
- `exams/api/bootstrap.php` centralizes JSON responses, DB connection and bearer token handling.
- `exams/api/results.php` stores authenticated test results in MySQL table `exams_test_results`, keyed by user and client-result ID, with a foreign key to `exams_users`. The result payload is JSON.
- `exams/api/admin.php` manages approved JSON content; exam and paper content remains in files such as `exams.json`, `tests.json`, `exam-syllabus.json`, and `exams-old-papers.json`.
- The GitHub deployment documentation says production credentials and records stay on the server; updates to repository code do not automatically run SQL migrations.

## Phase 1 safety decisions
- No SQL mutations or schema changes.
- No changes to existing user data, report cards, or exam question files.
- For future subscriptions and institute accounts, use MySQL relational tables with isolated scopes and foreign keys, not public JSON files.
- Continue using the existing admin content-approval lifecycle.

## Verification still required
- Inspect real production schema with read-only `SHOW TABLES`, `SHOW CREATE TABLE`, and index/foreign-key checks; repository inspection cannot prove the state of the live database.
- Confirm the hosting deployment and browser behavior on `naukripreps.com` using direct reload of `#/tests`, `#/profile`, `#/admin`, `#/instructions/<id>`, and `#/attempt/<id>`.
- Confirm correct recovery after authenticated token restoration, browser Back/Forward, and phone browser reload.
- Confirm deliberately ephemeral guest diagnostic reports do not reappear after reload.
- Confirm published JS assets are the current repository commit and are not cached by a service worker or CDN.

This report describes code-level changes and a repository-backed audit, not a completed production database audit or browser end-to-end test.
