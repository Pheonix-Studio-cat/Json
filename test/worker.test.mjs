/**
 * The deployed address (*.workers.dev) is unreachable from the build
 * environment, so nothing here calls it. These tests import the handler and
 * drive it with real Request objects instead.
 */

import test from "node:test";
import assert from "node:assert/strict";

import worker, { handle } from "../src/worker.js";
import { buildWidget, GRID } from "../src/widget.js";

const get = (path = "/") => new Request(`https://json-api.example/${path.replace(/^\//, "")}`);

test("GET / answers 200 with parseable JSON", async () => {
  const res = handle(get("/"));

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");

  const body = JSON.parse(await res.text());
  assert.equal(typeof body.name, "string");
  assert.ok(Array.isArray(body.layers));
});

test("/widget.json is the same document", async () => {
  const a = JSON.parse(await handle(get("/"), new Date(0)).text());
  const b = JSON.parse(await handle(get("/widget.json"), new Date(0)).text());

  assert.deepEqual(a, b);
});

test("the answer is never cached", () => {
  assert.equal(handle(get("/")).headers.get("cache-control"), "no-store");
});

test("every layer fills the 12x12 grid exactly", () => {
  const { layers } = buildWidget(new Date(0));
  assert.ok(layers.length > 0, "there is at least one layer");

  for (const [i, layer] of layers.entries()) {
    const height = layer.rows.reduce((sum, row) => sum + row.height, 0);
    assert.equal(height, GRID, `layer ${i}: row heights must add up to ${GRID}`);

    for (const [j, row] of layer.rows.entries()) {
      const width = row.cells.reduce((sum, cell) => sum + cell.width, 0);
      assert.equal(width, GRID, `layer ${i}, row ${j}: cell widths must add up to ${GRID}`);
    }
  }
});

test("every data_ref resolves to something in data", () => {
  const doc = buildWidget(new Date(0));
  const refs = [];

  for (const layer of doc.layers) {
    for (const row of layer.rows) {
      for (const cell of row.cells) {
        if (cell.text?.data_ref) refs.push(cell.text.data_ref);
      }
    }
  }

  assert.ok(refs.length > 0, "the widget references at least one data field");
  for (const ref of refs) {
    assert.ok(ref in doc.data, `data_ref "${ref}" has no matching field in data`);
  }
});

test("the document actually changes over time", async () => {
  // The point of a Worker instead of a static file. A test that only checks
  // "it is valid JSON" would be green and would prove nothing.
  const early = buildWidget(new Date("2026-09-11T08:00:00Z"));
  const later = buildWidget(new Date("2026-09-11T09:30:00Z"));

  assert.notEqual(early.updated, later.updated);
  assert.notEqual(early.data.line_2, later.data.line_2);
});

test("the default export reads the real clock on every call", async () => {
  const first = JSON.parse(await worker.fetch(get("/")).text());
  await new Promise((resolve) => setTimeout(resolve, 10));
  const second = JSON.parse(await worker.fetch(get("/")).text());

  assert.notEqual(first.updated, second.updated);
});

test("POST is refused, OPTIONS is allowed", () => {
  const post = handle(new Request("https://json-api.example/", { method: "POST" }));
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET, HEAD, OPTIONS");

  const options = handle(new Request("https://json-api.example/", { method: "OPTIONS" }));
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("access-control-allow-origin"), "*");
});

test("an unknown path answers 404, not a broken widget", async () => {
  const res = handle(get("/nope"));
  assert.equal(res.status, 404);

  const body = JSON.parse(await res.text());
  assert.equal(body.error, "not_found");
});
