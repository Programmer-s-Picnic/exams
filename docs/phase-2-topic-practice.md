# Phase 2 — Topic-wise Practice implementation

Date: 2026-11-05

## Scope delivered in code
- New logged-in student route: `#/topic-practice`, linked from the student dashboard, exam practice and test library.
- Exam → subject → topic selection drawn from published, non-diagnostic practice tests; optional difficulty and question-count selection.
- Randomized question/answer order in each session; immediate feedback and explanations after the student checks each answer.
- Progress saved to a per-account server draft through `/exams/api/topic-practice.php` after session creation, each answer, and each move to the next question.
- Resume/switch session; completed reports are posted through the existing authenticated `results.php` endpoint and merged into the student report-card cache.
- New administrator "Topic practice" panel: feature enabled/disabled toggle in `site-main.json`, visual question/subject/topic/difficulty/answer/explanation editing using the existing `admin.php` revision-checked save system and backups.
- New stylesheet for responsive mobile and desktop UI.
- Eligibility tests in `tests/topic-practice.test.cjs`.

## Architecture
The student module is separate from `TestEngine` and does not alter test timers, guest diagnostics, question-order generation in existing mock tests, or their scoring. The topic question bank is derived at runtime from published non-diagnostic tests. Administrator changes to a source question also change that original practice test, which is explicitly disclosed in the editor.

The access toggle is a **module-level visibility switch**, not a paid-subscription entitlement or payment authorization system. Payment integration remains a separate phase. The backend draft endpoint always verifies the student bearer token, uses a database-derived user ID, and never accepts a user ID from the browser. Completed attempts use the existing results API; unfinished topic sessions have their own relational MySQL table.

## Content prerequisites
The separately stored public `Programmer-s-Picnic/examsdata` snapshot inspected on 2026-11-05 contains published diagnostics, but no published non-diagnostic practice test. The production cserver dataset may differ. A full end-to-end student test requires the administrator to publish a suitable practice test with correct answers, explanations, exam association, subject/category and topics. Do not republish diagnostics merely to populate the new feature.

## Code-level verification performed
- JavaScript syntax checked: `assets/app.js`, `assets/admin-console.js`, `assets/topic-practice.js`, `assets/topic-practice-admin.js`.
- Script and CSS references confirmed in `index.html`.
- Topic-bank eligibility tested against synthetic published practice questions and guest/unpublished/invalid records.
- A repeatable Node eligibility test file was added for CI or local testing.

## Production acceptance checklist (not yet verified)
1. Confirm GitHub Pages publishes the latest `index.html`, scripts, and CSS at `https://naukripreps.com/`.
2. Confirm GoDaddy CServer deployed `/exams/api/topic-practice.php`.
3. Verify an authenticated GET to the new endpoint returns `{ "draft": null }` for a student with no session, rather than 404/500.
4. Confirm the DB account can create `exams_topic_practice_drafts` and the `exams_users` referenced table exists.
5. In the admin panel, enable Topic practice and publish an appropriate non-diagnostic practice set with explanations.
6. On the student website select exam, subject, topic, difficulty and question count, answer one MCQ and verify feedback/explanation.
7. Reload and sign in from a second browser to verify progress resumes from MySQL.
8. Complete the practice and verify the new report is visible under Reports and after a new sign-in.
9. Repeat original guest general-reasoning diagnostic and logged-in exam-specific diagnostic; ensure their previous behaviour is unchanged.
10. Verify that changing the admin feature toggle is reflected in the student website without deployment.
11. Verify published-source test changes do not accidentally modify existing mock test rules.
12. Check mobile width, browser back/forward and reload.

## Deployment status
Changes committed to `main` in the frontend and CServer repositories. A live production browser/database end-to-end test was not available from this session. Do not mark acceptance complete until the checklist has been carried out on the hosted site.
