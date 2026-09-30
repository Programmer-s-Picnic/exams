# Exams administration

Open https://programmer-s-picnic.github.io/exams/#/admin and sign in.

## One-time hosting setup

In cPanel File Manager, create `private/exams-admin.php` next to the existing private `db.php`, outside `public_html` (the API uses the same parent-of-document-root convention as the database configuration).

```php
<?php
return ['emails' => ['your-admin@example.com']];
```

Use the email of an existing Exams account owned by the administrator. Add other approved admin emails to this list as needed. Do not place this file in the public site or commit it to GitHub. The folder for backups, `private/exams-content-backups`, is created when saving; PHP needs write permission there and to `exams/json`.

## Use

- Overview shows exam, paper and registration counts.
- Exam content loads and edits site-main.json, exams.json, tests.json and exam-syllabus.json directly on the server.
- Validate JSON checks syntax; the server checks required structure on saving.
- Download copy saves the current editor contents.
- Saving requires the same revision that was loaded. A newer server version causes a conflict and requires reloading.
- A private backup is required before publishing each update.
- Students lists the latest 200 registrations; passwords and tokens are excluded.
- Files & diagrams opens the public documentation inventory.

Reports and attempts remain stored on student devices; they are not available as central reports. Content changes made through admin are live server changes; a future deployment overwriting JSON can replace them. Keep a downloaded copy of important updates.
