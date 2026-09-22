# Himanshu Exams mobile app

Native Flutter client for Android and iOS.

## Features

- Centralized JSON API client using `examsdata`
- Student/demo login
- Dashboard, examination goals and test catalogue
- Total-test timed, per-question timed and untimed modes
- Per-question or end-of-test feedback
- Question review, scoring and result summary
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
