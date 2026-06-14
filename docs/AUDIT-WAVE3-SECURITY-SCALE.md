# Wave 3 Audit — Security & Scale

Read-only audits from the backlog triage (Wave 3 foundations). Evidence-based,
with file:line. Nothing here is fixed yet — this is the worklist.

Generated 2026-06-15 against `claude/zealous-mayer-jma2e8` (based on `beta`).

---

## Security / input-sanitization audit

**Overall:** strong baseline — React auto-escaping covers the main app, PDF
export HTML-escapes user content (`escapeHtml`), all `target=_blank` links carry
`rel="noopener noreferrer"`, Supabase queries are parameterized (no string-built
`.or()/.filter()`), and team data is RLS-isolated. **No critical findings.**

### High
- **CSP is report-only, not enforced** — `vercel.json:18` uses
  `Content-Security-Policy-Report-Only`. Violations are logged, not blocked.
  Flip to enforcing `Content-Security-Policy` once the PDF inline-script issue
  below is resolved (the print iframe needs a nonce/hash first — see
  CLAUDE.md "Known Gotchas"). _Remediation:_ add nonce/hash for the PDF inline
  script, then enforce.

### Medium
- **PDF inline `<script>` has no nonce** — `src/pdf/pdfDocument.js:834,1000`.
  Static today, but blocks enforcing CSP. _Remediation:_ per-export nonce in the
  script tag + CSP, or externalize the init script.
- **PDF prefs JSON embedded with partial escaping** — `pdfDocument.js:641,1011`
  escapes `<` but not quotes/backslashes; prefs come from `localStorage`.
  _Remediation:_ validate the prefs shape (numeric/enum) before embedding.
- **`Object.assign(merged, sbs.all)` with team-activity data** —
  `TeamScreen.jsx:598`. Low real risk (RLS-gated) but prototype-pollution-shaped.
  _Remediation:_ enumerate + coerce types instead of `Object.assign`.

### Low
- **Share token entropy ~80 bits + regex allows 8-char tokens** —
  `share/setlistShare.js:14-20,32`. _Remediation:_ 22–32 chars / wider alphabet;
  raise the regex minimum.
- **OAuth token cleanup is timer-deferred (~150ms)** — `App.jsx:584-589`.
  _Remediation:_ `replaceState` synchronously; wrap session detection in
  try/catch so cleanup always runs.
- **No maxLength on several text inputs** (song title/artist/notes, setlist
  name) — `editor/MetadataPanel.jsx`, `setlist/SetlistMetaForm.jsx:94`.
  Unbounded → storage/UI-break. _Remediation:_ cap (title 200, artist 150,
  notes 1000, setlist 200). **Ties to backlog §1 field-limits.**
- **ZIP import manifest not schema-validated** — `JSON.parse` of `_setlist.json`
  with no shape check. _Remediation:_ validate before processing.
- **`window.opener.localStorage` accessed without origin check** —
  `pdfDocument.js:658-672`. _Remediation:_ compare origins first.

### Confirmed non-issues
No `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`document.write` on user data;
markdown is not rendered as raw HTML; share snapshot rendering goes through
React escaping; security headers (HSTS, X-Frame-Options, etc.) present.

### Suggested fix order
1. (Backlog quick win) input maxLengths — overlaps §1 field-limits.
2. PDF prefs shape validation + ZIP manifest validation.
3. Share token entropy bump + synchronous OAuth cleanup.
4. PDF nonce → then enforce CSP (bigger, do deliberately).

---

## Scale / performance audit

_Pending — running. Findings appended when the audit completes._
