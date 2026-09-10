"use strict";
// Adapted from hasuwini77/herdr-spinner (MIT; see LICENSE).
const { fork } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const { createHash } = require("node:crypto");
const { setTimeout: sleep } = require("node:timers/promises");
const SOURCE = "smartskill.spinner";
const FRAMES = ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"];
const STATIC_MARKS = { blocked: "\u26a0\ufe0f", done: "\u2705", idle: "○", unknown: "·" };
const EMPTY_TOKENS = Object.fromEntries(["spin", ...Object.keys(STATIC_MARKS).map((state) => `spin_${state}`)].map((key) => [key, null]));
const TTL_MS = 2000;
const EMPTY_LAYOUT = { focus_summary: null, focus_agent: null, parked_summary: null, parked_state: null };

function readAttention(value) {
  // Preserve the previous file format on upgrade; null had already discarded its selection.
  const state = value === null ? { panes: [], expanded: true }
    : Array.isArray(value) ? { panes: value, expanded: false } : value;
  if (!state || !Array.isArray(state.panes) || state.panes.some((pane) => typeof pane !== "string") || typeof state.expanded !== "boolean") throw new Error("Invalid attention.json");
  return state;
}

function nextAttention(state, command, pane) {
  if (command === "toggle-view") return { ...state, expanded: !state.expanded };
  if (command === "expand-all") return { ...state, expanded: true };
  if (command !== "toggle") throw new Error("Invalid attention command");
  return { ...state, panes: state.panes.includes(pane) ? state.panes.filter((id) => id !== pane) : [...state.panes, pane] };
}

function intervalFrom(config) {
  const interval = config.intervalMs ?? 250;
  if (!Number.isInteger(interval) || interval < 250 || interval > 1000) {
    throw new Error("intervalMs must be an integer from 250 to 1000");
  }
  return interval;
}

function callHerdr(method, params = {}, endpoint = "\\\\.\\pipe\\" + process.env.HERDR_SOCKET_PATH) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(endpoint);
    let buffer = "";
    socket.setEncoding("utf8");
    socket.setTimeout(4000, () => socket.destroy(new Error("Herdr API timeout")));
    socket.on("error", reject);
    socket.on("close", () => reject(new Error("Herdr API closed before response")));
    socket.on("connect", () => socket.write(JSON.stringify({ id: "spinner", method, params }) + "\n"));
    socket.on("data", (data) => {
      buffer += data;
      if (buffer.length > 8 * 1024 * 1024) return socket.destroy(new Error("Herdr response too large"));
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      try {
        const response = JSON.parse(buffer.slice(0, newline));
        if (response.id !== "spinner") throw new Error("Herdr response id mismatch");
        if (response.error?.code === "pane_not_found" && method === "pane.report_metadata") resolve(null);
        else if (response.error) throw new Error(JSON.stringify(response.error));
        else if (!response.result) throw new Error("Missing Herdr result");
        else resolve(response.result);
      } catch (error) { reject(error); }
      socket.destroy();
    });
  });
}

