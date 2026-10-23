# Universal Downloader web UI

Next.js (App Router) + TypeScript + Tailwind CSS. All text goes through `src/i18n`
(`messages/th.json`, `messages/en.json`; Thai is the default, the choice is stored in
`localStorage`).

```bash
npm ci
npm run dev          # http://localhost:3000, proxies /api/v1 to API_INTERNAL_URL (default http://127.0.0.1:8000)
npm run lint && npm run typecheck && npm test
npm run build && npm run start
npm run e2e          # Playwright; starts the test API + fixture server itself
```

On Windows use `npm.cmd` instead of `npm` in PowerShell.

Structure: `src/app` (pages: dashboard, history, settings, error, not-found), `src/components`
(shared UI), `src/features/inspect` (URL form, analysis result, format picker),
`src/features/jobs` (queue, polling, job cards), `src/lib` (API client, types, formatting).
`src/lib/types.ts` mirrors `services/api/app/schemas/models.py`.
