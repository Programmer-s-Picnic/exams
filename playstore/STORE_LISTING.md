# UP NaukriGuru — Google Play store listing (draft)
_Last updated: 11 October 2026. Review with the client before submitting._

## App identity
- Display name: UP NaukriGuru
- Android application ID: `live.learnwithchampak.himanshu_exams`
- Version name: 1.5.4
- Version code: 14
- App category: Education
- Contact: champaksworld@gmail.com
- Website (current GitHub Pages custom domain): https://naukripreps.com/
- Privacy policy: https://naukripreps.com/privacy/
- Account deletion requests: https://naukripreps.com/delete-account/
- Developer credit: Developed and maintained by Champak Roy

## Short description
UP Police Constable mocks, diagnostics, practice tests and progress tracking.

## Full description
Prepare with purpose using UP NaukriGuru, an exam preparation app focused initially on the UP Police Constable examination.

• Free diagnostic test with score, accuracy and focus areas
• Topic-wise practice and available mock tests
• Total-test timer, per-question timer or untimed practice in supported tests
• Immediate answer feedback or end-of-test review depending on test settings
• Saved results, detailed answer review and progress tracking
• Retakes with unanswered, incorrect or all questions where supported
• Freshly shuffled questions and options on retakes
• Validated exam syllabus and previous-paper material where available
• Student profile, account login and Google sign-in
• Website and Android access to supported account-level completed test results

Begin with a diagnostic, identify topics to strengthen and practise consistently.

UP Police Constable content is the initial focus. Other examination paths will be available when prepared and reviewed. Question banks, practice modes and content availability can vary by examination.

Disclaimer: UP NaukriGuru is an independent educational preparation service and is not affiliated with, endorsed by or operated by the Government of Uttar Pradesh, UP Police or any recruiting authority. Verify official recruitment notices, eligibility and dates on official websites.

## What's new — version 1.5.4
- Builds for 64-bit and compatible 32-bit Android devices
- Updated platform targeting for Android 16 / API 36
- Access to privacy policy and account deletion request from the app
- Student diagnostic tests, practice, timed mocks and result history

## Publication checklist
- [x] Android AAB build workflow configured
- [x] Play target API set to 36
- [x] Both ARM64 and ARM32 APK build paths configured
- [x] Release signing secrets wired in GitHub Actions (contents not exposed)
- [x] Privacy policy and account-deletion pages published in the repository
- [x] App links to privacy and account deletion included in source
- [ ] Verify latest GitHub Actions build succeeded and AAB is downloadable
- [ ] Install and smoke-test the final ARM64 and ARM32 APKs on compatible devices
- [ ] Verify Google sign-in with the final signed package SHA fingerprints and OAuth configuration
- [ ] Verify full diagnostic, practice-test submission, account signup and server result sync
- [ ] Prepare real screenshots from the running app, Play app icon and feature graphic
- [ ] Review accurate Play Console Data safety disclosures (name, email, mobile, authentication, exam results)
- [ ] Complete declarations, test track and submit the signed AAB in Play Console
- [ ] Confirm any account deletion backend/manual process responds to requests
- [ ] Confirm domain preference (current deployment is naukripreps.com; exampreps.com not yet configured)
