# Himanshu Exams Android app

Native Flutter client for the Himanshu Exams platform.

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

## Build

```bash
flutter pub get
flutter analyze
flutter build apk --release
```

The GitHub workflow publishes the current APK to `releases/himanshu-exams.apk`.
