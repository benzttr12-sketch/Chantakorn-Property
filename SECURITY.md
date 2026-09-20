# Security

This application uses Firebase Authentication and Firestore rules. Public visitors can read published listings and submit inquiries. Private profiles and inquiries require the roles defined in firestore.rules. All new accounts start as USER.

Run npm run test:rules before deploying rule changes. Never grant staff privileges from a client-supplied email, localStorage, or a public sign-up form. Bootstrap the first administrator only through the Firebase Console using an existing Authentication UID.

Public Firebase SDK configuration is intentionally included in the web bundle. Do not commit service-account credentials or private API keys. Report a suspected vulnerability privately to the repository owner, including reproduction steps without customer data.
