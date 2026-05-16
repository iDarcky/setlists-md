# Privacy Policy

*Last updated: May 16, 2026*

This Privacy Policy describes how the Setlists MD team ("we", "us", or
"Setlists MD") collects, uses, and shares information when you use the
Setlists MD web application available at
[setlistsmd.insideahead.com](https://setlistsmd.insideahead.com) (the
"Service").

Setlists MD is built privacy-first: your songs and setlists live on
your device by default. We only handle the minimum data needed to make
optional features like accounts, sync, and cloud storage work.

## 1. Information we collect

### 1.1 Information you provide

- **Account information.** When you sign up we store your email
  address, a hashed password (handled by Supabase Auth), and an
  optional display name.
- **Profile preferences.** If you opt in to cloud preferences, we
  store non-sensitive UI settings (theme, layout, font size) so they
  follow you across devices.
- **Songs and setlists.** By default your songs and setlists are
  stored only on your device using your browser's IndexedDB. They
  never leave your device unless you turn on a sync option.

### 1.2 Information you choose to sync

If you enable cloud sync, we store the chord-chart files you choose to
sync. The location depends on the plan you choose:

- **Pro (Bring-Your-Own-Cloud).** Files are stored in *your own*
  Google Drive, Dropbox, or OneDrive account, inside a folder named
  `SetlistsMD`. We never see the contents — your cloud provider gives
  us a per-app token that can only read and write files our app
  creates. We never request access to your other files.
- **Sync, Band, and Church plans (Hosted Cloud).** Files are stored
  in our managed Supabase project. They are transmitted over HTTPS
  and stored at rest in Supabase's hosted Postgres infrastructure.

### 1.3 Information collected automatically

- **Hosting logs.** Our hosting provider (Vercel) records standard
  request metadata such as IP address, user agent, and request path.
  These logs are used to keep the Service running and to diagnose
  outages. They are retained for a limited period in line with
  Vercel's defaults.
- **Local storage.** The app stores your songs, setlists, and UI
  preferences in IndexedDB on your device. This data never leaves
  your device unless you turn on sync.

We do **not** use third-party analytics, advertising trackers, or
marketing pixels.

## 2. How we use information

We use the information described above to:

- Provide and maintain the Service.
- Authenticate you and keep your account secure.
- Sync your songs, setlists, and preferences across your devices when
  you ask us to.
- Diagnose technical problems and improve the product.
- Respond to support requests.

We do **not** sell your personal data, and we do **not** share it with
third parties for advertising.

## 3. Google API Services and Limited Use disclosure

When you connect Google Drive, Setlists MD requests the
`drive.file` scope. This scope only grants access to files our app
creates or that you explicitly open with our app. We cannot read or
modify any other files in your Drive.

Setlists MD's use of information received from Google APIs adheres to
the [Google API Services User Data
Policy](https://developers.google.com/terms/api-services-user-data-policy),
including the Limited Use requirements. In particular:

- We use the data only to provide the user-facing features of
  Setlists MD (storing, listing, reading, and writing your
  chord-chart files inside the `SetlistsMD` folder).
- We do not transfer the data to others unless doing so is necessary
  to provide the Service, comply with the law, or as part of a
  merger, acquisition, or sale of assets with notice to you.
- We do not use the data for serving advertisements.
- We do not allow humans to read the data unless we have your
  affirmative consent, it is necessary for security purposes (such
  as investigating abuse), to comply with the law, or the data has
  been aggregated and anonymized.

Equivalent commitments apply to Dropbox and Microsoft OneDrive when
you connect those providers.

## 4. Cookies and similar technologies

We use a small number of strictly necessary cookies and local-storage
keys to keep you signed in and to remember your last-used email
address. We do not use cookies for tracking or advertising.

## 5. Data retention

- **Account data** is retained for as long as your account is active.
- **Hosted cloud files** are retained for as long as your subscription
  is active, plus a short grace period (30 days) after cancellation
  during which you can export them.
- **BYO Cloud files** live in your own Google Drive / Dropbox /
  OneDrive — we do not control retention.
- **Local data** stays on your device until you clear it.

You can delete your account at any time from Settings → Account →
Delete Account, which removes your profile and any hosted files we
have stored for you.

## 6. Your rights

Depending on where you live, you may have the right to:

- Access the personal data we hold about you.
- Correct or update inaccurate data.
- Delete your account and the personal data we hold.
- Object to or restrict certain processing.
- Receive a copy of your data in a portable format.

To exercise any of these rights, email us at
[support@setlistsmd.insideahead.com](mailto:support@setlistsmd.insideahead.com).

## 7. Security

We use HTTPS for all traffic, store passwords as salted hashes through
Supabase Auth, and follow industry-standard practices. No service is
100% secure; please use a strong, unique password and keep your
account credentials safe.

## 8. Children

Setlists MD is not directed to children under 13, and we do not
knowingly collect personal information from children under 13. If you
believe a child has provided us with personal information, please
contact us so we can delete it.

## 9. International users

Setlists MD is operated from the United States. By using the Service
you understand that your information may be processed in the United
States and other countries where our hosting providers operate.

## 10. Changes to this policy

We may update this Privacy Policy from time to time. When we do, we
will update the "Last updated" date at the top of this page and, for
material changes, notify you in the app or by email.

## 11. Contact

If you have questions about this Privacy Policy or about how we
handle your data, email us at
[support@setlistsmd.insideahead.com](mailto:support@setlistsmd.insideahead.com).
