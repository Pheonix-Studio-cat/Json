# json-api

A Cloudflare Worker that serves a **live `widget.json`** for
[Widget Construction Set](https://wd.gt) (WCS), an iOS app that renders
web-hosted `widget.json` files as Home Screen widgets.

WCS re-downloads the document on its own schedule, so anything that changes
here shows up on the Home Screen without touching the phone.

## The address

```
https://json-api.<your-subdomain>.workers.dev/
https://json-api.<your-subdomain>.workers.dev/widget.json
```

Both return the same document. Paste either one into WCS.

| Header | Value | Why |
| --- | --- | --- |
| `content-type` | `application/json; charset=utf-8` | |
| `cache-control` | `no-store` | a cached answer would show stale values |
| `access-control-allow-origin` | `*` | the address stays usable from a browser page |

Anything other than `GET`, `HEAD` or `OPTIONS` returns `405`. An unknown path
returns `404` with a list of the paths that exist — better than a widget that
silently renders nothing.

## What it draws

A terminal-looking widget: dark window, gradient header, a fake session that
prints the current date and status. Colours are taken from the HTML terminal
widget so the two look like the same thing.

A Home Screen widget cannot run HTML or JavaScript — WCS draws a declarative
layout only, and a tap can at most open a URL. This is a terminal that *looks*
like the real one; it is not interactive.

To change what the widget shows, edit `terminalLines()` in `src/widget.js`.
That function is the whole live surface.

## ⚠️ Schema status

The canvas layout follows the WCS reference at
<https://wd.gt/widget_layout.html>. What is confirmed:

- the canvas is a **12 x 12** grid
- `layers` are drawn in order, first one furthest back
- a layer holds `rows` whose `height` adds up to 12
- a row holds `cells` whose `width` adds up to 12
- a cell may carry `padding` and `background_color_style`
- a text object carries `string` or `data_ref`, plus `size` (default 18)

Key names beyond that list are a **best guess** and may need one correction
pass against the reference. The guessing is confined to `src/widget.js`; the
worker, the tests and the grid invariants do not depend on it.

## Layout

| Path | What |
| --- | --- |
| `src/worker.js` | request handling, headers, routing |
| `src/widget.js` | the document itself: grid, colours, live lines |
| `test/worker.test.mjs` | the test suite |
| `wrangler.jsonc` | Worker name and entry point. **No secrets.** |

## Tests

```
npm test
```

The deployed `*.workers.dev` address is not reachable from every build
environment, so the suite never calls it. It imports the handler and drives it
with real `Request` objects. Beyond the obvious checks it verifies that:

- every layer fills the 12 x 12 grid exactly — the first thing a hand-written
  `widget.json` gets wrong
- every `data_ref` resolves to a field that exists in `data`
- two calls at different times produce **different** output — a suite that only
  checked "it is valid JSON" would be green and would prove nothing

## Deployment

Automatic. Cloudflare Workers Builds rebuilds and deploys on every merge to
`main`. Set up once under Workers & Pages → Create application → Import a
repository:

- **Worker name:** `json-api` — it must match `name` in `wrangler.jsonc`, or the
  build fails
- **Build command:** `npm install`
- **Deploy command:** default (`npx wrangler deploy`)
