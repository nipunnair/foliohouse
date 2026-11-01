# Email-to-portfolio pilot

The provider-neutral path accepts saved MIME messages. Proton Bridge adds a manual, read-only fetch helper. Gmail and other providers can supply exported .eml files; a Gmail API connector is not implemented.

## Configure routing

Initialize the generic demo or copy `examples/profile.yaml` to `sites/demo.yaml`. Replace the example recipient and sender with your own addresses. Profiles are Git-ignored. Use an additional mailbox address or alias delivered into an account you control; a separate paid mailbox is not required. Create a recipient-specific folder/filter.

Send one ordinary attached image, not an inline signature:

```text
To: publish@example.com
Subject: Evening garden

Collection: Photography
Alt: Late afternoon light on a garden path.
Featured: no
Action: draft

A quiet moment in the garden.
```

Title comes from Subject. Control fields precede description. HTML-only email is converted to plain text; HTML is never rendered. Unknown categories/senders/recipients fail validation. From matching is NOT sender authentication. Even Action: publish remains a private draft.

```sh
node scripts/intake.mjs email /absolute/path/submission.eml --site demo --dry-run
node scripts/intake.mjs email /absolute/path/submission.eml --site demo
node scripts/intake.mjs list --site demo
```

Up to ten attachments may be queued, but approval/publication currently supports only one image per submission. Send separate messages for separate works.

## Proton Bridge on the publishing host

1. Install Bridge, sign in, and verify its local IMAP details. These helpers support loopback port 1143 with STARTTLS.
2. Run `python3 scripts/setup-mail.py` in your terminal. Enter Bridge's generated password, not your Proton account password. Set the profile ID and recipient-specific folder.
3. Credentials are plaintext in owner-only `.private/mail/bridge.json`, not Keychain. Never commit or share them.
4. Independently inspect the local Bridge certificate and verify its SHA-256 fingerprint. Enroll with `python3 scripts/check-mail.py --trust-local-certificate --expected-fingerprint VERIFIED_SHA256`. Do not blindly trust a fingerprint from an unexpected endpoint. Subsequent checks use the pinned certificate.
5. Send a message with subject "FolioHouse test artwork", then run `python3 scripts/fetch-test-mail.py --list-candidates` and `python3 scripts/fetch-test-mail.py --uid UID`.
6. Follow [review and publish](REVIEW-PUBLISH.md), replacing the test title and placeholder metadata before approval.

Fetch uses read-only selection and BODY.PEEK, validates size, and removes temporary raw email after parsing. It does not mark mail read, delete mail, send receipts, or start a service. Candidate listing displays message headers locally; do not paste private output in issues.

No background polling, durable UID/UIDVALIDITY checkpointing, or automated retry is installed. This is a deliberate manual pilot, not a production mailbox daemon.
