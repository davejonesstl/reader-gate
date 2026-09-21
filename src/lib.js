// Pure helpers shared by the background worker, gate page and options page.

export const DEFAULT_SITES = ["apnews.com", "facebook.com", "news.google.com"];
export const DEFAULT_PASS_MINUTES = 15;

// Below this a doc counts as unread; above MAX it counts as finished.
const STARTED_MIN = 0.02;
const STARTED_MAX = 0.95;
const WORDS_PER_MINUTE = 238;
const PICKS = 3;
const LOCATION_PRIORITY = { shortlist: 0, later: 1, new: 2 };

// Returns the configured site a URL belongs to (host or subdomain), else null.
export function findBlockedSite(url, sites) {
  let host;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    host = u.hostname.toLowerCase();
  } catch {
    return null;
  }
  return sites.find((s) => host === s || host.endsWith("." + s)) ?? null;
}

// Turns free-form textarea input into a clean, de-duplicated domain list.
export function normalizeSites(text) {
  const domains = text
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .map((s) => s.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0])
    .filter(Boolean);
  return [...new Set(domains)];
}

export function hasPass(passes, site, now) {
  return (passes[site] ?? 0) > now;
}

export function minutesToRead(doc) {
  const parsed = parseInt(doc.reading_time, 10);
  if (Number.isFinite(parsed)) return parsed;
  if (doc.word_count) return Math.max(1, Math.round(doc.word_count / WORDS_PER_MINUTE));
  return null;
}

function shuffle(items, rng) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Splits docs into "finish these" (in progress, most recent first) and
// "start one" (unread, shortlist before later before inbox, random within).
export function rankDocs(docs, rng = Math.random) {
  const own = docs.filter(
    (d) => !d.parent_id && d.location in LOCATION_PRIORITY && d.category !== "highlight" && d.category !== "note",
  );
  const progress = (d) => d.reading_progress ?? 0;

  const finish = own
    .filter((d) => progress(d) > STARTED_MIN && progress(d) < STARTED_MAX)
    .sort((a, b) => (Date.parse(b.last_opened_at) || 0) - (Date.parse(a.last_opened_at) || 0))
    .slice(0, PICKS);

  const start = shuffle(
    own.filter((d) => progress(d) <= STARTED_MIN),
    rng,
  )
    .sort((a, b) => LOCATION_PRIORITY[a.location] - LOCATION_PRIORITY[b.location])
    .slice(0, PICKS);

  return { finish, start };
}

export function todayKey(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
