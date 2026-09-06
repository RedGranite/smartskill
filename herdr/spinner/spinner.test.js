"use strict";
const assert = require("node:assert/strict");
const net = require("node:net");
const { createAnimation, intervalFrom, callHerdr } = require("./spinner");

(async () => {
  let agents = [
    { pane_id: "working", agent_status: "working" },
    ...["idle", "done", "blocked", "unknown"].map((state) => ({ pane_id: state, agent_status: state })),
  ];
  const writes = [];
  let failure;
  const animation = createAnimation(async (method, params) => {
    if (method === "session.snapshot") {
      if (failure) throw failure;
      return { snapshot: { agents } };
    }
    assert.equal(method, "pane.report_metadata");
    writes.push(params);
    return {};
  });
  await animation.refresh();
  for (let i = 0; i < 9; i++) await animation.frame();
  assert.deepEqual(writes.map((params) => params.tokens.spin), ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷", "⣾"]);
  assert(writes.every((params) => params.pane_id === "working" && params.ttl_ms === 2000));
  agents = [{ pane_id: "working", agent_status: "done" }];
  await animation.refresh();
  assert.equal(writes.at(-1).tokens.spin, null);
  const count = writes.length;
  await animation.frame();
  assert.equal(writes.length, count);
  agents[0].agent_status = "working";
  await animation.refresh();
  await animation.frame();
  failure = new Error("socket unavailable");
  await assert.rejects(animation.refresh(), /socket unavailable/);
  const failedCount = writes.length;
  await animation.frame();
  assert.equal(writes.length, failedCount, "no animation using stale state");
  await animation.clear();
  assert.equal(writes.at(-1).tokens.spin, null);
  assert.equal(intervalFrom({}), 250);
  assert.equal(intervalFrom({ intervalMs: 500 }), 500);
  for (const intervalMs of [0, 249, 1001, "250", 250.5]) assert.throws(() => intervalFrom({ intervalMs }));
  const endpoint = "\\\\.\\pipe\\smartskill-spinner-test-" + process.pid;
  let wireResponse = '{"id":"spinner","result":{"glyph":"⣾"}}\n';
  const server = net.createServer((socket) => socket.once("data", () => {
    // Split inside a UTF-8 glyph to exercise real stream decoding.
    const bytes = Buffer.from(wireResponse);
    const split = Math.max(1, bytes.indexOf(Buffer.from("⣾")) + 1);
    socket.write(bytes.subarray(0, split));
    setImmediate(() => socket.end(bytes.subarray(split)));
  }));
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(endpoint, resolve); });
  try {
    assert.deepEqual(await callHerdr("ping", {}, endpoint), { glyph: "⣾" });
    wireResponse = '{"id":"spinner","error":{"code":"pane_not_found"}}\n';
    assert.equal(await callHerdr("pane.report_metadata", {}, endpoint), null);
    await assert.rejects(callHerdr("session.snapshot", {}, endpoint), /pane_not_found/);
    wireResponse = "";
    await assert.rejects(callHerdr("ping", {}, endpoint), /closed before response/);
    wireResponse = "invalid\n";
    await assert.rejects(callHerdr("ping", {}, endpoint), /JSON|Unexpected/);
  } finally { await new Promise((resolve) => server.close(resolve)); }
  console.log("PASS: ring frames, working-only, clear, fail-closed, interval validation, pipe protocol");
})().catch((error) => { console.error(error); process.exitCode = 1; });
