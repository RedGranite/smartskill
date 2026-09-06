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
  assert.deepEqual(writes.map((params) => params.tokens[`spin_${params.pane_id}`]), ["○", "OK", "·"]);
  assert(writes.every((params) => Object.values(params.tokens).filter((value) => value !== null).length === 1));
  writes.length = 0;
  for (let i = 0; i < 9; i++) await animation.frame();
  assert.deepEqual(writes.filter((params) => params.pane_id === "working").map((params) => params.tokens.spin), ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷", "⣾"]);
  assert.deepEqual(writes.filter((params) => params.pane_id === "blocked").map((params) => params.tokens.spin_blocked), ["●", "●", "\u2800", "\u2800", "●", "●", "\u2800", "\u2800", "●"]);
  assert(writes.every((params) => params.ttl_ms === 2000 && Object.values(params.tokens).filter((value) => value !== null).length === 1));
  agents = [{ pane_id: "working", agent_status: "done" }];
  await animation.refresh();
  assert.equal(writes.at(-1).tokens.spin, null);
  assert.equal(writes.at(-1).tokens.spin_done, "OK");
  const count = writes.length;
  await animation.frame();
  assert.equal(writes.length, count);
  agents[0].agent_status = "working";
  await animation.refresh();
  await animation.frame();
  assert.equal(writes.at(-1).tokens.spin_done, null, "working clears the old static mark");
  assert.equal(Object.values(writes.at(-1).tokens).filter((value) => value !== null).length, 1);
  agents[0].agent_status = "blocked";
  await animation.refresh();
  await animation.frame();
  assert.equal(writes.at(-1).tokens.spin, null, "blocked clears the working ring");
  assert.notEqual(writes.at(-1).tokens.spin_blocked, null);
  agents[0].agent_status = "done";
  await animation.refresh();
  assert.equal(writes.at(-1).tokens.spin_done, "OK");
  assert.equal(writes.at(-1).tokens.spin_blocked, null, "done clears the blinking dot");
  const doneCount = writes.length;
  await animation.frame();
  assert.equal(writes.length, doneCount, "done never resumes blinking");
  agents = [{ pane_id: "working", agent_status: "working" }, { pane_id: "blocked", agent_status: "blocked" }];
  await animation.refresh();
  await animation.frame();
  failure = new Error("socket unavailable");
  await assert.rejects(animation.refresh(), /socket unavailable/);
  const failedCount = writes.length;
  await animation.frame();
  assert.equal(writes.length, failedCount, "no working or blocked animation using stale state");
  await animation.clear();
  assert(Object.values(writes.at(-1).tokens).every((value) => value === null));
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
  console.log("PASS: green OK, blocked blink, single status slot, ring frames, clear, fail-closed, interval validation, pipe protocol");
})().catch((error) => { console.error(error); process.exitCode = 1; });
