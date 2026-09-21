import { rankDocs, minutesToRead, todayKey } from "./lib.js";

const CONTINUE_DELAY_S = 8;

const params = new URLSearchParams(location.search);
const site = params.get("site") ?? "";
const target = safeTarget(params.get("to"));
const $ = (id) => document.getElementById(id);

// Only ever continue to a plain http(s) URL.
function safeTarget(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function card(doc) {
  const a = document.createElement("a");
  a.className = "card";
  a.href = doc.url;

  if (doc.image_url?.startsWith("https://")) {
    const img = document.createElement("img");
    img.className = "thumb";
    img.src = doc.image_url;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    a.append(img);
  }

  const body = document.createElement("div");
  body.className = "body";
  const title = document.createElement("div");
  title.className = "title";
  title.textContent = doc.title || doc.url;

  const mins = minutesToRead(doc);
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = [doc.site_name || doc.author, mins ? `${mins} min` : null].filter(Boolean).join(" · ");
  body.append(title, meta);

  const progress = doc.reading_progress ?? 0;
  if (progress > 0.02) {
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("span");
    fill.style.width = `${Math.round(progress * 100)}%`;
    bar.append(fill);
    body.append(bar);
  }

  a.append(body);
  const li = document.createElement("li");
  li.append(a);
  return li;
}

function fill(sectionId, docs) {
  if (!docs.length) return;
  const section = $(sectionId);
  section.querySelector(".cards").replaceChildren(...docs.map(card));
  section.hidden = false;
}

function showNotice(html) {
  const n = $("notice");
  n.innerHTML = html; // static strings only, never document data
  n.hidden = false;
}

function armContinue(delaySeconds) {
  const btn = $("continue");
  const label = `Continue to ${site || "site"}`;
  let left = delaySeconds;
  const tick = () => {
    if (left <= 0) {
      btn.disabled = false;
      btn.textContent = label;
      return;
    }
    btn.textContent = `${label} (${left})`;
    left--;
    setTimeout(tick, 1000);
  };
  tick();

  btn.addEventListener("click", async () => {
    if (btn.disabled || !target) return;
    btn.disabled = true;
    await chrome.runtime.sendMessage({ type: "grantPass", site });
    location.replace(target);
  });
}

async function showCount() {
  const { bypasses } = await chrome.storage.local.get({ bypasses: { date: "", count: 0 } });
  const next = (bypasses.date === todayKey() ? bypasses.count : 0) + 1;
  $("count").textContent = next > 1 ? `Visit #${next} to a gated site today` : "";
}

async function main() {
  $("heading").textContent = site ? `Hold on. That's ${site}.` : "Hold on.";
  showCount();

  if (!target) {
    $("continue").hidden = true;
    return;
  }

  const res = await chrome.runtime.sendMessage({ type: "getDocs" });
  const { finish, start } = rankDocs(res?.docs ?? []);
  fill("finish", finish);
  fill("start", start);

  // Fail open: if Reader can't help, don't make the user wait.
  let delay = CONTINUE_DELAY_S;
  if (res?.error === "no-token") {
    showNotice('Reader Gate isn\'t connected to Reader yet. <a href="#" id="setup">Add your access token</a>.');
    $("setup").addEventListener("click", (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
    delay = 0;
  } else if (res?.error && !finish.length && !start.length) {
    showNotice("Couldn't reach Reader right now.");
    delay = 0;
  } else if (!finish.length && !start.length) {
    $("empty").textContent = "Nothing unread in Reader. Maybe that's a sign to save something.";
    $("empty").hidden = false;
  }
  armContinue(delay);
}

main();
