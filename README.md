# FolioHouse

A self-hosted, static-first portfolio publisher for artists, photographers, and small creative collections. Bring your own images, keep your originals private, and publish a beautiful portable website without a database or public admin panel.

**MIT-licensed · self-hosted · static-first.** [Explore the live demo](https://nipunnair.github.io/foliohouse/) · [Contribute](CONTRIBUTING.md) · [Security](SECURITY.md)

**Status: early pilot.** Local import, email draft intake, explicit review/approval, static builds, and atomic local deployment are implemented. This is not an unattended email publishing service.

![The Great Wave — public-domain demo artwork from the Art Institute of Chicago](examples/showcase/assets/24645.jpg)

The demo combines painting, printmaking, and early photography. All sample artwork has documented public-domain provenance; see [image credits](CREDITS.md). No personal portfolio content is included.

## Quick start

Requires Node 22.12+ and npm. Python 3 is needed only for the optional Proton Bridge pilot.

```sh
git clone https://github.com/nipunnair/foliohouse.git
cd foliohouse
npm ci
node scripts/init-demo.mjs --dry-run
node scripts/init-demo.mjs
npm run dev
```

Open http://localhost:4321. The demo uses only a synthetic geometric image generated locally—no family artwork. Initialization refuses to overwrite existing portfolio configuration. Edit the generated `content/site.yaml` to personalize your copy.

## Add your own work

```sh
npm run folio -- add /absolute/path/image.jpg --title "Coastal Light" --alt "Sunlight across a rocky coastline" --collection Photography --publish --dry-run
npm run folio -- add /absolute/path/image.jpg --title "Coastal Light" --alt "Sunlight across a rocky coastline" --collection Photography --publish
FOLIO_SITE=https://portfolio.example.com npm run build
npm run preview
```

`--publish` includes a work in the next build; it does not deploy it. Omit for a draft. Originals are copied, never moved. JPEG, PNG, and WebP still images are supported (25 MB / 40 megapixels per image). Derivatives strip metadata. Exact duplicates are detected. Metadata is explicit YAML, not AI-inferred.

## How publishing works

Email or CLI → private draft → local review → explicit approval → tested static build → release directory → static server.

Astro renders YAML records; Sharp creates display images; a MIME parser normalizes saved email. No database is required. Only the built output is public. The private review HTML is not a public admin interface.

- [Email pilot and Proton setup](EMAIL-SETUP.md)
- [Review, approval, publishing and recovery](REVIEW-PUBLISH.md)
- [Self-hosting and rollback](hosting/README.md)

A profile in `sites/<id>.yaml` defines allowed senders, recipient, collections, and content root. Multiple isolated site builds are supported via `node scripts/build-site.mjs SITE_ID`. Live activation currently supports only an explicitly opted-in root portfolio (`publishLocal: true`); independent production targets per profile are not yet implemented.

## Privacy: source code is not portfolio content

| In Git | Kept outside Git |
| --- | --- |
| UI, publisher scripts, tests, generic examples, documentation | All `content/`, `sites/`, `portfolios/` |
| Dependency lockfile and server template | `.private/`: originals, queue, credentials, certificates |
| Synthetic demo generator | `public/media/`, `dist/`, `.hosting/`, local test screenshots |

Personal files remain on the host and require a separate backup. Git does not back them up. Never serve the repository root. Approved website output is publicly accessible even though its source records are Git-ignored. `noindex` is not access control.

Do not force-add ignored files, submit real emails as test fixtures, or include personal artwork in issues. The MIT software license does not license anyone's portfolio content. Curated demo assets have their own documented public-domain/CC0 status.

## Hosting and portability

Build output in `dist/` can be copied to a static host. The included Caddy template serves a loopback origin; a separately configured reverse proxy/tunnel can provide public HTTPS. Neither GitHub nor email hosts the website. Mac hosting requires the machine to remain awake and the server to remain running.

`FOLIO_SITE` selects the canonical URL; `FOLIO_BASE=/portfolio` supports a subdirectory build. Search indexing remains disabled in the layout during this pilot. Review rights and metadata before enabling it.

## Validation and contributing

```sh
npm test
npm run build
```

Unit tests use temporary synthetic media and mock deployment callbacks. They do not publish to a real site. Browser tests are an additional visual checkpoint; existing gallery-count assertions may need adjustment for your dataset. Test homepage, collections, work detail/lightbox, and mobile layout before deploying.

Contributions should use generic examples, keep adapters separate from approval/deployment, add tests for failure paths, and never bypass explicit approval. Preserve dry-run support for mutating CLI commands.

## Support and roadmap

Use repository issues for reproducible bugs and feature requests, with runtime versions, sanitized errors, and steps to reproduce. Do not include passwords, email bodies, private images, or private review pages. For a security issue, use GitHub private vulnerability reporting if enabled; otherwise request a private contact channel without disclosing the vulnerability publicly. This is a best-effort personal project, with no uptime or support SLA.

Next: durable mailbox polling/checkpoints, provider adapters, separate deployment targets, backup/restore validation, accessibility/browser coverage, and public-release licensing. Gmail API, automatic mail receipts, browser editing, and unattended publishing are not implemented.

## Museum showcase and GitHub Pages

`npm run demo:build` builds an isolated six-work showcase into `demo-dist/`. It does not read or modify your portfolio, inbox, or live release. Source images are bundled, so builds do not depend on museum API availability. To preview at the root locally: `FOLIO_BASE=/ FOLIO_SITE=http://localhost:4322 npm run demo:build`, then `python3 -m http.server 4322 --directory demo-dist --bind 127.0.0.1`.

The Pages workflow deploys only `demo-dist/` from main. Forks should adjust the workflow domain/base path and enable Settings → Pages → GitHub Actions. The showcase is static: visitors cannot email it or upload content to it.

CI runs on pushes, pull requests, and weekly on Mondays at 09:23 UTC. It tests, audits dependencies, checks tracked paths, and builds both examples. A nightly rebuild is unnecessary for bundled static assets. Dependabot proposes dependency updates; deployment is not scheduled and changes are not auto-merged.

## License

Software: [MIT](LICENSE). Demo images: [separate public-domain credits](CREDITS.md). Your own artwork remains yours.
