import { DEFAULT_SITES, DEFAULT_PASS_MINUTES, normalizeSites } from "./lib.js";

const $ = (id) => document.getElementById(id);
const say = (msg) => ($("status").textContent = msg);

async function load() {
  const { token, sites, passMinutes } = await chrome.storage.local.get({
    token: "",
    sites: DEFAULT_SITES,
    passMinutes: DEFAULT_PASS_MINUTES,
  });
  $("token").value = token;
  $("sites").value = sites.join("\n");
  $("pass").value = passMinutes;
}

async function save() {
  const sites = normalizeSites($("sites").value);
  const passMinutes = Math.min(240, Math.max(1, parseInt($("pass").value, 10) || DEFAULT_PASS_MINUTES));
  // Clear the doc cache so a new token takes effect immediately.
  await chrome.storage.local.set({ token: $("token").value.trim(), sites, passMinutes, cache: null });
  $("sites").value = sites.join("\n");
  $("pass").value = passMinutes;
  say("Saved.");
}

async function testConnection() {
  const token = $("token").value.trim();
  if (!token) return say("Enter a token first.");
  say("Testing…");
  try {
    const res = await fetch("https://readwise.io/api/v2/auth/", { headers: { Authorization: `Token ${token}` } });
    say(res.status === 204 ? "Token works." : `Failed (${res.status}).`);
  } catch {
    say("Couldn't reach Readwise.");
  }
}

$("save").addEventListener("click", save);
$("test").addEventListener("click", testConnection);
load();
