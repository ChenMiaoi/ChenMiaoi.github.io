#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { pipeline } from "node:stream/promises";

const [command = "deploy", artifactArgument] = process.argv.slice(2);
if (!["deploy", "validate", "status", "rollback"].includes(command)) {
	throw new Error(
		"Usage: node scripts/deploy.mjs deploy|validate [site.tar.gz] | status | rollback",
	);
}
if (!process.env.CI && existsSync(".deploy.env"))
	process.loadEnvFile(".deploy.env");
const env = process.env;
const host = env.DEPLOY_HOST;
const user = env.DEPLOY_USER || "nyachen-deploy";
const port = env.DEPLOY_PORT || "22";
if (
	!host ||
	!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(host) ||
	!/^[a-z_][a-z0-9_-]*$/.test(user) ||
	!/^\d+$/.test(port) ||
	Number(port) < 1 ||
	Number(port) > 65535
) {
	throw new Error("Set a valid DEPLOY_HOST, DEPLOY_USER and DEPLOY_PORT");
}
if (!env.DEPLOY_KNOWN_HOSTS || !(env.DEPLOY_SSH_KEY || env.DEPLOY_KEY_FILE)) {
	throw new Error(
		"Set DEPLOY_KNOWN_HOSTS and DEPLOY_SSH_KEY (CI) or DEPLOY_KEY_FILE (local)",
	);
}

function run(program, args, options = {}) {
	return new Promise((resolveRun, reject) => {
		const child = spawn(program, args, { stdio: "inherit", ...options });
		child.on("error", reject);
		child.on("exit", (code, signal) =>
			code === 0
				? resolveRun()
				: reject(new Error(`${program} failed (${code ?? signal})`)),
		);
	});
}

const temporary = await mkdtemp(join(tmpdir(), "nyachen-deploy-"));
try {
	const knownHosts = join(temporary, "known_hosts");
	await writeFile(knownHosts, `${env.DEPLOY_KNOWN_HOSTS.trim()}\n`, {
		mode: 0o600,
	});
	let keyFile = env.DEPLOY_KEY_FILE && resolve(env.DEPLOY_KEY_FILE);
	if (env.DEPLOY_SSH_KEY) {
		keyFile = join(temporary, "id_ed25519");
		await writeFile(keyFile, `${env.DEPLOY_SSH_KEY.trim()}\n`, { mode: 0o600 });
		if (process.platform === "win32") {
			// Windows ignores POSIX mode bits; give only the current user access.
			const aclScript = [
				"$ErrorActionPreference = 'Stop'",
				"$owner = [System.Security.Principal.WindowsIdentity]::GetCurrent().User",
				"$acl = [System.Security.AccessControl.FileSecurity]::new()",
				"$acl.SetOwner($owner)",
				"$acl.SetAccessRuleProtection($true, $false)",
				"$rule = [System.Security.AccessControl.FileSystemAccessRule]::new($owner, 'FullControl', 'Allow')",
				"$acl.AddAccessRule($rule)",
				"[System.IO.File]::SetAccessControl($env:NYACHEN_DEPLOY_KEY_FILE, $acl)",
			].join("; ");
			await run(
				"powershell.exe",
				[
					"-NoProfile",
					"-NonInteractive",
					"-EncodedCommand",
					Buffer.from(aclScript, "utf16le").toString("base64"),
				],
				{
					env: { ...env, NYACHEN_DEPLOY_KEY_FILE: keyFile },
				},
			);
		}
	}
	const sshArgs = [
		"-F",
		process.platform === "win32" ? "NUL" : "/dev/null",
		"-T",
		"-p",
		port,
		"-i",
		keyFile,
		"-o",
		"BatchMode=yes",
		"-o",
		"IdentitiesOnly=yes",
		"-o",
		"StrictHostKeyChecking=yes",
		"-o",
		`UserKnownHostsFile=${knownHosts}`,
		"-o",
		"ConnectTimeout=15",
		"-o",
		"ServerAliveInterval=15",
		"-o",
		"ServerAliveCountMax=3",
		`${user}@${host}`,
	];
	if (["status", "rollback"].includes(command)) {
		await run("ssh", [...sshArgs, command]);
	} else {
		let artifact = artifactArgument && resolve(artifactArgument);
		const sha =
			env.GITHUB_SHA ||
			execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
		const release =
			env.DEPLOY_RELEASE ||
			`${sha}-${env.GITHUB_RUN_ID || Date.now()}-${env.GITHUB_RUN_ATTEMPT || 1}`;
		if (!/^[0-9a-f]{40}-[1-9][0-9]*-[1-9][0-9]*$/.test(release))
			throw new Error("Invalid deployment release ID");
		if (
			command === "deploy" &&
			!env.CI &&
			execFileSync("git", ["status", "--porcelain"], {
				encoding: "utf8",
			}).trim()
		) {
			throw new Error(
				"Commit local changes before publishing, or use validate to test without publishing",
			);
		}
		if (!artifact) {
			if (process.platform === "win32")
				await run("cmd.exe", ["/d", "/s", "/c", "pnpm.cmd verify"]);
			else await run("pnpm", ["verify"]);
			artifact = join(temporary, "site.tar.gz");
			await run("tar", ["-czf", artifact, "-C", ".output/vps", "."]);
		}
		const digest = createHash("sha256")
			.update(await readFile(artifact))
			.digest("hex");
		const child = spawn(
			"ssh",
			[...sshArgs, `${command} ${release} ${digest}`],
			{ stdio: ["pipe", "inherit", "inherit"] },
		);
		const exited = new Promise((resolveExit, reject) => {
			child.on("error", reject);
			child.on("exit", (code, signal) =>
				code === 0
					? resolveExit()
					: reject(new Error(`Deployment SSH failed (${code ?? signal})`)),
			);
		});
		const [transfer, connection] = await Promise.allSettled([
			pipeline(createReadStream(artifact), child.stdin),
			exited,
		]);
		if (connection.status === "rejected") throw connection.reason;
		if (transfer.status === "rejected") throw transfer.reason;
		if (env.GITHUB_STEP_SUMMARY) {
			await appendFile(
				env.GITHUB_STEP_SUMMARY,
				`Deployed [${release}](https://nyachen.cn/deployment.json) to https://nyachen.cn. Origin HTTPS checks passed.\n`,
			);
		}
	}
} finally {
	await rm(temporary, { recursive: true, force: true });
}
