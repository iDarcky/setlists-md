# Architecture Ideas: Scaling Beyond Single .md Files

This document summarizes the strategic discussion regarding the evolution of the data architecture in Setlists MD. As the application grows to support multi-arrangements, per-user/per-setlist notes, PDF attachments, and a multi-tenant SaaS model for churches, relying on a single `.md` file as the absolute source of truth becomes a bottleneck.

## The Problem with the Current `.md` Approach
Currently, the application parses a single `.md` file into a `v2 multi-arrangement schema` internally, but serializes it back to a single text blob.
This creates several limitations for the future scope:
1. **Arrangements:** Storing multiple distinct arrangements (e.g., Acoustic vs. Full Band) in one file requires non-standard syntax that breaks typical markdown parsers.
2. **Contextual Notes:** Collaborative data (e.g., a specific user's note for a specific setlist item) cannot be safely embedded into a core song `.md` file without causing massive merge conflicts.
3. **External Links:** Linking to PDFs or other songs requires bloating the frontmatter and is fragile if external file IDs change.

## The Proposed Solution: The Hybrid Relational Approach
The future of Setlists MD requires a **Hybrid Approach**:
- **Relational Data (JSON/SQL)** for metadata, relationships, and user-specific contextual overrides.
- **Markdown (Text)** strictly for the lyrical and chord content of specific sections.

### 1. Supabase Architecture (For Teams / SaaS)
For multi-tenant scaling (hundreds of churches), data must be strictly isolated and instantly queryable using PostgreSQL and Row Level Security (RLS).

**Proposed Schema:**
- `teams` (id, name)
- `songs` (id, team_id, title, artist, ccli)
- `arrangements` (id, song_id, team_id, name, key, tempo, `content` [TEXT column holding `.md` body])
- `user_notes` (id, target_id, user_id, team_id, content)
- `attachments` (id, song_id, type [e.g., pdf], url)

*Why this works:*
- Total data isolation between churches.
- Lightning-fast queries (e.g., "Find all songs in G").
- Easy implementation of a "Template Library" (`public_songs`) that users can import into their own `team_id` tables.

### 2. "Bring Your Own Cloud" (BYOC) Architecture (For Solo/Pro Users)
For users syncing via Google Drive, Dropbox, or iCloud, the data must exist as actual files they can own and interact with.

**The "Song Bundle" Concept:**
A "Song" becomes a Folder containing discrete files:
```text
📁 Songs/
  📁 Amazing Grace/
    📄 Acoustic.md          <-- Arrangement 1 (just lyrics/chords)
    📄 Full Band.md         <-- Arrangement 2
    📄 sheet_music.pdf      <-- Attached PDF
    📄 notes_bob.md         <-- Bob's personal notes
```

**The Adapter Pattern:**
The React frontend only consumes a unified JSON object (`v2 multi-arrangement schema`).
- **Supabase Adapter:** Reads/writes to Postgres rows and constructs the JSON.
- **BYOC Adapter:** Reads/writes to the cloud folder structure and constructs the exact same JSON.
This allows the UI to remain ignorant of the storage mechanism.

## Ripple Effects & Implementation Considerations

1. **Separation of ID and Display Name:**
   To allow users to rename songs without breaking links (setlists, notes), songs must rely on hidden Unique IDs (e.g., `id: "song_5f8a9b"` in the frontmatter or database row) rather than the title string or file path.
2. **Editor UI Changes:**
   Users should no longer edit raw YAML frontmatter directly in the `RawTab.jsx` to prevent breaking IDs and relationships. `FormTab.jsx` must become the primary interface for metadata (Tags, Tempos, Links).
3. **Data Ownership Guarantee:**
   Even for Supabase users, the app must provide an "Export" feature that synthesizes their relational data into the clean "Song Bundle" folder structure, guaranteeing true data ownership.
4. **Migration Strategy:**
   A one-time migration script will be needed to convert existing users' local `chordvault:` IndexedDB single `.md` files into the new relational/folder structure.
5. **Search Complexity:**
   Global search will need to query across joined tables in Supabase (requiring Full-Text Search indexing) or iterate through the synthesized local JSON cache for BYOC/offline users.

## Conclusion on Tech Stack
Supabase remains the optimal choice for this architecture. It provides the necessary relational power (Postgres) and security (RLS) required to scale a multi-tenant SaaS application, while maintaining the flexibility to build a BYOC file-based alternative for solo pro users.
