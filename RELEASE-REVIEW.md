# Public release review — November 1, 2026

## Scope and result

Reviewed the initial Git history and staged public release for secrets, personal content, publication boundaries, and demo licensing. No secrets were detected by Gitleaks 8.30.1 in either scan. The tracked-file guard passed; no private portfolio/configuration/generated-output paths are tracked. This is an engineering review, not a guarantee or independent security certification.

## Verification

- 26 unit tests passed, including explicit deployment opt-in and synthetic media cases.
- npm audit reported zero vulnerabilities at review time.
- Isolated museum demo built ten static pages from six documented public-domain assets.
- Desktop (1440px) and phone (390px): six cards, loaded images, no horizontal overflow; photography filter returned two works and the lightbox opened.
- Generated demo text was checked for family-specific identifiers; none found.
- All six museum records returned is_public_domain=true and matching image IDs.
- Existing personal content and live release were not deployed or changed by demo creation.

## Boundaries and remaining risks

- Email From is not authenticated. Manual local review is mandatory.
- Bridge credentials are owner-only plaintext, not Keychain-backed.
- No unattended polling, durable mail checkpoints, or managed multi-tenant hosting.
- CLI execution assumes a trusted local operator and trusted local configuration; not a filesystem sandbox against malicious local users.
- A publish crash may require reconciliation; rollback changes output, not source records.
- Backup, log rotation, release retention, and reboot recovery remain operator responsibilities.
- Demo image license evidence is recorded in CREDITS.md; license verification must be repeated for any new third-party assets.

## Deployment and rollback

GitHub Pages builds only curated demo output from main with a read-only build job and a separate deployment job. Pull requests never deploy. If public smoke tests fail, disable Pages or revert the offending commit and redeploy. Never substitute local portfolio output as a shortcut.

CI runs on changes and weekly; dependency updates are proposed, not auto-merged. Review scheduled failures before accepting new releases.
