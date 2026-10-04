# Himanshu Exams mobile app

Native Flutter client for Android and iOS.

## Features

- Centralized JSON API client using `cserver/exams/json`
- PHP-backed student registration, login, session restore and logout
- Google sign-in for both login and account creation
- Per-account preferences, saved attempt and local result history
- Website-parity Constable onboarding, dashboard and exam hub
- Only UP Police Constable selectable; upcoming exams are clearly disabled
- Official Constable sources, syllabus, recruitment stages and practice area
- Total-test timed, per-question timed and untimed modes
- Per-question or end-of-test feedback
- Question review, negative marking, topic analysis and result summary
- Shuffled retakes: unanswered, unanswered + wrong, wrong only, or all
- Dedicated Constable diagnostic with locked timer, marking and feedback rules
- Diagnostic report card with answer review and preparation focus guidance
- Responsive Material 3 interface

## Demo login

- Email: `student@example.com`
- Password: `demo123`

## Android build

```bash
flutter pub get
flutter analyze
flutter build apk --release
```

The Android workflow publishes `releases/himanshu-exams.apk`.

## iOS build

```bash
flutter pub get
flutter analyze
flutter build ios --release
```

The iOS workflow runs on macOS, creates the native iOS scaffold, verifies the Flutter source and publishes `releases/himanshu-exams-ios-unsigned.zip`. Installing on an iPhone or distributing through TestFlight/App Store requires Apple Developer signing credentials and a provisioning profile.
