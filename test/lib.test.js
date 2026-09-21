import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findBlockedSite,
  normalizeSites,
  hasPass,
  minutesToRead,
  rankDocs,
  todayKey,
  DEFAULT_SITES,
} from "../src/lib.js";

const doc = (over) => ({ id: "x", location: "later", reading_progress: 0, parent_id: null, ...over });
const ids = (docs) => docs.map((d) => d.id);

test("findBlockedSite matches host and subdomains", () => {
  assert.equal(findBlockedSite("https://apnews.com/article/1", DEFAULT_SITES), "apnews.com");
  assert.equal(findBlockedSite("https://www.facebook.com/", DEFAULT_SITES), "facebook.com");
  assert.equal(findBlockedSite("https://news.google.com/home", DEFAULT_SITES), "news.google.com");
});

test("findBlockedSite ignores non-listed, lookalike, and non-http URLs", () => {
  assert.equal(findBlockedSite("https://google.com/", DEFAULT_SITES), null);
  assert.equal(findBlockedSite("https://notfacebook.com/", DEFAULT_SITES), null);
  assert.equal(findBlockedSite("https://facebook.com.evil.io/", DEFAULT_SITES), null);
  assert.equal(findBlockedSite("chrome://settings", DEFAULT_SITES), null);
  assert.equal(findBlockedSite("not a url", DEFAULT_SITES), null);
});

test("normalizeSites cleans, lowercases and dedupes", () => {
  const input = "https://www.APNews.com/hub\nfacebook.com, facebook.com\n\n  news.google.com ";
  assert.deepEqual(normalizeSites(input), ["apnews.com", "facebook.com", "news.google.com"]);
  assert.deepEqual(normalizeSites("  \n "), []);
});

test("hasPass is true only before expiry", () => {
  assert.equal(hasPass({ "a.com": 2000 }, "a.com", 1000), true);
  assert.equal(hasPass({ "a.com": 1000 }, "a.com", 1000), false);
  assert.equal(hasPass({}, "a.com", 1000), false);
});

test("minutesToRead parses reading_time, falls back to word_count", () => {
  assert.equal(minutesToRead({ reading_time: "7 mins" }), 7);
  assert.equal(minutesToRead({ word_count: 2380 }), 10);
  assert.equal(minutesToRead({ word_count: 10 }), 1);
  assert.equal(minutesToRead({}), null);
});

test("rankDocs finish list: in-progress only, most recently opened first, max 3", () => {
  const docs = [
    doc({ id: "old", reading_progress: 0.5, last_opened_at: "2026-01-01T00:00:00Z" }),
    doc({ id: "new", reading_progress: 0.3, last_opened_at: "2026-09-01T00:00:00Z" }),
    doc({ id: "mid", reading_progress: 0.6, last_opened_at: "2026-05-01T00:00:00Z" }),
    doc({ id: "extra", reading_progress: 0.4, last_opened_at: "2025-01-01T00:00:00Z" }),
    doc({ id: "done", reading_progress: 0.99, last_opened_at: "2026-09-10T00:00:00Z" }),
    doc({ id: "unread", reading_progress: 0 }),
  ];
  assert.deepEqual(ids(rankDocs(docs).finish), ["new", "mid", "old"]);
});

test("rankDocs start list: unread only, shortlist before later before new", () => {
  const docs = [
    doc({ id: "inbox", location: "new" }),
    doc({ id: "later1", location: "later" }),
    doc({ id: "short1", location: "shortlist" }),
    doc({ id: "started", location: "shortlist", reading_progress: 0.5 }),
  ];
  assert.deepEqual(ids(rankDocs(docs, () => 0.5).start), ["short1", "later1", "inbox"]);
});

test("rankDocs excludes highlights, notes, child docs, feed and archive", () => {
  const docs = [
    doc({ id: "hl", category: "highlight" }),
    doc({ id: "note", category: "note" }),
    doc({ id: "child", parent_id: "p1" }),
    doc({ id: "feed", location: "feed" }),
    doc({ id: "arch", location: "archive" }),
    doc({ id: "ok" }),
  ];
  assert.deepEqual(ids(rankDocs(docs).start), ["ok"]);
});

test("rankDocs handles empty input and missing progress", () => {
  assert.deepEqual(rankDocs([]), { finish: [], start: [] });
  const r = rankDocs([{ id: "a", location: "later" }]);
  assert.deepEqual(ids(r.start), ["a"]);
});

test("todayKey formats local date", () => {
  assert.equal(todayKey(new Date(2026, 8, 5)), "2026-09-05");
});
