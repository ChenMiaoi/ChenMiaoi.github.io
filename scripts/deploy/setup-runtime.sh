#!/usr/bin/env bash
# One-time service setup or receiver upgrade. Does not replace website/data/TLS.
set -euo pipefail
[[ "$EUID" == 0 ]] || { echo 'Run as root' >&2; exit 1; }
cd -- "$(dirname -- "$0")"
[[ -x /usr/bin/node && -f /usr/local/sbin/nyachen-deploy ]]
/usr/bin/node -e 'if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)'
if ! id nyachen-contributions >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /var/lib/nyachen-contributions --shell /usr/sbin/nologin nyachen-contributions
fi
install -d -m 700 -o nyachen-contributions -g nyachen-contributions /var/lib/nyachen-contributions
if [[ ! -e /etc/nyachen-contributions.env ]]; then
  install -m 600 -o root -g root /dev/null /etc/nyachen-contributions.env
fi
install -m 644 -o root -g root nyachen-contributions.service /etc/systemd/system/nyachen-contributions.service
install -d -m 755 /etc/nginx/snippets
install -m 644 -o root -g root contributions.nginx.conf /etc/nginx/snippets/nyachen-contributions.conf
install -m 755 -o root -g root receive.py /usr/local/sbin/nyachen-deploy
rule=$(mktemp)
trap 'rm -f "$rule"' EXIT
printf '%s\n' 'nyachen-deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart nyachen-contributions.service, /usr/bin/systemctl stop nyachen-contributions.service' > "$rule"
visudo -cf "$rule"
install -m 440 -o root -g root "$rule" /etc/sudoers.d/nyachen-contributions
systemctl daemon-reload
systemctl enable nyachen-contributions.service
python3 - "${1:-/etc/nginx/conf.d/nyachen.conf}" <<'PY'
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

path = Path(sys.argv[1]).resolve(strict=True)
if not path.is_relative_to('/etc/nginx') or not path.is_file():
    raise SystemExit('Expected an existing Nginx configuration under /etc/nginx')
text = path.read_text()
include = 'include /etc/nginx/snippets/nyachen-contributions.conf;'
if include not in text:
    pattern = r'(?m)^([ \t]*)server_name[ \t]+nyachen\.cn[ \t]*;[ \t]*$'
    if len(re.findall(pattern, text)) != 1:
        raise SystemExit('Expected one exact nyachen.cn server block; inspect Nginx configuration')
    updated = re.sub(pattern, lambda m: m[0] + '\n' + m[1] + include, text)
    backup_dir = Path('/var/backups/nyachen-runtime')
    backup_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    backup = backup_dir / f'nginx-{time.time_ns()}.conf'
    shutil.copy2(path, backup)
    temporary = path.with_suffix('.runtime-tmp')
    try:
        shutil.copy2(path, temporary)
        temporary.write_text(updated)
        os.replace(temporary, path)
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    except BaseException:
        shutil.copy2(backup, path)
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
        raise
    finally:
        temporary.unlink(missing_ok=True)
else:
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
PY
echo 'Installed service, restricted deployment hooks and Nginx route. The next VPS deploy starts and verifies the service.'
