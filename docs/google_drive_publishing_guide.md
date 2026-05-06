# Google Drive Publishing & Verification Guide

This guide provides step-by-step instructions on how to move your Google Cloud Project for Setlists MD from "Testing" to "In production", configure the correct scopes, and complete the Google App Verification process.

## 1. The Scope We Need

Your code in `src/sync/constants.js` is already configured to use the following scope:
**`https://www.googleapis.com/auth/drive.file`**

**Why this scope?**
This is the recommended and most secure scope for apps like Setlists MD. It allows the app to:
- Create new files and folders in the user's Google Drive.
- View, edit, update, and delete **only** the files and folders that the app itself has created (e.g., the `SetlistsMD` folder and its contents).

It **does not** give the app access to the user's entire Google Drive. Because it only accesses files created by the app, it is much easier to get verified than the full drive scope (`https://www.googleapis.com/auth/drive`). No additional Drive scopes are needed.

## 2. Moving to Production & Configuring the OAuth Consent Screen

To publish your app and remove the 100-user limit associated with testing mode, follow these steps in the Google Cloud Console:

1. **Go to the Google Cloud Console:** Navigate to [console.cloud.google.com](https://console.cloud.google.com/).
2. **Select your project:** Make sure your Setlists MD project is selected in the top dropdown.
3. **Go to APIs & Services:** Open the left navigation menu (hamburger icon) > **APIs & Services** > **OAuth consent screen**.
4. **App Information:** Ensure your App Name, User support email, and Developer contact information are accurate.
5. **App Domain (Important for Production):**
   - You must provide a link to your **Privacy Policy** and **Terms of Service** (if applicable, but highly recommended).
   - If you don't have these hosted yet, you must create web pages for them on your app's domain (e.g., `https://yourdomain.com/privacy` and `https://yourdomain.com/terms`) before submitting for verification.
   - You must also add your website's domain to the **Authorized domains** list at the bottom of this section.
6. **Scopes:**
   - Click **Save and Continue** to go to the Scopes section.
   - Click **Add or Remove Scopes**.
   - Search for the Drive API and select the one that ends with `/auth/drive.file`.
   - If it's already there, leave it. If you previously added the full Drive scope (`/auth/drive`), **remove it**. You only want `drive.file`.
   - Click **Save and Continue**.
7. **Publishing:**
   - Go back to the **OAuth consent screen** summary page.
   - Under "Publishing status", click the **Publish App** button.
   - A warning will pop up explaining that pushing to production requires verification. Confirm to proceed.

## 3. The Google App Verification Process

Because `https://www.googleapis.com/auth/drive.file` is considered a **Sensitive Scope** by Google, your app must go through the verification process before users can use it without seeing a scary "Google hasn't verified this app" warning.

Once you click "Publish App" and your status changes to "In production" / "Needs verification", follow these steps:

1. **Prepare a YouTube Video (Crucial Step):**
   Google requires a screen recording demonstrating how your app uses the requested scopes.
   - Record a video showing a user logging into Setlists MD via Google.
   - Clearly show the OAuth consent screen with your app's name.
   - Show the app creating a folder/file (e.g., syncing a song to Drive).
   - **Important:** Ensure the URL bar showing your Client ID is visible at some point during the login flow.
   - Upload this video to YouTube (it can be Unlisted) and copy the link.

2. **Submit for Verification:**
   - On the OAuth consent screen page, click the **Prepare for Verification** or **Submit for Verification** button.
   - Fill out the form provided by Google.
   - Provide the URL to your YouTube demonstration video.
   - Explain *why* you need the scope: *"Setlists MD needs the drive.file scope to backup and sync user-created text files (songs and setlists) to their personal Google Drive. The app only accesses a specific folder it creates and does not access the rest of the user's drive."*

3. **Wait for Review:**
   - Google's Trust & Safety team will review your submission.
   - They usually respond via email within 2-5 business days.
   - If they have questions or need a better video, they will reply to your support email. Respond to them promptly.

## Checklist Before Submitting

- [ ] Privacy Policy URL is added and functional.
- [ ] Terms of Service URL is added and functional.
- [ ] Authorized domains list includes the domain hosting your Privacy Policy.
- [ ] Only `https://www.googleapis.com/auth/drive.file` is listed under sensitive scopes.
- [ ] A YouTube video demonstrating the OAuth flow and Drive usage is ready.

Once verified, the "unverified app" warning will disappear, and any user can sync their Setlists MD data to their Google Drive securely!
