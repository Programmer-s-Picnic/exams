# UP Police Constable — expanded preparation package

Updated: 5 November 2026

## What was implemented

- Upgraded the UP Police Constable exam metadata (Recruitment 2025) from the official 31 December 2025 notice, 5 January 2026 age corrigendum and 5 February 2026 OMR instructions.
- Preserved the existing detailed four-subject syllabus, source links and **pending administrator approval**.
- Added 300 original multiple-choice questions across 20 additional syllabus themes, giving **480 topic-practice questions across 32 topics** (120 per subject) including the existing 180 fixtures.
- All 480 topic MCQs have four distinct options, a correct-option index, difficulty, topic metadata and an explanatory answer. Each of the 32 topics has five Foundation, five Medium and five Advanced questions.
- Added **three 150-question, 300-mark, 120-minute original full-length practice mocks**. Across the three mocks, 450 different source questions are used without overlap. These are not genuine UPPRPB shift-wise question papers.
- Each mock has +2 marks per correct answer, zero wrong-answer deduction **as a clearly labeled simulation choice** (the 2025 process notice does not state negative marking); 38 GK / 37 Hindi / 38 Numerical / 37 Reasoning questions is an editorial composition, **not an official subject quota**.
- Updated the constable dashboard with official exam pattern, recruitment-cycle status, vacancies, qualification, fees, age-limit correction, physical criteria and qualifying runs, official-document links and an eight-week editorial study schedule.
- Kept topic-only questions out of standard mock lists and full mock questions out of the topic-practice bank to avoid accidental duplicate exposure.
- Student report-card links now include original full-length mocks and topic attempts.
- Updated the frontend JavaScript cache version to load the new student hub.
- Preserved original general-reasoning guest diagnostics and exam-specific logged-in diagnostics, login, admin validation gates and historical report cards.

## Official source documents

- UPPRPB original advertisement: https://uppbpb.gov.in/FilesUploaded/Notice/CONSTABLE-VIGYAPTIc7be0cc8-3365-471e-9237-447c528d341a.pdf
  - Pages 1–3 recruitment and posts; page 4 fees; page 5 education; pages 11–12 physical standards and run; appendix pages 28–29 detailed written-exam syllabus.
- One-time age-relaxation corrigendum dated 5 Jan 2026: https://uppbpb.gov.in/FilesUploaded/Notice/20260105182150533dbb2e665-07ea-428e-972a-9f75e7701fcf.pdf
- Official OMR / exam-process notice dated 5 Feb 2026: https://uppbpb.gov.in/FilesUploaded/Notice/CONST-25OMRVIGGYAPTI05-02-2026590e47bd-d973-4a45-9007-b2a0a048b4f4.pdf
- Official notices/results: https://uppbpb.gov.in/Home/Notice

## Coverage

| Subject | Topic count | Original question count |
|---|---:|---:|
| General Hindi | 8 | 120 |
| General Knowledge | 8 | 120 |
| Numerical and Mental Ability | 8 | 120 |
| Mental Aptitude, IQ and Reasoning | 8 | 120 |
| **Total** | **32** | **480** |

The full original test bank includes 3 additional mock papers × 150 questions; the mock questions are selected from the 480-question source pool and are not counted as unique new source questions.

## Test data and publishing

- Canonical content: `Programmer-s-Picnic/cserver/exams/json/tests.json`, `exams.json`, `exam-syllabus.json`.
- Fallback content: `Programmer-s-Picnic/examsdata` mirror. Each mirrored file has an identical Git blob SHA.
- Repeatable generators: `tools/seed-topic-practice.js`, `tools/expand-constable-bank.js`, `tools/build-constable-mocks.js`.
- Repeatable automated tests: `node --test tests/topic-practice.test.cjs tests/topic-fixtures.test.cjs tests/constable-full-bank.test.cjs`.

## Known limitations and unfinished work

1. The official syllabus contains **more than the 32 topics** currently represented in the 480-question training bank. This is substantial coverage, **not 100% of the granular syllabus**. More professionally reviewed questions, bilingual translations, diagram-based questions and current-affairs material can be added.
2. Previous-year (2024/2026 shift-wise) records remain **pending admin validation**. Empty placeholders must not be presented as complete papers. Some imported records are incomplete. Only verified, approved question documents may be published as PYQs.
3. Syllabus import remains pending administrator approval, as previously required. Its authoritative original PDF can still be opened.
4. Structural checks confirm unique IDs, question format, explanations and intended mock counts. **Individual educational answer accuracy requires additional subject-matter review**; three ambiguous blood-relation items were corrected during preparation.
5. User-facing production deployment is **not verified**. The web-access attempt to `https://naukripreps.com/` and CServer content API was unsuccessful. GitHub commits do not establish that the hosted JS/PHP/data have deployed.
6. Paid subscription access, coaching institute accounts, daily current-affairs automation and true question-level source provenance are separate planned features; not completed by this update.

## Browser acceptance checks required

1. Open https://naukripreps.com/#/constable with a logged-in UP Police student account.
2. Check sections for exam overview, Recruitment 2025, official sources, eight-week study plan and physical standards.
3. Use https://naukripreps.com/#/topic-practice, choose UP Police Constable, any of 4 subjects and any of 8 topics per subject. Confirm all 3 difficulties show 5 questions each, and instant explanations work.
4. Open https://naukripreps.com/#/exam-practice/up-police; ensure three original full-length mocks are listed. Inspect a 150-question mock's instructions (120 min, 300 marks, +2/0 simulation) and submit a sample attempt.
5. Confirm question progress and final result are stored server-side and visible after reload or a different login device.
6. Verify guest general-reasoning diagnostics and existing signed-in diagnostics remain unchanged and guest results are never stored.
7. Confirm all official syllabus / previous-year paper content is still behind the administrator validation gate.
8. Confirm GoDaddy CServer deploy copied content and the new topic-progress API. Confirm Pages frontend builds the latest `main` version.

This document is a repository implementation report, not proof of a completed live production acceptance test.
