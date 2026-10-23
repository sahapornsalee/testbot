# AGENTS.md — Productivity Hub

## 1. Project Mission
Build a reliable, responsive, customizable All-in-One Productivity Hub.
The application must run as a static web application and be deployable to GitHub Pages.

## 2. Authoritative Documents
Before changing code, read:
- README.md
- docs/REQUIREMENTS.md
- docs/ARCHITECTURE.md
- docs/ROADMAP.md
- docs/PROJECT_STATUS.md
- docs/DECISIONS.md and relevant module specifications

If documents conflict, stop and report the conflict instead of guessing.

## 3. Core Technical Rules
- Use React and TypeScript with Vite.
- Keep features modular and loosely coupled (one folder per tool in `src/features/`).
- Use strict TypeScript settings.
- Prefer small, testable functions and reusable components. Keep domain logic out of components.
- Keep dependencies minimal; explain why before adding one.
- Use local-first storage.
- Never assume a backend, API, database service, or secret is configured.
- All deployment paths must support the actual GitHub repository base path (`BASE_PATH`).

## 4. Coding Rules
- Inspect existing code before editing; reuse existing components and conventions.
- Do not overwrite unrelated user changes or remove working functionality without approval.
- Avoid `any`; document justified exceptions.
- Validate imported data and external input.
- Handle loading, empty, success, and error states.
- Do not store sensitive information in logs.
- Do not use `dangerouslySetInnerHTML` or `eval` without a reviewed and justified need.

## 5. Local Data and Privacy
- Store settings in LocalStorage only when appropriate; use IndexedDB for structured user content.
- Every persisted value has a version and a validating parser; invalid data falls back to defaults.
- Provide validated import and export.
- Do not transmit user data to external services without explicit approval.
- Do not put API keys, tokens, or secrets in client-side source code.
- Handle storage failures and invalid persisted data safely.

## 6. Testing Requirements
For each change:
1. Run relevant unit tests (`npm run test`).
2. Run lint and type checks (`npm run lint`, `npm run typecheck`).
3. Run the production build (`npm run build`).
4. Add or update tests for changed behavior.
5. Report commands executed and actual results.
6. Never claim tests passed unless they were executed successfully.

## 7. Risk and Approval
- **L1**: Routine UI, documentation, isolated low-risk fixes. May edit within the assigned scope.
- **L2**: Shared interfaces, storage schemas, dependencies, cross-module changes. Present a plan and review affected interfaces before implementation.
- **L3**: Data deletion, security-sensitive changes, workflow permissions, broad dependency upgrades, destructive commands. Require explicit user approval before execution.
- **L4**: Production deployment, secret rotation, repository permission changes. Require explicit user approval.

Never expose secrets or run destructive commands without authorization.

## 8. Git Rules
- Inspect `git status` before editing and preserve unrelated changes.
- Use feature branches for substantial work. Do not force-push.
- Do not commit secrets, `.env` files, or local user data.
- Request approval before committing or pushing high-risk changes.

## 9. Task Completion Report
After every task, report: objective and scope; files created, modified, or deleted; important design decisions; tests and commands actually executed; failures and unresolved issues; security and regression risks; suggested next task.
Update docs/PROJECT_STATUS.md when status, decisions, milestones, or known issues materially change.

## 10. Definition of Done
A task is complete only when its acceptance criteria are met, the relevant tests have been run, no known regression is ignored, documentation is updated when needed, and remaining risks are reported.
