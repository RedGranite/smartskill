"use strict";
const assert = require("node:assert/strict");
const net = require("node:net");
const { createAnimation, intervalFrom, callHerdr, readAttention, nextAttention } = require("./spinner");
const marks = (tokens) => Object.entries(tokens).filter(([key, value]) => key.startsWith("spin") && value !== null);

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
  assert.deepEqual(writes.map((params) => params.tokens[`spin_${params.pane_id}`]), ["○", "·"]);
  assert(writes.every((params) => marks(params.tokens).length === 1));
  writes.length = 0;
  for (let i = 0; i < 9; i++) await animation.frame();
  assert.deepEqual(writes.filter((params) => params.pane_id === "working").map((params) => params.tokens.spin), ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷", "⣾"]);
  assert.deepEqual(writes.filter((params) => params.pane_id === "blocked").map((params) => params.tokens.spin_blocked), ["⚠︎", "⚠︎", "\u2800", "\u2800", "⚠︎", "⚠︎", "\u2800", "\u2800", "⚠︎"]);
  assert(writes.every((params) => params.ttl_ms === 2000 && marks(params.tokens).length === 1));
  assert.deepEqual(writes.filter((params) => params.pane_id === "done").map((params) => params.tokens.spin_done), ["✓", "✓", "✓", "✓", "\u2800", "\u2800", "\u2800", "\u2800", "✓"]);
  agents = [{ pane_id: "working", agent_status: "done" }];
  await animation.refresh();
  await animation.frame();
  assert.equal(writes.at(-1).tokens.spin, null);
  assert(["✓", "\u2800"].includes(writes.at(-1).tokens.spin_done));
  const count = writes.length;
  await animation.frame();
  assert.equal(writes.length, count + 1);
  agents[0].agent_status = "working";
  await animation.refresh();
  await animation.frame();
  assert.equal(writes.at(-1).tokens.spin_done, null, "working clears the old static mark");
  assert.equal(marks(writes.at(-1).tokens).length, 1);
  agents[0].agent_status = "blocked";
  await animation.refresh();
  await animation.frame();
  assert.equal(writes.at(-1).tokens.spin, null, "blocked clears the working ring");
  assert.notEqual(writes.at(-1).tokens.spin_blocked, null);
  agents[0].agent_status = "done";
  await animation.refresh();
  await animation.frame();
  assert(["✓", "\u2800"].includes(writes.at(-1).tokens.spin_done));
  assert.equal(writes.at(-1).tokens.spin_blocked, null, "done clears the blinking dot");
  const doneCount = writes.length;
  await animation.frame();
  assert.equal(writes.length, doneCount + 1, "done keeps its slow blink");
  agents = [{ pane_id: "working", agent_status: "working" }, { pane_id: "blocked", agent_status: "blocked" }, { pane_id: "done", agent_status: "done" }];
  await animation.refresh();
  await animation.frame();
  failure = new Error("socket unavailable");
  await assert.rejects(animation.refresh(), /socket unavailable/);
  const failedCount = writes.length;
  await animation.frame();
  assert.equal(writes.length, failedCount, "no working or blocked animation using stale state");
  await animation.clear();
  assert(Object.values(writes.at(-1).tokens).every((value) => value === null));
  const attention = readAttention(["a"]);
  let state = nextAttention(attention, "toggle-view");
  assert.deepEqual(state, { panes: ["a"], expanded: true });
  state = nextAttention(state, "toggle", "b");
  assert.deepEqual(state, { panes: ["a", "b"], expanded: true }, "F preserves expanded view");
  state = nextAttention(state, "toggle-view");
  assert.deepEqual(state, { panes: ["a", "b"], expanded: false }, "G restores the selection");
  state = nextAttention(state, "toggle", "a");
  assert.deepEqual(state, { panes: ["b"], expanded: false });
  assert.deepEqual(readAttention(JSON.parse(JSON.stringify(state))), state);
  assert.deepEqual(readAttention(null), { panes: [], expanded: true });
  assert.throws(() => readAttention({ panes: [], expanded: "yes" }));
  const layoutWrites = [];
  const focusedAnimation = createAnimation(async (method, params) => {
    if (method === "session.snapshot") return { snapshot: {
      agents: ["a", "b"].map((id) => ({ pane_id: id, tab_id: id, name: "sol", agent_status: "working" })),
      tabs: ["a", "b"].map((id) => ({ tab_id: id, label: `Task ${id}` })),
    } };
    layoutWrites.push(params);
    return {};
  }, attention);
  await focusedAnimation.refresh();
  await focusedAnimation.frame();
  assert.equal(layoutWrites[1].tokens.parked_summary, "Task b");
  assert.equal(layoutWrites[1].tokens.focus_summary, null);
  assert.deepEqual(marks(layoutWrites[1].tokens), marks(layoutWrites[0].tokens), "folding keeps the same animated status token");
  assert.equal(layoutWrites[0].tokens.focus_summary, "★ Task a");
  attention.panes = ["b"];
  layoutWrites.length = 0;
  await focusedAnimation.refresh();
  await focusedAnimation.frame();
  assert.equal(layoutWrites[0].pane_id, "a");
  assert.equal(layoutWrites[0].tokens.focus_agent, null);
  assert.equal(layoutWrites.at(-1).pane_id, "b");
  assert.equal(layoutWrites.at(-1).tokens.parked_summary, null);
  attention.expanded = true;
  layoutWrites.length = 0;
  await focusedAnimation.refresh();
  await focusedAnimation.frame();
  assert.equal(layoutWrites.length, 2);
  assert(layoutWrites.every((entry) => entry.tokens.focus_agent === "sol" && entry.tokens.parked_state === null));
  await focusedAnimation.clear();
  assert(Object.values(layoutWrites.at(-1).tokens).every((value) => value === null));
  const statusFrames = [];
  for (const expanded of [true, false]) {
    const frames = [];
    const view = createAnimation(async (method, params) => {
      if (method === "session.snapshot") return { snapshot: { agents: ["working", "blocked", "done", "idle", "unknown"].map((state) => ({ pane_id: state, agent_status: state })) } };
      frames.push([params.pane_id, marks(params.tokens)]);
      assert.equal(params.tokens.parked_state, null, "legacy compact marker stays cleared");
      return {};
    }, { panes: [], expanded });
    await view.refresh();
    for (let i = 0; i < 9; i++) await view.frame();
    statusFrames.push(frames);
  }
  assert.deepEqual(statusFrames[0], statusFrames[1], "all states have identical tokens and animation when folded");
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
  console.log("PASS: slow ✓, ⚠︎ blink, single status slot, ring frames, clear, fail-closed, interval validation, pipe protocol");
})().catch((error) => { console.error(error); process.exitCode = 1; });
