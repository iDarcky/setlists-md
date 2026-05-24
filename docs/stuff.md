# Organized Feature Ideas & Bug Reports

This document organizes the backlog of ideas, features, and bugs provided for Setlists MD. They have been categorized by importance and functionality, incorporating specific details and clarifications to guide development for V1 and beyond.

## 🔴 Immediate / High Priority Bugs (Critical V1 Blockers)
*   **Sync Engine Rework**: The sync engine is acting strangely, especially for church/team accounts. The whole sync engine needs to be robustly reworked to ensure data continuity.
*   **Role-Based Access Control (RLS) Fix**: Members currently have the ability to edit songs, which they should not be able to do. This is a critical UI gating and backend RLS issue.
*   **Settings Modal Interaction Bug**: Users can interact with the background while the settings panel is open. Add `overscroll-behavior-none` and ensure clicking outside the modal closes the settings.
*   **Theme Menu Bug**: The layout themes sometimes fail to change properly when selected from the layout menu.
*   **Print/PDF Bug**: Fix the print button, specifically addressing the iPad PWA standalone popup blocking issue.

## 🟡 MVP Enhancements & Core UX Refinements (V1/V1.5)
*   **Better Setlist Manager**: Improve the setlist manager UI. Make it easier to reorder songs (drag & drop functionality, particularly on mobile) and provide a better way to delete or edit items without entering the full editor.
*   **Unsaved Changes Warning**: Add a confirmation dialog ("Are you sure you want to cancel the edit?") for both songs and setlists if the user attempts to leave the page via refresh, browser back button, or clicking other tabs.
*   **Workspace Switcher Redesign**: Improve the top modal/workspace switcher (Personal vs. Church/Team) to make it cleaner and more prominent.
*   **Setlist Roster Visibility**: Add a tab or section within the Setlist Overview/Player that clearly shows the roster (who is playing) alongside the songs.
*   **iPad/Tablet UI Polish**:
    *   Fix the top overflow issues on iPad.
    *   Ensure the sidebar is properly scrollable on iPad.
    *   Implement a better navigation bar layout for tablet screens.
*   **Library Layout Location**: Move the Library layout settings out from their current buried settings location.
*   **Tags vs. Services Differentiation**: Separate general song attributes (Tags, e.g., "Fast", "Acoustic") from event-specific labels (Services, e.g., "Youth", "Sunday Morning").
*   **Feedback Button Removal**: Remove and/or fix the existing feedback button in the UI.
*   **Export All to ZIP**: The "Export All" functionality should automatically package the files into a `.zip` archive.
*   **Dashboard Default on Workspace Swap**: Whenever a user swaps workspaces (e.g., from Personal to Team), automatically navigate them back to the Dashboard.

## 🔵 Pro / Live Display Customizations & Practice Tools
*   **Practice Mode Chord Editing**: Create an easier way to edit chords directly from Practice/Rehearsal mode. Modifying chords here should automatically create a new arrangement (using the old one as a template) linked to that session, rather than altering the base library song.
*   **Per-Setlist Overrides (Tempo, Key, Structure)**: Allow users to override a song's tempo, key, and structure specifically for a given setlist. These overrides should be saved for future reference but not alter the original library file.
*   **Multi-Tiered Notes System**:
    *   *Global Notes*: Tied to the base song in the library.
    *   *Setlist Notes*: Tied to the song only within a specific setlist.
    *   *User Notes*: Private notes only visible to that specific user for that song/setlist.
*   **Local Capo Settings**: Make Capo settings local only (saving to the device/user) so they don't sync and alter the chart for the rest of the team.
*   **Chart Display Toggles**:
    *   *Content Types*: Toggle between Chords and Lyrics, Lyrics Only, Song Map, and Chords Only.
    *   *Chord Formats*: Toggle between Standard Letters, Numerals/Nashville (Romans), and Do-Re-Mi (Solfège).
    *   *Structure Formats*: Toggle between Full or Condensed song sections.
*   **Customizable Song Page (Pro)**: Fully customizable song page (backgrounds, separate fonts for different elements, custom section colors).
*   **Custom Song Sections**: Allow users to add 2-3 customizable song sections that they can edit.
*   **Chord Diagrams Upgrade**: Fix chord diagrams and allow users to tap on a chord to view the diagram directly.
*   **Structure Scrolling**: Make the structure ribbon scrollable, potentially linking it to the song's scroll position.
*   **Different Live/Performance View**: Ensure the current song is prominently displayed elsewhere, not just in the title, during Live mode.

## 🟢 Advanced Features & Tooling (V2+)
*   **Rehearsal Mode Structure Editing**: Allow users to edit the song structure directly from the Rehearsal/Practice view.
*   **Calendar & Rehearsal Scheduling**: Extend the calendar to include rehearsal time booking and calendar notifications (or push notifications later). Include an option to filter the list view to only show Sundays.
*   **Detailed Metrics**: Provide repertoire metrics (e.g., most common key, BPM distribution, song fatigue alerts/most played songs).
*   **Public Domain Starter Pack**: Include a bundled packet of public domain songs (English initially) so users have content to test the app with immediately.
*   **TypeScript Migration**: Migrate the core codebase from JavaScript to TypeScript for better stability.
*   **New UI / Design Pass**: A general overarching "New UI" pass for better customization (e.g., a better button for customization, different accent colors for the church team, white line dividers in settings).
*   **Church Branding Customization**: Allow churches to set a custom logo and specific accent color.
*   **Enhanced Navigation Pills**: Add more options or context to the next/prev pill navigation.
*   **Setlist Dropdown**: Implement a setlist dropdown accessible from the song name or a similar prominent location.
*   **Setlist Item Indicators**: Add dots at the bottom of the page indicating how many items are in the current setlist.
*   **Advanced Filtering**: Show multiple active filters simultaneously in the library view.

## 🟣 Cloud Sync & Collaboration (V3)
*   **Team Collaboration (Planning Center Style)**: Advanced team features mirroring Planning Center (assigning roles, managing schedules).
*   **Pro/Sync vs. Church/Band Split**: Further differentiate the experience and features between individual Pro/Sync users and Church/Band members.
*   **Automated Roster Sorting**: Rework how members are added to a setlist, perhaps auto-sorting them or automatically adding them based on role.
*   **Missing Personnel Warnings**: Add a warning system if a setlist is missing a specific required player or a minimum number of vocalists.
*   **Tasks & Delegation**: Add a system for leaders to delegate tasks or leave administrative notes within the app.