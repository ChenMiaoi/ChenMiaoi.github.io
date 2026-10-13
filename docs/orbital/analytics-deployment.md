# Umami deployment

The homepage shows site-wide unique visitors, visits (Umami sessions), and a 30-day daily visitor series. Articles have no public counters. The interval begins at Shanghai midnight 29 days ago and ends at the last successful refresh. No historic counts are invented.

## Runtime

- SSH host: `vps-polyu` (the configured PolyU VPS).
- Umami: official prebuilt `docker.umami.is/umami-software/umami:3.4.0`, pinned in `scripts/analytics/nyachen-umami.service` by digest. Podman uses host networking; Umami itself binds only to `127.0.0.1:4337`. The image runs as its non-root `nextjs` user with capabilities dropped. It is not compiled on the VPS.
- PostgreSQL 16: dedicated `nyachen_umami` role/database, database timezone UTC. Existing MariaDB is separate.
- Runtime secrets: `/etc/nyachen-umami.env`, mode 0600, includes DATABASE_URL and APP_SECRET. Default admin password is replaced immediately and stored only in `/etc/nyachen-analytics.env`, mode 0600. Both files remain outside Git and website artifacts.
- Umami migrations run through the official image startup. Back up the database before future upgrades; application rollback does not reverse database migrations.
- Exporter: `/opt/nyachen-analytics/export-summary.mjs`, run by `nyachen-analytics.timer` every 15 minutes. It reads private API credentials, writes only whitelisted aggregate fields, and atomically replaces `/var/lib/nyachen-analytics/summary.json`. Failures leave the previous snapshot intact.

The Nginx include `scripts/analytics/analytics.nginx.conf` is installed only in the existing apex HTTPS server. It exposes `/visit.js`, `/api/send`, and `/visit-summary.json`. No login, admin API, heatmap, or replay endpoint is proxied. Public summary CORS permits the GitHub Pages copy; it contains no individual visitor records. Cloudflare visitor IP headers are trusted only for the published Cloudflare proxy ranges. Certificates and unrelated server blocks remain unchanged; original configuration is backed up in `/var/backups/nyachen-analytics`.

## Maintenance

```sh
systemctl status nyachen-umami
systemctl status nyachen-analytics.timer
journalctl -u nyachen-analytics.service -n 20
systemctl start nyachen-analytics.service
curl --fail https://nyachen.cn/visit-summary.json
```

For the private dashboard, forward the loopback port from your own computer:

```sh
ssh -N -L 4337:127.0.0.1:4337 vps-polyu
```

Then open `http://127.0.0.1:4337` and sign in with `admin`. Read its password privately from the root-only `/etc/nyachen-analytics.env`; do not paste it into chat or commit it. Back up with `runuser -u postgres -- pg_dump nyachen_umami` to a protected server backup destination, alongside the two environment files. Never publish the dump.

Frontend changes use the repository's existing verified artifact and atomic receiver deployment. The runtime image and exporter are independent services; changing the exporter requires copying its reviewed source to `/opt/nyachen-analytics/` and running its service. Tracker script is enabled only in production, restricted to `nyachen.cn` and `chenmiaoi.github.io`, and excludes search strings and fragment identifiers. Tracking uses Umami's automatic pageview mechanism once; no manual duplicate events are emitted. Only aggregate visit/session metrics are public.

Sources: [Official installation](https://docs.umami.is/docs/install), [Umami v3.4.0 release](https://github.com/umami-software/umami/releases/tag/v3.4.0).
