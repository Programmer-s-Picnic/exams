# ExamPreps Admin UX — staged implementation (15 October 2026)

## Safe baseline
- Repository: Programmer-s-Picnic/exams; default branch untouched.
- Branch: admin-ux-modernization-20261015.
- Backend repository: Programmer-s-Picnic/cserver; default branch untouched.
- Backend branch: admin-hybrid-drafts-20261015.
- Existing student website, examsdata JSON and production database are unchanged.

## Verified source observations
- Current admin frontend is assets/admin-console.js.
- Admin authentication and load/save live in cserver/exams/api/admin.php.
- Existing load/save uses a file allowlist, revision hash and a private file backup before replacing published JSON.
- The admin endpoint advertises site-main.json, exams.json, tests.json, exam-syllabus.json, exams-old-papers.json.
- examsdata also exposes exams-topics-questions.json and exam-topics.json, but those are not currently part of the server admin file allowlist.
- Existing Validation editor originally used raw JSON. This staging branch now uses a visual editor with an optional technical JSON view.

## Implemented in staging
- Non-technical structured form editor, list management, search, duplication, removal and labelled fields.
- Existing JSON shape preserved without requiring hand-written braces/commas.
- Advanced JSON option remains available in the existing admin screen.
- Existing admin server-side validation, backups and optimistic revision checks continue to handle saves.
- Responsive, readable editor styling.
- Additive MySQL tables staged in cserver/exams/database/admin-content-drafts.sql.

## NOT yet implemented / activated
- Draft API endpoints and per-user permissions; database migration has NOT run.
- Review/publish transaction through MySQL; existing Save still publishes according to original backend rules.
- Full question-specific controls and guided MCQ answer selection (the generic visual form is currently used in both content and Validation).
- Excel/CSV import preview and bulk publishing.
- Student/Flutter cross-platform verification and production release.

## Production launch blockers
1. Validate on a test deployment with copies of real JSON and MySQL, not live student data.
2. Build authenticated draft/save/review/publish endpoints and enforce server-side full-admin-only publishing.
3. Migrate MySQL tables after a verified database snapshot, and provide rollback SQL/procedures.
4. Add schema-specific validation for question sets, paper structures, bilingual options and index consistency.
5. Verify the Validation record visual editor with real paper and syllabus structures.
6. CSV import: sanitization, mapping screen, duplicate report and dry run; no silent overwrite.
7. Test keyboard interaction, Hindi input, nested arrays, large papers, concurrent edits and rejected revisions.
8. Confirm student website and Flutter app still render every published paper and retain report cards.

This branch is a development checkpoint, not a production deployment.

## Publication update
The existing frontend visual editor and its How to use guide may be published independently. The draft MySQL schema remains uninstalled, and old server-side Save continues to publish eligible JSON files directly. No subadmin or Excel-import functionality is implied by this frontend release.
