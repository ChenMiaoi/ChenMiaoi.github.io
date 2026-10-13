import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const endpoint = "http://127.0.0.1:4337";
const websiteId = "87a8cb66-9fb0-4a19-82e9-5bcc5dc92807";
async function request(path, options = {}) {
	const response = await fetch(`${endpoint}${path}`, {
		...options,
		signal: AbortSignal.timeout(20000),
	});
	if (!response.ok) throw new Error(`Umami request failed: ${response.status}`);
	return response.json();
}
const { token } = await request("/api/auth/login", {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		username: process.env.UMAMI_USERNAME,
		password: process.env.UMAMI_PASSWORD,
	}),
});
if (!token) throw new Error("Umami did not return a token");
const endAt = Date.now();
// Midnight in Shanghai, 29 days ago, through the current instant.
const today = new Date(endAt + 8 * 3600000).toISOString().slice(0, 10);
const startAt = Date.parse(`${today}T00:00:00+08:00`) - 29 * 86400000;
const query = new URLSearchParams({
	startAt: String(startAt),
	endAt: String(endAt),
	timezone: "Asia/Shanghai",
	unit: "day",
});
const headers = { Authorization: `Bearer ${token}` };
const [stats, series] = await Promise.all([
	request(`/api/websites/${websiteId}/stats?${query}`, { headers }),
	request(`/api/websites/${websiteId}/pageviews?${query}`, { headers }),
]);
function count(value) {
	if (value === null) return 0;
	const number = Number(value);
	if (!Number.isSafeInteger(number) || number < 0)
		throw new Error("Invalid analytics count");
	return number;
}
if (!Array.isArray(series.sessions))
	throw new Error("Missing daily visitor data");
const dailyMap = new Map(
	series.sessions.map((point) => [
		String(point.x).slice(0, 10),
		count(point.y),
	]),
);
const daily = Array.from({ length: 30 }, (_, index) => {
	const date = new Date(startAt + index * 86400000 + 8 * 3600000)
		.toISOString()
		.slice(0, 10);
	return { date, visitors: dailyMap.get(date) ?? 0 };
});
const summary = {
	startAt,
	endAt,
	updatedAt: endAt,
	visitors: count(stats.visitors),
	visits: count(stats.visits),
	daily,
};
const directory = "/var/lib/nyachen-analytics";
await mkdir(directory, { recursive: true, mode: 0o755 });
const temporary = join(directory, "summary.json.tmp");
await writeFile(temporary, `${JSON.stringify(summary)}\n`, { mode: 0o644 });
await rename(temporary, join(directory, "summary.json"));
console.log(
	`Published aggregate summary: ${summary.visitors} visitors, ${summary.visits} visits`,
);
