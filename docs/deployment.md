# Orbital deployment

Production serves `https://nyachen.cn` through Cloudflare and the existing Nginx
configuration. GitHub Pages publishes the same Orbital build at
`https://chenmiaoi.github.io/`, so the existing public address stays current.
Canonical URLs continue to point to `https://nyachen.cn`.

## Pipeline

- Pull requests to `main`: install the locked dependencies, run `pnpm verify`
  (including the Orbital production build), and test the deployment receiver.
- Pushes to `main` and manual runs on `main`: run the same checks, save only the
  production `dist/` output once, and deploy it to the VPS (`production`
  environment) and GitHub Pages (`github-pages` environment). Both targets use
  the same build; RAG backend files are not uploaded.
- Each deploy job checks that its commit is still the tip of `main`. Superseded
  runs are skipped. Deployments are serialized and an active deployment is not
  cancelled by the next push.
- The GitHub Pages repository setting must use GitHub Actions as its source.
  The Pages job alone receives `pages: write` and `id-token: write`; pull
  requests do not publish or receive the VPS key.
- SSH checks the pinned server host key. The dedicated key cannot open a shell,
  forward ports, or edit Nginx, certificates, other applications or databases.
- The receiver verifies the archive checksum, rejects unsafe paths and links,
  checks required build outputs and the Orbital homepage marker, and atomically switches `current`.
- Direct origin HTTPS checks verify `deployment.json`, the homepage, English
  homepage and Pagefind. Failure switches back and fails CI. Public Cloudflare
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

The `nyachen-deploy` system user has no sudo privileges. Its public-key file is
root-owned; SSH forces the receiver with a three-minute timeout. Updating the
receiver requires reinstalling it as root; CI cannot replace its own receiver.
Nginx configuration, Cloudflare, certificate/key files, renewal jobs, historic
blog backups and other server workloads are preserved.

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
