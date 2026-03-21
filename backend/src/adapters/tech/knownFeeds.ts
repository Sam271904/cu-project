/**
 * Task 3.3 — curated tech-community RSS entry points (user can paste into Sources or collect body).
 * These are normal RSS URLs; ingestion uses the same `collectRssFromUrl` + `source_type: 'tech'` path.
 */
export const HACKER_NEWS_FRONT_PAGE_RSS = 'https://news.ycombinator.com/rss';

/** Optional: GitHub releases atom for a repo (replace owner/repo). */
export function githubReleasesAtomUrl(owner: string, repo: string): string {
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases.atom`;
}
