export interface VisitSummary {
	startAt: number;
	endAt: number;
	updatedAt: number;
	visitors: number;
	visits: number;
	daily: { date: string; visitors: number }[];
}

export function parseVisitSummary(value: unknown): VisitSummary {
	const data = value as VisitSummary;
	if (
		!data ||
		![
			data.startAt,
			data.endAt,
			data.updatedAt,
			data.visitors,
			data.visits,
		].every((n) => Number.isSafeInteger(n) && n >= 0) ||
		data.endAt < data.startAt ||
		!Array.isArray(data.daily) ||
		data.daily.length !== 30 ||
		!data.daily.every(
			(day) =>
				/^\d{4}-\d{2}-\d{2}$/.test(day.date) &&
				Number.isSafeInteger(day.visitors) &&
				day.visitors >= 0,
		)
	)
		throw new Error("Invalid visit summary");
	return data;
}