function createAnimation(call, attention = { panes: [], expanded: true }) {
  let working = [];
  let blocked = [];
  let done = [];
  let tick = 0;
  let layouts = new Map();
  const written = new Set();
  async function report(pane, glyph, key = "spin") {
    // Set one mark and clear the other states atomically: one visible slot.
    await call("pane.report_metadata", {
      pane_id: pane, source: SOURCE, tokens: { ...EMPTY_TOKENS, ...EMPTY_LAYOUT, ...layouts.get(pane), [key]: glyph }, ttl_ms: TTL_MS,
    });
    written.add(pane);
  }
  async function clear(pane) {
    layouts.delete(pane);
    await report(pane, null);
    written.delete(pane);
  }
  return {
    async refresh() {
      working = []; // A failed snapshot must never keep the last working set.
      blocked = [];
      done = [];
      const result = await call("session.snapshot");
      if (!Array.isArray(result?.snapshot?.agents)) throw new Error("Missing snapshot.agents");
      const agents = result.snapshot.agents;
      if (agents.some((agent) => typeof agent.pane_id !== "string" || !agent.pane_id ||
        (agent.agent_status !== "working" && !Object.hasOwn(STATIC_MARKS, agent.agent_status)))) {
        throw new Error("Invalid pane id or agent status");
      }
      const tabs = new Map((result.snapshot.tabs ?? []).map((tab) => [tab.tab_id, tab.label]));
      layouts = new Map(agents.map((agent) => {
        const selected = attention.panes.includes(agent.pane_id);
        const expanded = attention.expanded || selected;
        const summary = (selected ? "★ " : "") + (tabs.get(agent.tab_id) || agent.terminal_title_stripped || agent.pane_id);
        return [agent.pane_id, expanded
          ? { focus_summary: summary, focus_agent: agent.name || agent.agent || null }
          : { parked_summary: summary, parked_state: agent.agent_status === "working" ? "◌" : STATIC_MARKS[agent.agent_status] }];
      }));
      const next = agents
        .filter((agent) => agent.agent_status === "working" && !layouts.get(agent.pane_id).parked_state)
        .map((agent) => agent.pane_id);
      const present = new Set(agents.map((agent) => agent.pane_id));
      for (const pane of written) if (!present.has(pane)) await clear(pane);
      for (const agent of agents) {
        if (layouts.get(agent.pane_id).parked_state) {
          await report(agent.pane_id, null);
        } else if (!["working", "blocked", "done"].includes(agent.agent_status)) {
          await report(agent.pane_id, STATIC_MARKS[agent.agent_status], `spin_${agent.agent_status}`);
        }
      }
      working = next;
      blocked = agents.filter((agent) => agent.agent_status === "blocked" && !layouts.get(agent.pane_id).parked_state).map((agent) => agent.pane_id);
      done = agents.filter((agent) => agent.agent_status === "done" && !layouts.get(agent.pane_id).parked_state).map((agent) => agent.pane_id);
    },
    async frame() {
      const glyph = FRAMES[tick % FRAMES.length];
      // Two braille blanks retain the emoji's two-cell slot during the off phase.
      const blockedGlyph = Math.floor(tick / 2) % 2 === 0 ? STATIC_MARKS.blocked : "\u2800\u2800";
      const doneGlyph = Math.floor(tick++ / 4) % 2 === 0 ? STATIC_MARKS.done : "\u2800\u2800";
      for (const pane of working) {
        await report(pane, glyph);
      }
      for (const pane of blocked) {
        await report(pane, blockedGlyph, "spin_blocked");
      }
      for (const pane of done) {
        await report(pane, doneGlyph, "spin_done");
      }
    },
    async clear() {
      working = [];
      blocked = [];
      done = [];
      const results = await Promise.allSettled([...written].map(clear));
      for (const result of results) {
        if (result.status === "rejected") console.error("Clear failed; TTL will expire:", result.reason.message);
      }
    },
  };
}

function controlPath() {
  const key = os.userInfo().username + "\0" + path.resolve(process.env.HERDR_SOCKET_PATH).toLowerCase();
  return "\\\\.\\pipe\\smartskill-spinner-" + createHash("sha256").update(key).digest("hex").slice(0, 24);
}

function control(command) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(controlPath());
    let response = "";
    socket.setEncoding("utf8");
    socket.setTimeout(10000, () => socket.destroy(new Error("Spinner control timeout")));
    socket.on("connect", () => socket.write(command + "\n"));
    socket.on("data", (data) => { response += data; });
    socket.on("end", () => resolve(response.trim()));
    socket.on("error", (error) => error.code === "ENOENT" ? resolve("stopped") : reject(error));
  });
}

