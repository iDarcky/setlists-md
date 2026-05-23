# Sheet Music (PDF) Module Analysis

## Overview
This document explores the theoretical implementation of a PDF-based sheet music module within Setlists MD. The feature aims to support choirs, directors, and traditional musicians who rely on exact musical notation (standard notation/sheet music) rather than text-based chord charts.

## 1. UI & User Experience
To keep the application clean and minimal, the PDF workflow should be integrated natively into the existing views without disrupting the text-based users.

* **Song Editor Integration:**
  * A new "Attachments" or "Sheet Music" section would be added to the `MetadataPanel` (or inside the `SongInfoDrawer`).
  * Users can upload a PDF directly from their device.
* **Reading Experience (`ChartView`):**
  * When a song has an attached PDF, the `ChartView` top navigation could introduce a toggle or segmented control: **"Lyrics" | "Chords" | "Sheet Music"**.
  * **Rendering:** Rendering a PDF on the web and mobile requires a robust library like `react-pdf` (which uses Mozilla's PDF.js under the hood). On mobile (via Capacitor), a native PDF viewer plugin might be needed to ensure smooth pinch-to-zoom, fast rendering, and low memory usage.

## 2. Storage & Infrastructure Architecture
Currently, Setlists MD is incredibly fast and cheap to run because songs are plain text Markdown. They are stored directly in PostgreSQL (`TEXT` columns) and local IndexedDB. PDFs fundamentally alter this architecture.

* **Local Storage (Personal Space):**
  * PDFs would need to be stored as `Blob` objects or Base64 strings in IndexedDB.
  * *Safari Eviction Risk:* Safari aggressively clears IndexedDB data after 7 days of user inactivity. If a user stores heavy PDFs locally, they risk losing them. Migrating mobile local storage to Capacitor SQLite would become a strict requirement to guarantee offline persistence.
* **Cloud Sync (Team/Church Workspaces):**
  * PDFs cannot and should not be stored in the Postgres database.
  * They must be uploaded to **Supabase Storage** (S3-compatible buckets).
  * The PostgreSQL `songs` table would need a new column (e.g., `sheet_music_url`) pointing to the file path in the Storage bucket.

## 3. Cost Implications & Monetization
The primary concern with allowing PDF uploads is the massive jump in infrastructure costs.

* **The Size Difference:**
  * A standard `.md` chord chart is about **1 to 5 KB**.
  * A scanned PDF of sheet music is typically **1 to 5 MB** (1,000x larger).
  * A choir library of 500 songs would easily consume **1 to 2.5 GB** of storage.
* **Bandwidth (Egress Costs):**
  * Syncing text files to a team of 10 musicians costs fractions of a cent.
  * Syncing 100 MBs of new PDFs every weekend to 10 band members will rapidly consume Supabase's bandwidth allowances, driving up monthly server bills.
* **The $4/month Module Strategy:**
  * **Conclusion:** You are absolutely correct to consider ring-fencing this feature. Offering it as a paid add-on (e.g., "$4/month Choir/Pro Module") is a mandatory business move to prevent the app from bleeding money.
  * The $4/month fee would easily cover the AWS/Supabase storage and egress costs per church, while keeping the core text-based app extremely cheap to operate for standard users.
  * This paywall would simply unlock the "Upload PDF" button in the editor and provision the necessary Supabase Storage access.

## Summary
Adding PDF support is technically straightforward but turns a lightweight text app into a heavy document management app. It is a highly requested feature for traditional ensembles, but it must be heavily monetized to offset the exponential increases in cloud storage and bandwidth.
