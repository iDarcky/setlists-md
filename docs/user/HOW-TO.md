# How to Use Setlists MD

Welcome to Setlists MD! This guide will take you from your first time opening the app to mastering its advanced features.

---

## Part 1: Quick Start Guide

Get up and running in 5 minutes.

### 1. Adding Your First Song
Setlists MD doesn't use complicated databases; it uses simple text files.
1. Tap the **Library** tab at the bottom.
2. Tap the **New Song** button.
3. You'll see the Editor. By default, it opens the **Visual** tab.
4. Fill out the **Song Info** (Title, Artist, Key, Tempo).
5. Type your lyrics. To add a chord, position your cursor and tap the **Chord** button in the toolbar. To add a section (like a Chorus), tap the **Section** button.
6. Tap **Save** in the top right.

### 2. Building a Setlist
1. Tap the **Setlists** tab at the bottom.
2. Tap **New Setlist**.
3. Give it a Name and Date.
4. Tap **Add Song** to search your Library and add songs to the list.
5. You can drag to reorder them, or set a specific key for the song just for this setlist.
6. Tap **Save**.

### 3. Playing Live
1. From the **Setlists** tab, tap on the setlist you just created.
2. Tap **Live Mode** (or the Play icon).
3. The app enters performance mode. You'll see a clean view of your charts.
4. Tap the right side of the screen (or use a Bluetooth pedal) to advance to the next song.

---

## Part 2: Deep Dive

Unlock the full power of Setlists MD.

### 1. The Markdown (.md) Format
Under the hood, all your songs are Markdown files. This makes them portable and future-proof. You can edit them in the app, or in any text editor (like Notepad or VS Code).

Here is what a song looks like in raw format:
```markdown
---
title: Amazing Grace
artist: Traditional
key: G
tempo: 80
time: 3/4
---

## Verse 1
[G]Amazing grace how [C]sweet the [G]sound
That saved a wretch like [D]me
I [G]once was lost, but [C]now I'm [G]found
Was blind, but [D]now I [G]see
```
* **The top section (`---`)** is called the "frontmatter." It holds the metadata.
* **`##`** creates a new section block (it will automatically color-code it in the app).
* **`[Chords]`** are placed inside brackets directly before the word they are played on.

### 2. The Editor Modes
Setlists MD offers three ways to edit your songs:
* **Visual Editor:** The default. It shows the raw text but gives you a handy toolbar to insert chords, sections, and tabs without typing the brackets yourself.
* **Form Editor:** A fully structured form. No markdown code is visible at all. Great for beginners creating a song from scratch.
* **Raw Editor:** A plain text box for power users who know the format and want to type fast.

### 3. Advanced Chart Features

#### The Capo Calculator
If you are playing a song in Bb, but want to play G shapes, the app does the math for you.
1. Open a song in **Chart View**.
2. Tap the **Key** badge at the top.
3. Select your Capo position (e.g., Capo 3).
4. The chart instantly rewrites all the chords to G shapes, but notes that the actual sounding key is Bb.

#### Nashville Numbers
Toggle Nashville Numbers on or off globally via the **Settings** menu. All charts will instantly render as `1 4 5 6m` instead of `G C D Em`.

#### Modulations (Key Changes)
If a song changes keys halfway through (e.g., moving from E to F# in the Bridge), you don't need a separate chart.
1. In the Editor, place your cursor at the start of the Bridge.
2. Tap **Modulate** in the toolbar.
3. Select how many steps up you are moving (e.g., +2 semitones).
4. The app will insert `{modulate: +2}`. The chart will render a visual "Key Change" banner, and all chords after that point will be transposed up automatically.

#### Inline Notes
Want to remind yourself that the bass drops out in Verse 2?
In the editor, use the **Inline Note** button (or type `{!bass out}`). This will render as a small, colored pill on the chart.

### 4. Instrument Role Profiles
*(Configurable in Settings)*
Different musicians need different views.
* **Worship Leader:** Sees everything (lyrics, chords, notes).
* **Vocalist:** Hides all chords, showing only lyrics and structure cues for a cleaner screen.
* **Drummer:** (Coming soon) Minimizes lyrics and focuses on structure, tempo, and band cues.

### 5. Cloud Sync
Setlists MD runs completely offline using your browser's local storage. To ensure you never lose your data, and to sync across devices:
1. Go to **Settings**.
2. Under Data/Sync, connect your Google Drive, Dropbox, or OneDrive.
3. The app will create a `Setlists MD/` folder in your cloud and sync your `.md` files automatically.
4. **Collaboration:** Share that cloud folder with your bandmates, and everyone stays in sync automatically!

