# Design skills

Third-party Claude Code skills vendored into the repo so every session (local or cloud) has them.
Each keeps its upstream licence beside it. To update, re-copy from the upstream source.

| Skill folder | Upstream | Commit | Use it for |
| --- | --- | --- | --- |
| `frontend-design` | anthropics/claude-code `plugins/frontend-design` | 9b4f0d6 | Distinctive visual direction, type, copy |
| `ui-ux-pro-max` | nextlevelbuilder/ui-ux-pro-max-skill | 7246805 | Accessibility, touch, layout, forms, nav rules + searchable data (`python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain ux`) |
| `web-design-guidelines` | vercel-labs/agent-skills | 063bee9 | Code review against Vercel's Web Interface Guidelines (fetches the latest rules; `guidelines-snapshot.md` is an offline copy) |
| `react-best-practices` | vercel-labs/agent-skills | 063bee9 | React re-render, bundle and data-loading performance |
| `accessibility` | addyosmani/web-quality-skills | afa8da9 | WCAG 2.2 audit |
| `performance` | addyosmani/web-quality-skills | afa8da9 | Load and runtime performance |
| `best-practices` | addyosmani/web-quality-skills | afa8da9 | Security, compatibility, code quality |
| `web-quality-audit` | addyosmani/web-quality-skills | afa8da9 | Combined Lighthouse-style audit in a real browser |

Trimmed on import: upstream test suites and evals. taste-skill (Leonxlnx/taste-skill) was tried and
removed: it targets marketing pages, not app screens. Re-add it for the church website if wanted.
`.claude/` is in ESLint's ignore list so the skills' scripts never affect `npm run lint`.
