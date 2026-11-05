# UP Police Constable — Topic-wise practice test data

Prepared: 2026-11-05
Status: committed to `main` in `Programmer-s-Picnic/cserver` and `Programmer-s-Picnic/examsdata`. Live GoDaddy/GitHub Pages deployment not independently verified.

## Data summary

- **180 original practice MCQs** (not official PYQs).
- **12 topics** × **15 questions** per topic.
- **4 subjects** × **45 questions** per subject.
- For each topic: **5 Foundation**, **5 Medium**, **5 Advanced** questions.
- Each question includes four choices, one correct option, a topic, difficulty and an explanation.
- Dataset is tagged `topicPracticeSeed: "2026-11-05-v1"`; question origin is `original-practice-question` with `contentStatus: "training-fixture"`.
- New sets are `topicPracticeOnly: true`: intentionally hidden from the ordinary mock-test library but available to the Topic-wise Practice selector.
- All old 10 tests remain in the repository and are left unchanged. No existing diagnostic result or student account was modified.

| Subject | Topics |
|---|---|
| General Hindi | पर्यायवाची शब्द, विलोम शब्द, शुद्ध वर्तनी |
| General Knowledge | भारतीय संविधान, आधुनिक भारतीय इतिहास, भारत का भूगोल |
| Numerical and Mental Ability | प्रतिशत, अनुपात व समानुपात, साधारण ब्याज |
| Mental Aptitude, I.Q. and Reasoning Ability | संख्या श्रृंखला, दिशा ज्ञान, कोडिंग-डिकोडिंग |

## How to test

1. Open [naukripreps.com/#/topic-practice](https://naukripreps.com/#/topic-practice) and sign in with a student account.
2. Choose **UP Police Constable**, a subject and one of its three topics.
3. Select **All difficulties** and **5, 10 or 15** questions. Answer a question, choose **Check answer** and confirm that the correct option and explanation appear.
4. Return to the menu or refresh during an unfinished session and use **Resume session**. If the CServer API is deployed and database permissions are correct, progress should restore from the server.
5. Finish the session and check that the report card opens and remains visible under **Saved Report Cards** after signing in again.
6. Test each individual Foundation, Medium, Advanced filter. The filter should yield five questions per topic.
7. Verify existing guest and student diagnostic tests and the original mock-test library remain unchanged.
8. In [admin](https://naukripreps.com/#/admin) → **Topic practice**, review a seed set, edit an explanation, save, and check the updated question after a new student session.
9. Toggle the feature OFF/ON from the admin screen, checking both frontend and server enforcement, then leave ON for continued testing.

## Validation performed

- CServer and fallback copies of `tests.json` are byte-identical after the changes.
- 12 topic sets, 180 questions, 4 subjects and 3 levels verified.
- Topic-bank runtime eligibility yields exactly 180 selectable questions.
- All 180 IDs are unique, all four answer choices are unique per question, each correct-answer index is valid, and all questions have explanations.
- All seed sets are marked published and topic-only.
- Repeatable Node tests: `node --test tests/topic-practice.test.cjs tests/topic-fixtures.test.cjs`.
- These tests check structure and basic correctness constraints, not comprehensive pedagogical fact checking by a subject expert.

## Data publication and safety

`Programmer-s-Picnic/cserver/exams/json/tests.json` is the main site content path; `Programmer-s-Picnic/examsdata/tests.json` is the fallback. Both `site-main.json` copies set `features.topicPractice.enabled = true`.

The GitHub commit is not, by itself, a verification that the hosting provider has deployed the files. Live host responses were not accessible from this session, so opening and completing a topic session in a real browser is still required. Do not treat this original-practice training bank as official UPSC/UPPRPB previous-year exam questions.
