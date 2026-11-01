# Self-hosting

Only serve generated output, never the project root. The included Caddyfile listens on 127.0.0.1:4381 and serves the FOLIO_WEB_ROOT environment variable.

For a local release:

```sh
FOLIO_SITE=https://portfolio.example.com node scripts/deploy-local.mjs --dry-run
FOLIO_SITE=https://portfolio.example.com node scripts/deploy-local.mjs
FOLIO_WEB_ROOT="$PWD/.hosting/current" caddy run --config hosting/Caddyfile --adapter caddyfile
```

Deployment tests/builds, copies a versioned release, and atomically switches .hosting/current. Configure your own domain and HTTPS reverse proxy or Cloudflare Tunnel to this loopback origin. These commands do not create DNS records or install a startup service. A macOS user LaunchAgent starts at login, not necessarily before login after reboot; test reboot recovery separately.

`node scripts/deploy-local.mjs --rollback` switches to the previous output. It does not revert content records: reconcile source publication state before rebuilding. Retained releases are not off-machine backups.

Back up private content and original media separately. Monitor disk usage, retain only needed releases, rotate service logs, keep the host awake, and verify remote HTTPS after each deployment. No retention, backup, or monitoring service is bundled.
