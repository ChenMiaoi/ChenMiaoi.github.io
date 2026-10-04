# Orbital deployment

Production serves `https://nyachen.cn` through Cloudflare and the existing Nginx
configuration. GitHub Pages publishes the static Orbital frontend at
`https://chenmiaoi.github.io/`, so the existing public address stays current.
Canonical URLs continue to point to `https://nyachen.cn`.

## Pipeline

- Pull requests to `main`: install the locked dependencies, run `pnpm verify`
  (including the Orbital production build), and test the deployment receiver.
- Pushes to `main` and manual runs on `main`: run the same checks, save only the
  production frontend once. `dist/` goes to GitHub Pages; `.output/vps/` adds a
  bundled contribution service for the VPS. RAG backend files are not uploaded.
  CI does not run contribution synchronization or schedule data refreshes.
- Each deploy job checks that its commit is still the tip of `main`. Superseded
  runs are skipped. Deployments are serialized and an active deployment is not
  cancelled by the next push.
- The GitHub Pages repository setting must use GitHub Actions as its source.
  The Pages job alone receives `pages: write` and `id-token: write`; pull
  requests do not publish or receive the VPS key.
- SSH checks the pinned server host key. The dedicated key cannot open a shell,
  forward ports, or edit Nginx, certificates, other applications or databases.
  Runtime setup grants only restart/stop of `nyachen-contributions.service`.
- The receiver verifies the archive checksum, rejects unsafe paths and links,
  checks required build outputs and the Orbital homepage marker, and atomically switches `current`.
- Direct origin HTTPS checks verify `deployment.json`, the homepage, English
  homepage, Pagefind and the contribution service release. Failure switches both
  the website and service back and fails CI. Public Cloudflare
  cache behavior is separate; origin checks deliberately bypass it.

## Server setup (once, as root)

The existing Nginx root stays `/var/www/nyachen.cn`. Setup replaces that **empty**
directory with a symlink and refuses to replace existing website content.

```text
/var/www/nyachen.cn -> /var/www/nyachen-deploy/current
/var/www/nyachen-deploy/
  current -> releases/<commit>-<run-id>-<attempt>
  previous -> releases/<previous-release>
  releases/                  # five newest releases, plus rollback target if older
  shared/.well-known/        # preserved ACME challenge files
  .staging/                  # private upload staging, cleaned after each operation
/usr/local/sbin/nyachen-deploy # root-owned receiver
/var/lib/nyachen-deploy/.ssh/authorized_keys
```

Generate a dedicated Ed25519 key outside the repository. Copy **only its public
key**, `scripts/deploy/setup.sh`, and `scripts/deploy/receive.py` to a temporary
directory on the server. From there, run:

```sh
bash setup.sh /absolute/path/to/deployment-key.pub
```

Before runtime setup, `nyachen-deploy` has no sudo privileges. Its public-key file is
root-owned; SSH forces the receiver with a three-minute timeout. Updating the
receiver requires reinstalling it as root; CI cannot replace its own receiver.
Nginx configuration, Cloudflare, certificate/key files, renewal jobs, historic
blog backups and other server workloads are preserved.

## VPS contribution service (one-time setup)

The VPS uses Nginx for static frontend files and a loopback-only Node service for
`/contributions.json`. Pages retains a static copy at the same URL. Node 22 or newer
must be installed at `/usr/bin/node`; building/testing locally requires Node 24.
The runtime bundle includes all dependencies and initial public snapshots.

After validating the receiver tests, copy `setup-runtime.sh`, `receive.py`,
`nyachen-contributions.service` and `contributions.nginx.conf` together to the VPS.
As root run `bash setup-runtime.sh` (optionally pass the Nginx configuration path,
default `/etc/nginx/conf.d/nyachen.conf`). This creates the unprivileged service user,
preserves any existing data and environment file, installs the service/receiver,
and grants the deploy user only two exact service-management commands.

Setup adds `include /etc/nginx/snippets/nyachen-contributions.conf;` after the
unique exact `server_name nyachen.cn;` directive, backs up the configuration under
`/var/backups/nyachen-runtime`, tests Nginx and reloads it. Failed validation or
reload restores the prior configuration. Nonstandard configurations without this
unique directive are rejected for manual inspection rather than guessed.
The snippet blocks public access to `/runtime/`, proxies the contribution feed,
and falls back to the build snapshot when the process is unavailable. Keep any
CDN cache rules from overriding the feed's `no-cache` header. Other hostnames and
TLS/ACME configuration remain unchanged.

The next VPS deployment starts the service automatically and verifies its release.
Later deployments restart it and roll it back if health checks fail. Rolling back
to a pre-service static release stops the service and uses that release's snapshot.

