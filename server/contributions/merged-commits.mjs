// Record GitHub's confirmed upstream merge result, not the PR's development history.
export async function collectMergedCommits({ activity, records, readDetail, previous = [] }) {
  const result = [...records];
  const details = new Map(records.map(record => [record.url, record]));
  const cache = new Map(previous.map(record => [record.url, record]));
  for (const item of activity.items) {
    const pr = details.get(item.url);
    if (item.kind !== 'pr' || pr?.kind !== 'pr' || pr.state !== 'merged' || !pr.mergedAt || !pr.mergeCommitSha ||
        pr.author.toLowerCase() !== activity.account.toLowerCase()) continue;
    const sha = pr.mergeCommitSha;
    const url = `https://github.com/${item.repository}/commit/${sha}`;
    // Curated commits may already use an abbreviated SHA in their public URL.
    if (result.some(record => record.kind === 'commit' && record.sha === sha &&
        record.url.startsWith(`https://github.com/${item.repository}/commit/`))) continue;
    const old = cache.get(url);
    const commit = old?.kind === 'commit' && old.sha === sha ? old :
      await readDetail({ repository: item.repository, kind: 'commit', sha, url });
    if (commit.kind !== 'commit' || commit.sha !== sha || commit.url !== url)
      throw new Error('Merged commit does not match the confirmed upstream SHA');
    result.push(commit);
  }
  return result;
}