async function run(interval) {
  const attentionFile = path.join(process.env.HERDR_PLUGIN_STATE_DIR, path.basename(controlPath()) + "-attention.json");
  const attention = readAttention(fs.existsSync(attentionFile) ? JSON.parse(fs.readFileSync(attentionFile, "utf8")) : null);
  const animation = createAnimation(callHerdr, attention);
  const pending = [];
  let stopping = false;
  let finished;
  const server = net.createServer((socket) => {
    socket.setEncoding("utf8");
    socket.setTimeout(10000, () => socket.destroy());
    let input = "";
    socket.on("error", (error) => console.error("Control connection:", error.message));
    socket.on("data", async (data) => {
      input += data;
      if (input.length > 256) return socket.destroy();
      if (!input.endsWith("\n")) return;
      if (input.trim() === "stop") {
        stopping = true;
        await finished;
        socket.end("stopped\n");
      } else if (input.trim() === "status") {
        socket.end(JSON.stringify({ pid: process.pid, intervalMs: interval, attention }) + "\n");
      } else if (["expand-all", "toggle-view"].includes(input.trim()) || /^toggle [A-Za-z0-9:_-]+$/.test(input.trim())) {
        pending.push({ command: input.trim(), socket });
      } else socket.end("unknown command\n");
    });
  });
  const acquired = await new Promise((resolve, reject) => {
    server.once("error", (error) => error.code === "EADDRINUSE" ? resolve(false) : reject(error));
    server.listen(controlPath(), () => resolve(true));
  });
  if (!acquired) {
    process.send?.({ status: "already-running" });
    process.disconnect?.();
    return;
  }
  finished = (async () => {
    let nextPoll = 0;
    try {
      while (!stopping) {
        // One consumer applies controls and frames; no stale frame can undo a toggle.
        while (pending.length) {
          const { command, socket } = pending.shift();
          const pane = command.slice(7);
          if (command.startsWith("toggle ")) {
            const snapshot = await callHerdr("session.snapshot");
            if (!snapshot.snapshot.agents.some((agent) => agent.pane_id === pane)) {
              socket.end(JSON.stringify({ error: "当前 pane 没有 Agent，请先选中一个 Agent 会话" }) + "\n");
              continue;
            }
          }
          const next = nextAttention(attention, command.startsWith("toggle ") ? "toggle" : command, pane);
          fs.writeFileSync(attentionFile + ".tmp", JSON.stringify(next));
          fs.renameSync(attentionFile + ".tmp", attentionFile);
          Object.assign(attention, next);
          socket.end(JSON.stringify({ attention: next }) + "\n");
          nextPoll = 0;
        }
        if (Date.now() >= nextPoll) {
          await animation.refresh();
          nextPoll = Date.now() + 1000;
        }
        if (stopping) break;
        await animation.frame();
        if (!stopping) await sleep(interval);
      }
    } catch (error) {
      console.error(new Date().toISOString(), "Spinner stopped:", error.message);
      process.exitCode = 1;
    } finally {
      stopping = true;
      await animation.clear();
      server.close();
    }
  })();
  process.send?.({ status: "started", pid: process.pid });
  process.disconnect?.();
  await finished;
}

async function start() {
  const log = fs.openSync(path.join(process.env.HERDR_PLUGIN_STATE_DIR, "spinner.log"), "a");
  const child = fork(__filename, ["run"], {
    detached: true, windowsHide: true, stdio: ["ignore", log, log, "ipc"],
  });
  fs.closeSync(log);
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`Spinner exited before ready (${code}); see spinner.log`)));
    child.once("message", (message) => {
      console.log(JSON.stringify({ ...message, stateDir: process.env.HERDR_PLUGIN_STATE_DIR }));
      child.unref();
      resolve();
    });
  });
}

async function main() {
  if (process.platform !== "win32" || process.env.HERDR_ENV !== "1") throw new Error("Run inside Herdr on Windows");
  for (const name of ["HERDR_SOCKET_PATH", "HERDR_PLUGIN_STATE_DIR", "HERDR_PLUGIN_CONFIG_DIR"]) {
    if (!process.env[name]) throw new Error(`Missing ${name}; use the Herdr plugin action`);
  }
  const command = process.argv[2];
  if (["toggle", "expand-all", "toggle-view"].includes(command)) {
    const pane = process.env.HERDR_PANE_ID;
    if (command === "toggle" && !/^[A-Za-z0-9:_-]+$/.test(pane || "")) throw new Error("Missing valid HERDR_PANE_ID");
    const result = await control(command === "toggle" ? `toggle ${pane}` : command);
    if (result === "stopped") throw new Error("Start the spinner first");
    const response = JSON.parse(result);
    if (!Object.hasOwn(response, "attention")) throw new Error(response.error || "Invalid attention response");
    return console.log(result);
  }
  if (command === "stop" || command === "status") {
    return console.log(JSON.stringify({ result: await control(command), stateDir: process.env.HERDR_PLUGIN_STATE_DIR }));
  }
  if (command !== "start" && command !== "run") throw new Error("Use start, stop or status");
  const configFile = path.join(process.env.HERDR_PLUGIN_CONFIG_DIR, "config.json");
  const interval = intervalFrom(fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, "utf8")) : {});
  if (command === "start") await start();
  else await run(interval);
}

module.exports = { createAnimation, intervalFrom, callHerdr, readAttention, nextAttention };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
