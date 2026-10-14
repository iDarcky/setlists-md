# Design skills

Third-party Claude Code skills vendored into the repo so every session (local or cloud) has them.
Each keeps its upstream licence beside it. To update, re-copy from the upstream source.

| Skill folder | Upstream | Commit | Use it for |
| --- | --- | --- | --- |
| `frontend-design` | anthropics/claude-code `plugins/frontend-design` | 9b4f0d6 | Distinctive visual direction, type, copy |
| `ui-ux-pro-max` | nextlevelbuilder/ui-ux-pro-max-skill | 7246805 | Accessibility, touch, layout, forms, nav rules + searchable data (`python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain ux`) |
| `taste-skill` | Leonxlnx/taste-skill `skills/taste-skill` | a60a36d | Marketing/landing pages (not app screens) |
| `redesign-skill` | Leonxlnx/taste-skill `skills/redesign-skill` | a60a36d | Auditing and upgrading existing app UI |

Trimmed on import: upstream test suites and evals. Other skills in the taste-skill repo
(brandkit, soft, brutalist, stitch, imagegen) were not copied; add them the same way if wanted.
`.claude/` is in ESLint's ignore list so the skills' scripts never affect `npm run lint`.
