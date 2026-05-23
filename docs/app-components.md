# Application Components & Architecture

This document outlines the high-level architecture and logical components (macro and micro) of the application.

### Why is it split this way?
The system is divided into these distinct domains to separate UI/UX responsibilities from core business logic (like music parsing) and data management (sync, local storage). This modular approach (similar to a microservices mindset on the frontend) makes the app more maintainable, ensures that components are reusable, and allows specific parts of the app (like the music parsing engine) to be tested independently of the UI.

---

## 1. App Shell & Navigation (Core UI Framework)
*Purpose: Handles the structural layout of the app and global navigation separately from the actual content of the pages. This is the "frame" that holds everything else.*
- **Dashboard:** The main landing area providing an overview of recent activity and quick access to tools.
- **Desktop TopBar / Mobile TopBar:** The main global navigation bars, dynamically adapting to the user's device.
- **Mobile Drawer (Hamburger Menu):** The slide-out mobile navigation menu.
- **Bottom Navigation ("Smart FAB"):** Context-aware bottom bar on mobile. It transforms based on the active view (e.g., functions as a 'Workspace Switcher' in root views, 'Play Live' in setlist views, and 'Back' in the editor).
- **Global Input Bar ("Just save it" bar):** Centralized quick-creation tool for items like new Songs or Setlists.
- **Settings & Preferences (Unified Modal):** A Notion-style overlay managing application-wide settings without needing dedicated route pages.
  - *Micro-components:* Theme Toggles, i18n Language Switcher, Account Panel, Workspace Toggles.

## 2. Core Library & Organization (Data Views)
*Purpose: These components manage the listing, filtering, and organization of the user's main entities.*
- **Library (Song List):** Displays all songs in the active workspace with filtering capabilities.
- **Setlists Page:** Displays all created setlists.
- **Global Search:** Centralized search state to prevent duplicate input fields and UI overlap across the Dashboard, Library, and Setlists.

## 3. Viewing & Performance (Read-Only Execution Modes)
*Purpose: Dedicated interfaces for consuming content. These are highly optimized for readability, often full-screen, and distraction-free.*
- **Chart View:** The primary component for viewing individual songs, displaying parsed chords and lyrics.
- **Performance / Live View:** A distraction-free, auto-scrolling, or paginated view tailored specifically for stage use during a live event.
- **Practice View:** Focused view for practicing, prioritizing readability and immediate playback context.
- **Setlist Overview:** The view to browse the entire flow and contents of a setlist before diving into performance mode.

## 4. Creation & Editing (Write Modes)
*Purpose: Complex interfaces dedicated strictly to data manipulation and content creation.*
- **Song Editor:** A Notion-style side-by-side interface on larger screens.
  - *Write/Arrange Tools:* The text-based markdown editor.
  - *Metadata Panel & Drawer:* Slide-over drawer for managing secondary metadata (Artist, Capo, Key, Tempo).
  - *Live Preview:* A real-time rendering of the markdown input via the Chart View component.
- **Setlist Builder:** Interface for creating setlists, dragging and dropping songs, and managing the set's flow.

## 5. Styling, Customization & Export
*Purpose: Cross-cutting concerns that format how data is presented or exported outside the app.*
- **Chart Style Customization:** Controls for toggling formatting (e.g., text sizes, alignment).
- **Print Center / PDF Generation:** Logic to format both individual songs and full setlists for physical printing or PDF export.

## 6. Core Music & Parsing Engine (Business Logic)
*Purpose: This is the "brain" of the app. Keeping it entirely separate from the UI ensures it can be tested independently and reused across different views (Editor, Chart View, PDF).*
- **Markdown Parser:** Parses plain-text markdown into structured song data (identifying sections, chords, and lyrics).
- **Transposition Engine:** Handles musical key changes and transposition math.
- **Nashville Number System (NNS) Engine:** Converts standard chords to numerical representation based on the musical key.
- **Chord Diagram Generator:** Renders visual guitar/piano chord diagrams based on chord notations.

## 7. Data, Storage & Sync Services (Persistence)
*Purpose: Abstracts data fetching and saving. The UI components don't need to know if data is coming from the cloud or local storage; they just ask the storage layer for data.*
- **Local Storage Manager (IndexedDB/SQLite):** Manages offline persistence (maintaining the user's Personal Space data across sessions locally).
- **Cloud Database Manager (Supabase):** Manages the real-time cloud connection for Team sync.
- **Google Drive Integration:** Handles backup and synchronization directly to a user's Google Drive.
- **Import/Export Engine:** Manages parsing data from other platforms (e.g., PCO import, generic text imports) and backing up the library.

## 8. Identity, Workspaces & Onboarding
*Purpose: Manages the user's context and access rights before they even interact with their data.*
- **Authentication & User Profiles:** Login, registration, pricing logic, and user account management.
- **Workspace Manager:** Toggles between the isolated "Personal Space" (local data) and "Team/Church Workspaces" (cloud data).
- **Role Management (Simulate Viewer Role):** Global state that controls read/write access, dynamically hiding editing/creation UI elements for standard viewers.
- **Onboarding Flow:** Welcomes users, introduces the application features, and handles the initial injection of Public Domain Templates.

## 9. Scheduling & Team Management
*Purpose: Manages the collaborative aspect of the application, including coordinating with others and planning events.*
- **Schedule:** Interface for planning services, assigning roles, and linking setlists to specific dates.
- **Team Screen:** Dedicated UI for inviting members to a workspace, managing roles/permissions, and adjusting church/team settings.

## 10. System Infrastructure & UX Utilities
*Purpose: Technical components that ensure the app runs smoothly, handles errors gracefully, and provides clear feedback to the user.*
- **Notifications & System Alerts:** Includes `NotificationTray`, `SyncStatus` indicators, and global toast messages for user feedback.
- **Error Boundaries:** Fallback UI screens (like `ErrorBoundary`) that catch and display crashes without breaking the entire application.
- **PWA & Offline Utilities:** Components managing device integrations, such as `WakeLockExplainer` (preventing screens from sleeping during performance) and `IOSInstallHint` (prompting users to install the web app to their homescreen).

## 11. Support, Feedback & Legal
*Purpose: Administrative and user-support pages that exist outside the core workflow of the app.*
- **Support & Help:** `HelpPage` providing documentation or FAQs.
- **User Feedback:** Mechanisms like the `FeedbackButton` to capture user requests and bug reports directly within the app.
- **Pricing & Upgrades:** Interfaces like `PricingScreen` for managing subscriptions and tier limits.
- **Information Pages:** Includes `FounderNote`, and `LegalPage` (Terms & Privacy).