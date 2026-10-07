export type TopicTone =
	| "linux"
	| "hardware"
	| "verilog"
	| "chisel"
	| "bsv"
	| "vfs"
	| "erofs"
	| "llvm"
	| "cargo"
	| "opensource"
	| "neutral";

// Stable collection slugs keep topic colors identical across translated views.
export function topicTone(series = "", category = ""): TopicTone {
	if (series === "riscv-verilog-syntax") return "verilog";
	if (series === "riscv-chisel-syntax") return "chisel";
	if (series === "riscv-bsv-syntax") return "bsv";
	if (series === "linux-modern-vfs") return "vfs";
	if (series === "linux-erofs") return "erofs";
	if (series.startsWith("linux-") || category.toLowerCase() === "linux")
		return "linux";
	if (series.startsWith("riscv-") || /hardware|硬件/i.test(category))
		return "hardware";
	return "neutral";
}

export function projectTone(project: string): TopicTone {
	if (project === "linux") return "linux";
	if (project === "llvm-project") return "llvm";
	if (project === "cargo") return "cargo";
	return "neutral";
}
