# Reader Gate

Chromium extension (Manifest V3). When you navigate to a gated site (default: apnews.com,
facebook.com, news.google.com), it shows an interstitial with items from your Readwise Reader
library instead: things to finish (in progress) and things to start (unread, Shortlist first).
You can continue after a short countdown, which grants a timed pass for that site.

## Install (Dia, Chrome, or any Chromium browser)

1. Open `chrome://extensions` (or the browser's equivalent) and enable Developer mode.
2. Load unpacked, and select this folder.
3. Click the extension icon to open settings and paste your token from https://readwise.io/access_token.
4. Use "Test connection", then Save.

The token is stored in `chrome.storage.local` only, never in the repo.

## Behavior

- Only top-level navigations to listed domains (and their subdomains) are intercepted.
- Reader data is cached for 10 minutes (the list API allows 20 requests/min).
- Fails open: with no token or an unreachable API, the Continue button is enabled immediately.
- Feed items and archived items are never shown.

## Tests

`npm test` runs the pure-logic tests (site matching, ranking, pass expiry) with Node's built-in runner.

## License

MIT. See [LICENSE](LICENSE).
