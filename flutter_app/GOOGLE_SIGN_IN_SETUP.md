# Exampreps Android Google Sign-In configuration

## Production identity

- **Android application ID:** `live.learnwithchampak.exampreps`
- **Flutter Google Sign-In dependency:** `google_sign_in: 6.2.2`
- **Web OAuth client (server client ID):** `72126822432-tug4n0jlflluabmb1h3s4kd5rljuppvg.apps.googleusercontent.com`
- **API endpoint:** `https://cserver.learnwithchampak.live/exams/api/google-login.php`

Do not substitute an Android OAuth client ID for the Web client passed as `serverClientId`.

## Android OAuth client required

1. Open Google Play Console > Exampreps > **App integrity** (or **Play app signing**, depending on console version).
2. In **App signing key certificate**, copy **SHA-1**.
3. In [Google Auth Platform / Google Cloud Credentials](https://console.cloud.google.com/apis/credentials), choose the Cloud project containing the Web OAuth client above. Create an **Android** OAuth 2.0 client with:
   - Package: `live.learnwithchampak.exampreps`
   - SHA-1: **Play app signing key certificate SHA-1**.
4. For direct APKs installed outside Google Play, also create an Android OAuth client for the same package and **GitHub release/upload key certificate SHA-1**. This is commonly different from the Play app signing SHA-1.
5. Verify the existing Web client is still active and the server's allowed audience matches that Web client ID. Check consent screen audience/testing users if the Google Auth Platform app is in testing.
6. Test an install from **Google Play internal testing**, not solely an APK downloaded from GitHub. Repeat with a direct APK if needed.
7. If sign-in fails, record the specific error shown by release 1.5.7+17 and inspect logcat for `ApiException: 10` or `DEVELOPER_ERROR`. Never publish private signing keys or keystore passwords.

> The package name alone does not identify the expected fingerprint. Check the **app signing certificate** on Play for users installing via Play; checking only the upload key will not resolve Google Sign-In in Play-distributed APKs.

## Build

Signed AAB and APK workflows: [Build Flutter APK](https://github.com/Programmer-s-Picnic/exams/actions/workflows/build-flutter-apk.yml).

Latest build location after a successful workflow: `releases/exampreps-playstore.aab`.
