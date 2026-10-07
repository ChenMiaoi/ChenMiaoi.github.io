import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
	activitySchema,
	detailsSchema,
} from "../../src/lib/contributions/schema.ts";

export function validateSnapshot(value) {
	if (value.version !== 1)
		throw new Error("Unsupported contribution data version");
	const activity = activitySchema.parse(value.activity);
	const details = detailsSchema.parse(value.details);
	if (activity.syncedAt !== details.activitySyncedAt)
		throw new Error("Mismatched activity/details snapshots");
	for (const item of activity.items) {
		if (!details.records.some((record) => record.url === item.url))
			throw new Error("Missing contribution detail");
	}
	return { version: 1, activity, details };
}

export async function openStore(directory, seed) {
	await mkdir(directory, { recursive: true, mode: 0o700 });
	const path = join(directory, "snapshot.json");
	let current;
	try {
		current = validateSnapshot(JSON.parse(await readFile(path, "utf8")));
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
		current = validateSnapshot(seed);
		const file = await open(path, "wx", 0o600);
		try {
			await file.writeFile(JSON.stringify(current));
			await file.sync();
		} finally {
			await file.close();
		}
	}
	return {
		get: () => current,
		async replace(candidate) {
			const next = validateSnapshot(candidate);
			const temporary = join(directory, `snapshot-${randomUUID()}.tmp`);
			try {
				const file = await open(temporary, "wx", 0o600);
				try {
					await file.writeFile(JSON.stringify(next));
					await file.sync();
				} finally {
					await file.close();
				}
				await rename(temporary, path);
				current = next;
			} finally {
				await rm(temporary, { force: true });
			}
		},
	};
}