```text
/var/www/nyachen-deploy/current/runtime/server.mjs  versioned application
/var/lib/nyachen-contributions/snapshot.json       persistent data (service-owned)
/etc/nyachen-contributions.env                    optional credentials (root-only)
```

The service seeds data only when `snapshot.json` is absent. Invalid existing data
causes a visible startup failure instead of overwriting it. Activity and details
are published together after successful synchronization. Each cycle runs once;
cycles never overlap. Requests are bounded and rate-limit headers delay further
attempts. Existing data stays available on network failure. Service logs expose
failures; `/api/contributions/health` reports the release, last successful sync and
whether the latest attempt failed. It is a process-readiness check, so a temporary
GitHub failure does not roll back otherwise healthy application code.

Public GitHub data works without a credential, subject to the shared IP limit
(normally 60 requests/hour). For reliable 15-minute refreshes, set a dedicated
read-only `GITHUB_TOKEN` in `/etc/nyachen-contributions.env` and restart the service.
Do not copy personal CLI credentials into releases or commit environment files.
Optional settings: `CONTRIBUTION_SYNC_SECONDS=900`, `CONTRIBUTION_PORT=4336`, and
`CONTRIBUTION_DATA_DIR`. Changing the port also requires updating the Nginx snippet
and receiver readiness probe. Initial historical backfill is not performed:
new open authored/assigned work is discovered, previously tracked work is retained
after closure/merge, and configured commit references remain curated.

```sh
systemctl status nyachen-contributions
journalctl -u nyachen-contributions -n 50
curl --fail http://127.0.0.1:4336/api/contributions/health
```

Back up the persistent data directory separately. Changing application code still
requires deployment; ordinary GitHub updates do not require a build or deployment.

For local dynamic UI testing, run the built bundle with `CONTRIBUTION_DATA_DIR`
pointing to an ignored local directory, then start Astro dev with
`CONTRIBUTION_API_ORIGIN=http://127.0.0.1:4336`. The dev proxy serves the real feed
at the same URL as production. `CONTRIBUTION_SYNC_DISABLED=1` serves existing data
without contacting GitHub (for offline tests only).

Before a receiver upgrade, run its tests in a temporary directory:

```sh
python3 -m unittest discover -s scripts/deploy -p 'test_*.py' -v
```

The tests create isolated temporary roots; they never use the real webroot.

## GitHub production environment

Allow deployments from the `main` **branch only**. No approval gate is required
for automatic publication on push. Store these values in that environment:

| Type | Name | Value |
| --- | --- | --- |
| Variable | `DEPLOY_HOST` | Direct server IPv4 or unproxied hostname |
| Variable | `DEPLOY_PORT` | SSH port, normally `22` |
| Variable | `DEPLOY_USER` | `nyachen-deploy` |
| Variable | `DEPLOY_KNOWN_HOSTS` | Hostname/IP plus verified server public host key |
| Secret | `DEPLOY_SSH_KEY` | Dedicated deployment private key |

Obtain the host key through an already trusted SSH connection, not an unverified
key scan in CI. For a nonstandard port, the known-hosts hostname must use
`[host]:port`. The private key is written to a temporary file only during the
deploy job and is removed when the client exits. Never commit it or print it.

## Local validation, publication and rollback

Copy `.deploy.env.example` to the ignored `.deploy.env`, fill in the connection
settings, and point `DEPLOY_KEY_FILE` to your dedicated private key. The client
works with Node.js 24 and native SSH/tar on Windows or Linux and deliberately
ignores local SSH aliases. The old `REMOTE`/`WEBROOT` settings are no longer used.

```sh
pnpm deploy:site status
pnpm deploy:site validate    # full local verification + upload/extraction, no publication
pnpm deploy:site             # full verification + publish; requires a clean worktree
pnpm deploy:site rollback    # restore previous release, with origin checks
```

For an already verified artifact, `node scripts/deploy.mjs validate site.tar.gz`
checks transfer and extraction without switching production. CI passes its
verified artifact to `deploy` to avoid building twice. Release IDs include the
commit, workflow run ID and retry attempt. An existing release ID cannot be
overwritten. Upload limits are 256 MiB compressed / 512 MiB expanded.

The initial `empty` release has no homepage; the first successful deployment
restores the site. There is no rollback to an actual website until a second
successful release exists. Inspect the current deployed commit at
`https://nyachen.cn/deployment.json` or use the restricted `status` command.

Archive corruption, failed build-output validation, SSH failure, rejected
concurrent publication and failed HTTPS checks fail the deployment visibly.
No automatic retry suppresses these failures. The previous complete version is
retained during upload; normal post-switch check failures restore it. A hard
process/server crash after the switch cannot run automatic recovery; inspect
status and use rollback once the server is available.
