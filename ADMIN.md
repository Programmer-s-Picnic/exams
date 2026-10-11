# Exams administration

The site is transitioning to the dedicated MySQL database `exams`. **Activate the server database configuration and import existing Exams accounts/results before merging this UI update.**

The private admin credential allowlist belongs in `~/private/exams-admin.php`, outside `public_html`:

```php
<?php
return ['emails' => ['your-registered-admin@example.com']];
```

Register or migrate an Exams account using that email. At `https://naukripreps.com/#/admin`, sign in with the same **Exams account email/mobile and password**. The old temporary `admin/admin` credentials are disabled. Ordinary student accounts do not gain admin privileges.

The administrator panel allows management of exam content and syllabus/paper approval. JSON changes are backed up to `~/private/exams-content-backups` before publishing. The server validates data and prevents stale-revision overwrites.

Students and administrators use `https://cserver.learnwithchampak.live/exams/api` for account authentication. Registration records and test results reside in the server's dedicated `exams` MySQL database, while the question bank, exams, paper documents, and validation metadata remain served from JSON.

For the database setup, see [cserver Exams cutover guide](https://github.com/Programmer-s-Picnic/cserver/blob/exams-dedicated-mysql-20261011/exams/DATABASE_CUTOVER.md). The backend must be activated before this frontend update.

## Time-limited testing access

The admin login page supports a separate temporary testing account for approved networks during October 2026. Testing access is **not public to arbitrary IP addresses**: the hosting administrator must enable `testing_access` in `~/private/exams-admin.php` and explicitly allow the testers' public IP addresses. The server enforces an automatic expiry, 60-minute sessions, rate limiting and logout revocation. The ordinary administrator email allowlist remains active. See the [server setup instructions](https://github.com/Programmer-s-Picnic/cserver/blob/main/exams/TESTING_ADMIN.md).
