/**
 * A Cloudflare Worker that serves a live widget.json for Widget Construction Set.
 *
 * Deployed automatically by Workers Builds on every merge to `main`.
 * The document itself is built in ./widget.js.
 */

import { buildWidget } from "./widget.js";

const PATHS = new Set(["/", "/widget.json"]);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-max-age": "86400",
};

function json(body, status, extra = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // WCS re-fetches on its own schedule; a cached answer would show stale
      // values on the Home Screen, which is the one thing this must not do.
      "cache-control": "no-store",
      ...CORS,
      ...extra,
    },
  });
}

/**
 * The request handler, exported on its own so tests can drive it with plain
 * Request objects. The deployed address cannot be called from the build
 * environment, so this is what gets verified.
 *
 * @param {Request} request
 * @param {Date} [now] injected in tests; defaults to the real clock
 */
export function handle(request, now = new Date()) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "method_not_allowed" }, 405, {
      allow: "GET, HEAD, OPTIONS",
    });
  }

  const { pathname } = new URL(request.url);
  if (!PATHS.has(pathname)) {
    return json({ error: "not_found", available: [...PATHS] }, 404);
  }

  return json(buildWidget(now), 200);
}

export default {
  fetch(request) {
    return handle(request);
  },
};
