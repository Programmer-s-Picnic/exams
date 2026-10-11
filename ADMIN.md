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

During testing, the website also supports a temporary username `admin` with a **randomly generated, unique password** from the private GoDaddy configuration. This is not the old `admin/admin` credential. The test account has full administrator permissions from any IP address and expires automatically after 10 days; tokens expire after one hour. The real administrator's email-based login remains available.

The password is generated once on the hosting server. In cPanel File Manager, open `~/private/exams-test-admin-credentials.txt`, copy the password securely, **then delete that file**. Never share it or include it in a screenshot. For setup and expiry details, see the [server testing-admin instructions](https://github.com/Programmer-s-Picnic/cserver/blob/main/exams/TESTING_ADMIN.md).
