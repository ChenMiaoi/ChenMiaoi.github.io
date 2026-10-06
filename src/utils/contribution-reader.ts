import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import type { ContributionDetail } from "../lib/contributions/types";
import { highlightContributionCode } from "./contribution-highlight.ts";

const markdown = new MarkdownIt({
	html: true,
	linkify: true,
	highlight: highlightContributionCode,
});

markdown.core.ruler.after("linkify", "github-references", (state) => {
	let repository = "";
	try {
		const source = new URL(state.env.sourceUrl);
		if (source.protocol === "https:" && source.hostname === "github.com") {
			const parts = source.pathname.split("/").filter(Boolean);
			if (parts.length >= 2) repository = `${parts[0]}/${parts[1]}`;
		}
	} catch {
		/* A repository is required for shorthand references. */
	}
	if (!repository) return;
	for (const block of state.tokens) {
		if (block.type !== "inline" || !block.children) continue;
		const children = [];
		let linkDepth = 0;
		let htmlDepth = 0;
		for (const token of block.children) {
			if (token.type === "link_open") linkDepth++;
			if (token.type === "link_close") linkDepth--;
			if (
				token.type === "html_inline" &&
				/^<\/?(?:a|code|pre|script|style)\b/i.test(token.content)
			) {
				htmlDepth = Math.max(
					0,
					htmlDepth + (token.content.startsWith("</") ? -1 : 1),
				);
			}
			if (token.type !== "text" || linkDepth || htmlDepth) {
				children.push(token);
				continue;
			}
			let offset = 0;
			for (const match of token.content.matchAll(
				/(?<![\w/])(?:(\w[\w.-]*\/[\w.-]+))?#([1-9]\d*)\b/g,
			)) {
				if (!Number.isSafeInteger(Number(match[2]))) continue;
				const text = new state.Token("text", "", 0);
				text.content = token.content.slice(offset, match.index);
				children.push(text);
				const open = new state.Token("link_open", "a", 1);
				open.attrSet(
					"href",
					`https://github.com/${match[1] ?? repository}/issues/${match[2]}`,
				);
				const label = new state.Token("text", "", 0);
				label.content = match[0];
				children.push(open, label, new state.Token("link_close", "a", -1));
				offset = match.index + match[0].length;
			}
			const tail = new state.Token("text", "", 0);
			tail.content = token.content.slice(offset);
			children.push(tail);
		}
		block.children = children;
	}
});

export function renderContributionMarkdown(body: string, sourceUrl: string) {
	// External content is rendered on the server or at build time. No raw GitHub HTML or event
	// attributes reach {@html}, and embedded media become explicit source links.
	return sanitizeHtml(markdown.render(body, { sourceUrl }), {
		allowedTags: [
			...sanitizeHtml.defaults.allowedTags,
			"details",
			"summary",
			"del",
		],
		allowedAttributes: {
			pre: ["class", "data-language"],
			span: ["style"],
			a: ["href", "title", "target", "rel"],
			ol: ["start"],
			th: ["colspan", "rowspan"],
			td: ["colspan", "rowspan"],
		},
		allowedClasses: { pre: ["contribution-code"] },
		allowedStyles: { span: { color: [/^#[\da-f]{6}(?:[\da-f]{2})?$/i] } },
		allowedSchemes: ["https", "http", "mailto"],
		allowProtocolRelative: false,
		transformTags: {
			a: (_tag, attributes) => {
				let href = attributes.href ?? "";
				try {
					href = new URL(href, sourceUrl).href;
				} catch {
					href = "";
				}
				return {
					tagName: "a",
					attribs: {
						href,
						target: "_blank",
						rel: "noopener noreferrer",
						...(attributes.title ? { title: attributes.title } : {}),
					},
				};
			},
			img: (_tag, attributes) => ({
				tagName: "a",
				attribs: {
					href: attributes.src ?? "",
					target: "_blank",
					rel: "noopener noreferrer",
				},
				text: attributes.alt ? `查看图片：${attributes.alt}` : "查看原文图片",
			}),
		},
	});
}

type RawComment = Omit<
	ContributionDetail["comments"][number],
	"bodyHtml" | "excerpt"
> & { body: string };
type RawDetail = Omit<
	ContributionDetail,
	"bodyHtml" | "trailers" | "comments"
> & { body: string; comments: RawComment[] };

export function prepareContributionDetails(snapshot: {
	syncedAt: string;
	records: RawDetail[];
}) {
	return {
		syncedAt: snapshot.syncedAt,
		records: snapshot.records.map(
			({ body, comments, ...record }): ContributionDetail => {
				const normalized = body.replace(/\r\n/g, "\n");
				const trailerStart =
					record.kind === "commit"
						? normalized.search(
								/^(?:Signed-off-by|Reviewed-by|Acked-by|Tested-by|Reported-by|Suggested-by|Co-developed-by|Cc|Link|Fixes):/m,
							)
						: -1;
				const description =
					trailerStart < 0
						? normalized
						: normalized.slice(0, trailerStart).trim();
				return {
					...record,
					bodyHtml: renderContributionMarkdown(description, record.url),
					trailers: trailerStart < 0 ? "" : normalized.slice(trailerStart),
					comments: comments.map(({ body: commentBody, ...comment }) => {
						const bodyHtml = renderContributionMarkdown(
							commentBody,
							comment.url,
						);
						return {
							...comment,
							bodyHtml,
							excerpt: sanitizeHtml(bodyHtml, {
								allowedTags: [],
								allowedAttributes: {},
							})
								.replace(/&[a-z#0-9]+;/gi, " ")
								.replace(/\s+/g, " ")
								.trim()
								.slice(0, 120),
						};
					}),
				};
			},
		),
	};
}
