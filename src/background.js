import { DEFAULT_SITES, DEFAULT_PASS_MINUTES, findBlockedSite, hasPass, todayKey } from "./lib.js";

const API_LIST = "https://readwise.io/api/v3/list/";
const LOCATIONS = ["new", "later", "shortlist"];
const MAX_PAGES_PER_LOCATION = 3; // 9 requests worst case; Reader allows 20/min
const CACHE_TTL_MS = 10 * 60 * 1000;
const GATE_URL = chrome.runtime.getURL("src/gate.html");

const getSettings = () =>
  chrome.storage.local.get({
    token: "",
    sites: DEFAULT_SITES,
    passMinutes: DEFAULT_PASS_MINUTES,
    passes: {},
  });

// Redirect top-level navigations to a listed site unless a pass is active.
chrome.webNavigation.onBeforeNavigate.addListener(
  async (details) => {
    if (details.frameId !== 0) return;
    const { sites, passes } = await getSettings();
    const site = findBlockedSite(details.url, sites);
    if (!site || hasPass(passes, site, Date.now())) return;

    const gate = new URL(GATE_URL);
    gate.searchParams.set("to", details.url);
    gate.searchParams.set("site", site);
    chrome.tabs.update(details.tabId, { url: gate.href });
  },
  { url: [{ schemes: ["http", "https"] }] },
);

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// Keep only the fields the gate page uses.
const slim = (d) => ({
  id: d.id,
  url: d.url,
  title: d.title,
  author: d.author,
  site_name: d.site_name,
  category: d.category,
  location: d.location,
  parent_id: d.parent_id,
  word_count: d.word_count,
  reading_time: d.reading_time,
  reading_progress: d.reading_progress,
  last_opened_at: d.last_opened_at,
  image_url: d.image_url,
});

async function fetchLocation(token, location) {
  const docs = [];
  let cursor = null;
  for (let page = 0; page < MAX_PAGES_PER_LOCATION; page++) {
    const url = new URL(API_LIST);
    url.searchParams.set("location", location);
    if (cursor) url.searchParams.set("pageCursor", cursor);
    const res = await fetch(url, { headers: { Authorization: `Token ${token}` } });
    if (!res.ok) throw new Error(`Reader API returned ${res.status}`);
    const body = await res.json();
    docs.push(...body.results.map(slim));
    cursor = body.nextPageCursor;
    if (!cursor) break;
  }
  return docs;
}

let inFlight = null;

// Returns { docs, error }. Serves fresh cache, else refetches; on failure
// falls back to stale cache so the gate still has something to show.
async function getDocs() {
  const { token, cache } = await chrome.storage.local.get({ token: "", cache: null });
  if (!token) return { docs: [], error: "no-token" };
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return { docs: cache.docs };

  inFlight ??= (async () => {
    const docs = (await Promise.all(LOCATIONS.map((l) => fetchLocation(token, l)))).flat();
    await chrome.storage.local.set({ cache: { fetchedAt: Date.now(), docs } });
    return docs;
  })().finally(() => (inFlight = null));

  try {
    return { docs: await inFlight };
  } catch (err) {
    return { docs: cache?.docs ?? [], error: err.message };
  }
}

async function grantPass(site) {
  const { passes, passMinutes, bypasses } = await chrome.storage.local.get({
    passes: {},
    passMinutes: DEFAULT_PASS_MINUTES,
    bypasses: { date: "", count: 0 },
  });
  const today = todayKey();
  const count = bypasses.date === today ? bypasses.count + 1 : 1;
  passes[site] = Date.now() + passMinutes * 60 * 1000;
  await chrome.storage.local.set({ passes, bypasses: { date: today, count } });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const work = msg.type === "getDocs" ? getDocs() : msg.type === "grantPass" ? grantPass(msg.site) : null;
  if (!work) return false;
  work.then(sendResponse, (err) => sendResponse({ docs: [], error: err.message }));
  return true; // keep the channel open for the async response
});
