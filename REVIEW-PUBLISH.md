# Local review and explicit publishing

Run commands from the FolioHouse project directory. Substitute a full submission ID from `node scripts/intake.mjs list --site demo` for SUBMISSION_ID. Enable publishLocal in the root profile only after verifying your deployment target.

## 1. Review privately

```sh
node scripts/review.mjs preview SUBMISSION_ID --site demo
```

Open the printed `review.html` locally. It embeds optimized image previews, escapes metadata, and loads no remote resources. It lives in the private queue, not the web server. This is a standalone review document, not an exact portfolio-page preview. Regenerate after editing. Do not share it publicly without permission.

## 2. Edit metadata

```sh
node scripts/review.mjs edit SUBMISSION_ID --site demo --title 'Final title' --alt 'An actual visual description' --description 'The artist’s statement' --collection Illustrations --featured no
```

Add `--dry-run` to inspect proposed edits. Metadata edits invalidate prior approval. No AI inference or email instruction can approve a submission. Currently only single-image submissions can be approved; split multi-image submissions first. Replace all test descriptions and confirm attribution/rights manually.

## 3. Approve

```sh
node scripts/review.mjs approve SUBMISSION_ID --site demo --dry-run
node scripts/review.mjs approve SUBMISSION_ID --site demo --confirm
```

Approval records a hash of reviewed metadata/media references. Originals are hash-checked. Empty/placeholder alt text, test titles, unconfigured collections, and multi-image submissions are blocked. This is local owner approval, not proof that an email From header was authentic.

## 4. Publish (changes the public site)

```sh
node scripts/review.mjs publish SUBMISSION_ID --site demo --dry-run
node scripts/review.mjs publish SUBMISSION_ID --site demo --confirm
```

The command acquires deployment/import locks, imports the image, tests and builds, checks the work page exists and private directories are absent, copies a release, retains the previous target, and atomically switches the live symlink. Previously published submissions return `already-published`. Existing image duplicates are refused rather than silently updating another work.

Verify the public page after publishing. Publication does not send email receipts or start mailbox polling. No automatic publishing service is installed.

## Failure and rollback

If build/publishing fails, the imported work is reverted to a draft and the submission becomes `needs-reconciliation`. Do not blindly retry or delete lock files while a process is active. Inspect `.hosting/current`, `.hosting/last-review-publish.yaml`, and the submission record. A hard crash after switching the release but before recording success may leave `publishing` state; the private journal identifies its release. Reconcile manually. This conservatively prevents automated duplicate publishes.

For a completed release, `node scripts/deploy-local.mjs --rollback` restores the previous static release. **Rollback is output-only:** also reconcile the source work's publication flag before another build, or it will reappear. Previously published submissions are not automatically reapproved by rollback.

## Validation

`npm test` includes approval gates, stale approval, HTML escaping, dry-run, duplicate publication, changed attachment detection, and a simulated deployment failure. Tests use disposable synthetic content and mock deployment callbacks; they do not switch the real server. Actual public activation still needs an owner-approved real artwork and end-to-end verification.
