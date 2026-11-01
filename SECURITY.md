# Security and privacy

Report vulnerabilities using GitHub's **Security → Report a vulnerability** for this repository. Do not post secrets, exploitable details, private artwork, or real email messages in public issues.

## Trust boundary

This is an early, local-owner-operated publisher, not a hardened multi-user service. A trusted operator runs the CLI. Saved email is untrusted input: sender allowlisting is a filter, not proof of identity. Review and approval remain local and explicit. No public write API or browser admin is provided.

Credentials are stored in an ignored, owner-only local file, not a secret vault. Bridge certificates are explicitly pinned. Restrict filesystem access and maintain independent backups. Never expose the repository root; serve only the generated static release.

The public demo builds only from a curated, explicitly licensed manifest in an isolated temporary workspace. It never reads a local portfolio, mailbox, queue, or hosting configuration.

## Release checks

- Scan full Git history and the staged release with Gitleaks (redacted).
- Run the tracked-file privacy guard, dependency audit, unit tests and demo build.
- Check artifact contents and desktop/mobile rendering.
- Verify asset source records and attribution.
- Deploy only from main; pull requests have read-only build permissions.

Scans reduce risk; they do not prove absence of every secret or vulnerability. No third-party penetration test has been performed.
