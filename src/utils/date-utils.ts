export function formatDateToYYYYMMDD(date: Date): string {
	return date.toISOString().substring(0, 10);
}

// Match the calendar date used by the site's existing Shanghai timestamps.
export function formatDisplayDate(date: Date): string {
	return formatDateTime(date).slice(0, 10);
}

export function formatDateTime(date: Date): string {
	return new Intl.DateTimeFormat("zh-CN", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	})
		.format(date)
		.replaceAll("/", "-")
		.replace(",", " ");
}
