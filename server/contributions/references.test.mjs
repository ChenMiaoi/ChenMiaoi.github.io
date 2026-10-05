import assert from 'node:assert/strict';
import test from 'node:test';
import { referenceCandidates } from './references.mjs';
import { createDetailReader } from './details.mjs';

test('references use prose and link destinations while ignoring code and stack frames', () => {
  const body = [
    'Related: #42, example/other#43 and [#999](https://github.com/example/other/pull/44).',
    'https://github.com/example/public/issues/45#issuecomment-1',
    '`#10` and <code>#11</code> are literals.',
    '```\n #10 clang::Token::getIdentifierInfo()\n #11 clang::Parser::HandlePragmaAttribute()\n #12 clang::Parser::ParseExternalDeclaration()\n```',
    '~~~cpp\n// https://github.com/example/public/issues/46\n~~~',
    '    #47 indented code',
    '<pre>\n#48\n</pre>',
    'Ignore https://github.com/private/other/issues/49 and #0.',
  ].join('\n\n');
  assert.deepEqual(referenceCandidates(body, 'example/public', ['example/public', 'example/other']), [
    { repository: 'example/public', number: 42 },
    { repository: 'example/other', number: 43 },
    { repository: 'example/other', number: 44 },
    { repository: 'example/public', number: 45 },
  ]);
});

test('an issue stack trace does not request unrelated PRs but retains the timeline cross-reference', async () => {
  const repository = 'llvm/llvm-project';
  const url = `https://github.com/${repository}/issues/225035`;
  const related = { html_url: `https://github.com/${repository}/pull/228990`, number: 228990, title: 'Fix nested _Pragma', pull_request: {} };
  const record = { html_url: url, title: 'Crash', body: '```\n #10 clang::Token\n #11 clang::Parser\n #12 clang::Parser\n```',
    user: { login: 'reporter' }, updated_at: '2026-10-05T00:00:00Z', state: 'open', comments: 0 };
  const api = async (path) => {
    assert.equal(path, `repos/${repository}/issues/225035/timeline?per_page=100`);
    return [[{ event: 'cross-referenced', source: { issue: related } }]];
  };
  const result = await createDetailReader(api, [repository])({ repository, url, kind: 'issue', number: 225035 }, record);
  assert.deepEqual(result.references, [{ url: related.html_url, number: 228990, title: related.title, kind: 'pr', relation: 'cross-reference' }]);
});
