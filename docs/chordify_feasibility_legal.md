# Feasibility and Legal Report: AI Chord Extraction ("Chordify-style")

## 1. Introduction
This report evaluates the feasibility and legal implications of adding an automatic chord extraction feature to Setlists MD. The goal is to allow users to provide an audio file or URL and receive a structured Setlists MD Markdown file with detected chords.

## 2. Technical Feasibility

### 2.1 Implementation Strategy: Client-Side vs. Server-Side
*   **Recommendation:** **Client-side (WASM/JS)**.
*   **Reasoning:**
    *   **Cost:** Running AI models on a server for thousands of users is expensive. Client-side execution uses the user's hardware.
    *   **Privacy:** Audio data never leaves the user's device, simplifying GDPR/CCPA compliance.
    *   **Latency:** No need to upload large audio files to a server.

### 2.2 Tools & Libraries
*   **Essentia.js:** A powerful C++ library compiled to WebAssembly (WASM). It includes high-quality algorithms for `ChordDetection` and `BeatTracking`.
*   **Web Audio API:** Used for decoding MP3/WAV/Ogg files into raw PCM data for the model to process.
*   **TensorFlow.js:** Alternative if we want to use deep learning models (like those from Spotify's Magenta or similar), but Essentia.js is more specialized for MIR (Music Information Retrieval).

### 2.3 Challenges
*   **Performance:** Decoding and analyzing a 5-minute song can take 10-30 seconds depending on the device. Older mobile devices may struggle with memory (RAM) during decoding.
*   **Accuracy:** Automatic chord detection is roughly 70-85% accurate for standard pop/worship music. Complex jazz or heavy metal is harder.
*   **Output Mapping:** The AI provides timestamps (e.g., `[0.0, 4.2, "Cmaj"]`). We must map these to a structure (Verse, Chorus) and lyrics.
    *   *Solution:* Since we don't have synchronized lyrics for every song, the PoC will focus on generating a "Chord Chart" (chords only) or merging with user-pasted lyrics.

## 3. Legal Analysis

### 3.1 Copyright of Chord Progressions
*   **General Rule:** In most jurisdictions (including the US and EU), **chord progressions are not copyrightable**. They are considered the "building blocks" of music.
*   **Risk:** While the progression is safe, a full "Lead Sheet" (Melody + Chords + Lyrics) **is** protected.
*   **Mitigation:** Setlists MD will focus on generating chords. Users are responsible for providing lyrics (which they often already have via CCLI).

### 3.2 The YouTube Problem
*   **Issue:** YouTube's Terms of Service (ToS) prohibit downloading or extracting audio from videos outside of their official API/App.
*   **Legal "Safe Harbor" (DMCA):** By performing extraction **client-side**, Setlists MD acts as a neutral tool (like a browser or a recording device). The app itself does not "host" or "distribute" copyrighted audio.
*   **Integrated UX:** To avoid direct ToS violations, we should use the **YouTube IFrame API** to play the video for the user, while the "AI engine" analyzes the audio stream locally in the browser buffer.

### 3.3 Safe Harbor Implementation
To maintain "Safe Harbor" status:
1.  **No central database** of analyzed copyrighted songs.
2.  **User-initiated process:** The AI only runs when a user explicitly requests it for their own copy of a song.
3.  **Takedown policy:** Maintain the existing `COPYRIGHT.md` policy.

## 4. Licensing and Attribution

### 4.1 Library Licenses
*   **Permissive (MIT/Apache 2.0):** Most libraries currently used (React, Radix UI, Tailwind, svguitar) are permissive. They allow commercial use (monetization) as long as the original license and copyright notice are included in the app's "About" or "Legal" section.
*   **AGPLv3 (Essentia.js):** The primary engine for high-quality chord detection, **Essentia.js**, is licensed under **AGPLv3** for non-commercial use.
    *   **Commercial Use:** To safely monetize a feature using Essentia.js, you **must** obtain a commercial license from the Music Technology Group (UPF). Otherwise, the AGPLv3 requires you to open-source your entire application's source code.
    *   **Alternative:** Use a permissive alternative like `meyda` (MIT) or custom TensorFlow.js models (Apache 2.0), though they may require more development effort to match Essentia's accuracy.

### 4.2 Disclosure Requirements
*   **Open Source Attribution:** It is standard (and often legally required by MIT/Apache licenses) to have a "Third-Party Notices" page listing the libraries used and their licenses.
*   **AI Disclosure:** While not strictly legally required in all regions yet, it is good practice to inform users that "AI was used to generate this chart" to manage expectations regarding accuracy.

## 5. Monetization Strategy (The "Pro" Module)

Since AI analysis consumes development resources and provides high value, it is a prime candidate for a "Pro" tier.
*   **The "Credit" Model:** Users get 3 free AI imports, then pay for a "Power Pack" or Subscription.
*   **Gating:** The "AI Import" button is visible but triggers a "Upgrade to Pro" modal for non-paying users.
*   **Value Add:** Pro users also get "Batch Import" and "Cloud Sync" (as per the roadmap).

## 6. Conclusion & Recommendation
The feature is **feasible** and **legally defensible** if implemented as a client-side utility.

**Next Step:** Build a Proof of Concept (PoC) using a lightweight JS chord detection library that allows a user to "Drop an MP3" and see a generated Markdown snippet.
