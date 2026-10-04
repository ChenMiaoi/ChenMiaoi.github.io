#!/usr/bin/env bash
# Run as root from this directory, with a dedicated Ed25519 PUBLIC key file.
# Refuses to replace a nonempty legacy webroot. Does not edit Nginx or TLS files.
set -euo pipefail
[[ "$EUID" == 0 ]] || { echo 'Run as root' >&2; exit 1; }
cd -- "$(dirname -- "$0")"
key_file=${1:?Usage: setup.sh /path/to/deployment-key.pub}
[[ -f "$key_file" ]] && ssh-keygen -lf "$key_file" >/dev/null
read -r key_type key_data _ < "$key_file"
[[ "$key_type" == ssh-ed25519 && "$key_data" =~ ^[A-Za-z0-9+/=]+$ ]]

base=/var/www/nyachen-deploy
webroot=/var/www/nyachen.cn
if [[ -L "$webroot" ]]; then
  [[ "$(readlink "$webroot")" == "$base/current" ]]
elif [[ -d "$webroot" ]]; then
  [[ "$(readlink -f "$webroot")" == "$webroot" ]]
  [[ -z "$(find "$webroot" -mindepth 1 -maxdepth 1 -print -quit)" ]] || {
    echo 'Refusing to replace a nonempty blog directory' >&2; exit 1;
  }
elif [[ -e "$webroot" ]]; then
  echo 'Unexpected webroot type' >&2; exit 1
fi
if id nyachen-deploy >/dev/null 2>&1; then
  [[ "$(getent passwd nyachen-deploy | cut -d: -f6)" == /var/lib/nyachen-deploy ]]
else
  useradd --system --user-group --home-dir /var/lib/nyachen-deploy --shell /bin/sh nyachen-deploy
fi
install -d -m 755 -o root -g root /var/lib/nyachen-deploy
install -d -m 755 -o root -g root /var/lib/nyachen-deploy/.ssh
install -d -m 755 -o nyachen-deploy -g nyachen-deploy "$base" "$base/releases"
install -d -m 700 -o nyachen-deploy -g nyachen-deploy "$base/.staging"
install -d -m 755 -o root -g root "$base/shared" "$base/shared/.well-known" "$base/shared/.well-known/acme-challenge"
install -m 755 -o root -g root receive.py /usr/local/sbin/nyachen-deploy
# The key can only call the receiver; no shell, forwarding, PTY or user RC.
printf 'restrict,command="/usr/bin/timeout 180 /usr/bin/python3 -I /usr/local/sbin/nyachen-deploy" %s %s\n' "$key_type" "$key_data" > /var/lib/nyachen-deploy/.ssh/authorized_keys
chown root:root /var/lib/nyachen-deploy/.ssh/authorized_keys
chmod 644 /var/lib/nyachen-deploy/.ssh/authorized_keys
if [[ ! -L "$base/current" ]]; then
  [[ ! -e "$base/current" ]]
  install -d -m 755 -o nyachen-deploy -g nyachen-deploy "$base/releases/empty"
  ln -s "$base/shared/.well-known" "$base/releases/empty/.well-known"
  ln -s releases/empty "$base/current"
  chown -h nyachen-deploy:nyachen-deploy "$base/current"
fi
if [[ ! -L "$webroot" ]]; then
  if [[ -d "$webroot" ]]; then rmdir -- "$webroot"; fi
  ln -s "$base/current" "$webroot"
fi
echo 'Deployment receiver installed; Nginx, TLS and renewal configuration were not edited.'
