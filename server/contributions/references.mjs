import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: true, linkify: true });

export function referenceCandidates(body, repository, repositories) {
  const allowed = new Set(repositories);
  const candidates = new Map();
  function add(repo, number) {
    if (allowed.has(repo) && Number.isSafeInteger(Number(number)) && Number(number) > 0)
      candidates.set(`${repo}#${number}`, { repository: repo, number: Number(number) });
  }
  function link(href) {
    const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/(?:issues|pull)\/(\d+)(?:[/?#]|$)/.exec(href);
    if (match) add(match[1], match[2]);
  }
  // Markdown structure keeps stack frames, code samples and inline literals out
  // of the reference list. Link destinations are inspected independently.
  for (const block of markdown.parse(body, {})) {
    if (block.type !== 'inline') continue;
    let insideLink = false;
    let htmlCodeDepth = 0;
    for (const token of block.children ?? []) {
      if (token.type === 'html_inline' && /^<\/?(?:code|pre)\b/i.test(token.content)) {
        htmlCodeDepth = Math.max(0, htmlCodeDepth + (token.content.startsWith('</') ? -1 : 1));
        continue;
      }
      if (htmlCodeDepth) continue;
      if (token.type === 'link_open') { link(token.attrGet('href') ?? ''); insideLink = true; }
      else if (token.type === 'link_close') insideLink = false;
      else if (token.type === 'text' && !insideLink) {
        for (const match of token.content.matchAll(/(?<![\w/])(?:(\w[\w.-]*\/[\w.-]+))?#(\d+)\b/g))
          add(match[1] ?? repository, match[2]);
      }
    }
  }
  return [...candidates.values()];
}
