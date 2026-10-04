export type ContributionDiffLine = {
	kind: "hunk" | "add" | "remove" | "context" | "meta";
	text: string;
};

export function contributionDiffLines(patch: string): ContributionDiffLine[] {
	return patch.split("\n").map((text) => {
		if (/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(text))
			return { kind: "hunk", text };
		if (text.startsWith("+")) return { kind: "add", text };
		if (text.startsWith("-")) return { kind: "remove", text };
		if (text.startsWith(" ")) return { kind: "context", text };
		return { kind: "meta", text };
	});
}
