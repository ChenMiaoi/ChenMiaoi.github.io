import { summarizeReviews } from '../../src/lib/contributions/reviews.ts';
// Refresh independently of the expensive discussion and diff snapshot.
export async function readPullRequestStatus(api, repository, number, record, existingReviews) {
  const reviewsPromise = existingReviews ? Promise.resolve(existingReviews) :
    api(`repos/${repository}/pulls/${number}/reviews?per_page=100`, true).then(pages => pages.flat());
  const refs = [{ sha: record.head.sha, ref: 'head' }];
  if (record.state === 'open' && record.merge_commit_sha && record.merge_commit_sha !== record.head.sha)
    refs.push({ sha: record.merge_commit_sha, ref: 'merge' });
  const [reviews, batches] = await Promise.all([reviewsPromise, Promise.all(refs.map(async ({ sha, ref }) => {
    const [runPages, statusPages] = await Promise.all([
      api(`repos/${repository}/commits/${sha}/check-runs?filter=latest&per_page=100`, true),
      api(`repos/${repository}/commits/${sha}/status?per_page=100`, true),
    ]);
    const runs = runPages.flatMap((page) => page.check_runs);
    const statuses = statusPages.flatMap((page) => page.statuses);
    if (runs.length !== runPages[0].total_count || statuses.length !== statusPages[0].total_count)
      throw new Error('Incomplete CI pagination; previous snapshot retained');
    if (runs.some((run) => run.head_sha !== sha) || statusPages.some((page) => page.sha !== sha))
      throw new Error('CI results do not match the requested commit');
    const latest = new Map();
    for (const run of runs) {
      const key = `${run.app?.id ?? ''}:${run.name}`;
      if (!latest.has(key) || run.id > latest.get(key).id) latest.set(key, run);
    }
    return [
      ...[...latest.values()].map((run) => ({ name: run.name, source: 'check', ref, sha,
        status: run.status, conclusion: run.conclusion ?? null,
        url: run.html_url ?? run.details_url ?? null, description: run.output?.title ?? '' })),
      ...statuses.map((status) => ({ name: status.context, source: 'status', ref, sha,
        status: status.state === 'pending' ? 'pending' : 'completed', conclusion: status.state === 'pending' ? null : status.state,
        url: status.target_url ?? null, description: status.description ?? '' })),
    ];
  }))]);
  const latest = await api(`repos/${repository}/pulls/${number}`);
  if (latest.head.sha !== record.head.sha || latest.base.sha !== record.base.sha || latest.updated_at !== record.updated_at ||
      latest.merge_commit_sha !== record.merge_commit_sha)
    throw new Error(`PR #${number} changed during CI synchronization; previous snapshot retained`);
  const fetchedAt = new Date().toISOString();
  return { fetchedAt, headSha: record.head.sha,
    headRef: latest.head.label ?? latest.head.ref ?? '', baseRef: latest.base.ref ?? '',
    mergeable: latest.mergeable ?? null, mergeState: latest.mergeable_state ?? 'unknown',
    labels: (latest.labels ?? []).map((label) => label.name),
    requestedReviewers: [...(latest.requested_reviewers ?? []).map((user) => user.login),
      ...(latest.requested_teams ?? []).map((team) => `@${team.slug}`)],
    reviewSummary: { fetchedAt, ...summarizeReviews(reviews) },
    checks: batches.flat(),
  };
}
