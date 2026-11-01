# Contributing

FolioHouse welcomes fixes, accessibility improvements, hosting recipes, and small, well-tested publishing adapters.

1. Open an issue describing the problem before a large change.
2. Fork and clone; use Node 24 and `npm ci`.
3. Run `node scripts/init-demo.mjs` for synthetic starter content, or `npm run demo:build` for the museum showcase.
4. Make a focused branch and add tests. Run `npm test`, `npm run build` (after initialization), and `npm run privacy:check`.
5. Open a pull request explaining the change, test results, and any compatibility risks.

Never submit personal images, real email fixtures, private profiles, credentials, generated family pages, or log files. Use synthetic fixtures. Do not force-add ignored files. Only public, explicitly licensed showcase assets belong in examples/showcase/assets; record their source and license in CREDITS.md.

Keep approval explicit and separate from ingestion. Email From allowlists are not authentication. Do not add execution of email commands, automatic publication, or unbounded attachment fetching. Mutating commands need a dry-run mode where practical.

Contributions are under MIT unless an asset has a separate documented license. By submitting a contribution, you confirm you have the right to share it under those terms.

## Good first contributions

- More accessible keyboard and screen-reader tests.
- Document a tested static hosting provider.
- Improve provider-neutral email fixtures.
- Design durable IMAP checkpoints and recovery before adding a polling daemon.

Be kind, specific, and constructive. No harassment or disclosure of others' private information. Maintainers may remove unsafe or abusive content. Support is best-effort; there is no SLA.
