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
const TTL_MS = 2000;

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

function createAnimation(call) {
  let working = [];
  let tick = 0;
  const written = new Set();
  const report = (pane, glyph) => call("pane.report_metadata", {
    pane_id: pane, source: SOURCE, tokens: { spin: glyph }, ttl_ms: TTL_MS,
  });
  async function clear(pane) {
    await report(pane, null);
    written.delete(pane);
  }
  return {
    async refresh() {
      working = []; // A failed snapshot must never keep the last working set.
      const result = await call("session.snapshot");
      if (!Array.isArray(result?.snapshot?.agents)) throw new Error("Missing snapshot.agents");
      const next = result.snapshot.agents
        .filter((agent) => agent.agent_status === "working")
        .map((agent) => agent.pane_id);
      if (next.some((id) => typeof id !== "string" || !id)) throw new Error("Invalid pane id");
      for (const pane of written) if (!next.includes(pane)) await clear(pane);
      working = next;
    },
    async frame() {
      const glyph = FRAMES[tick++ % FRAMES.length];
      for (const pane of working) {
        await report(pane, glyph);
        written.add(pane);
      }
    },
    async clear() {
      working = [];
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
  const animation = createAnimation(callHerdr);
  let stopping = false;
  let finished;
  const server = net.createServer((socket) => {
    socket.setEncoding("utf8");
    socket.setTimeout(10000, () => socket.destroy());
    let input = "";
    socket.on("error", (error) => console.error("Control connection:", error.message));
    socket.on("data", async (data) => {
      input += data;
      if (input.length > 32) return socket.destroy();
      if (!input.endsWith("\n")) return;
      if (input.trim() === "stop") {
        stopping = true;
        await finished;
        socket.end("stopped\n");
      } else if (input.trim() === "status") {
        socket.end(JSON.stringify({ pid: process.pid, intervalMs: interval }) + "\n");
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
  if (command === "stop" || command === "status") {
    return console.log(JSON.stringify({ result: await control(command), stateDir: process.env.HERDR_PLUGIN_STATE_DIR }));
  }
  if (command !== "start" && command !== "run") throw new Error("Use start, stop or status");
  const configFile = path.join(process.env.HERDR_PLUGIN_CONFIG_DIR, "config.json");
  const interval = intervalFrom(fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, "utf8")) : {});
  if (command === "start") await start();
  else await run(interval);
}

module.exports = { createAnimation, intervalFrom, callHerdr };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
