// Serves the UI files and the JSON API.
// Browsers and the cc CLI both reach sessions through here.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config/load.mjs";
import { describeStatus } from "../instances/stacks/status.mjs";
import { readUsage } from "./data/feed.mjs";
import { describeProject } from "./data/project.mjs";
import { buildMap } from "./data/map.mjs";
import { buildProgress } from "./data/progress/build.mjs";
import { tickPlanLine } from "./data/today/tick.mjs";
import { QUEUE_ROUTES, answerQueue } from "./queue/api.mjs";
import { kickoffPrompt } from "./roles/prompts.mjs";
import { finishSetup, needsSetup } from "./roles/setup.mjs";
import { spawnWorker } from "./roles/workers.mjs";
import { typeMessage } from "./sessions/input.mjs";
import { screenLines } from "./sessions/screen/mirror.mjs";
import { listSessions, requireSession, stopSession } from "./sessions/terminals.mjs";
import { answerStacks } from "./stacks/api.mjs";
import { createVersion } from "../versions/create.mjs";
import { readCurrent } from "../versions/files.mjs";
import { listVersions } from "../versions/list.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** UI folder; any file inside it may be served. */
const UI = path.join(root, "ui");

/** Files outside the UI folder the browser may load. */
const STATIC = {
  "/": "ui/index.html",
  "/vendor/xterm.js": "node_modules/@xterm/xterm/lib/xterm.js",
  "/vendor/xterm.css": "node_modules/@xterm/xterm/css/xterm.css",
  "/vendor/addon-fit.js": "node_modules/@xterm/addon-fit/lib/addon-fit.js",
};

/** Content types by file extension. */
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

/** Sessions only the owner may stop, from the page. */
const CONTROL = ["assistant", "master"];



/**
 * Finds the file a static URL path names.
 *
 * Purpose: Serve new UI files without listing each one.
 *
 * @param pathname URL path such as /map/render.js.
 * @returns File path, or null when nothing may be served.
 */
function staticFile(pathname) {
  // Vendor files are listed; UI files must stay inside ui/.
  if (STATIC[pathname]) return path.join(root, STATIC[pathname]);
  const file = path.join(UI, path.normalize(pathname));
  const servable = file.startsWith(`${UI}${path.sep}`) && TYPES[path.extname(file)] && fs.existsSync(file);
  return servable ? file : null;
}



/**
 * Writes a JSON response.
 *
 * Purpose: Answer every API call the same way.
 *
 * @param response Outgoing response.
 * @param status HTTP status code.
 * @param value Value to serialize.
 * @returns No value.
 */
function sendJson(response, status, value) {
  // Always JSON, including errors.
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}



/**
 * Reads a JSON request body.
 *
 * Purpose: Accept small JSON payloads from the CLI and UI.
 *
 * @param request Incoming HTTP request.
 * @returns Promise resolving with the parsed body.
 */
function readBody(request) {
  // Collect chunks, then parse once at the end.
  return new Promise((resolve, reject) => {
    // Small payloads only; the UI and CLI send short JSON.
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(error); } });
  });
}



/**
 * Answers API calls under /api.
 *
 * Purpose: Route session control and read-only views.
 *
 * @param repoRoot Main checkout path.
 * @param request Incoming request.
 * @param url Parsed request URL.
 * @returns Promise resolving with status and JSON value.
 */
async function answerApi(repoRoot, request, url) {
  // Paths look like /api/<name>/<target>.
  const [, , name, rawTarget] = url.pathname.split("/");
  const target = decodeURIComponent(rawTarget ?? "");
  if (name === "sessions" && request.method === "GET") return [200, listSessions()];
  if (name === "sessions" && request.method === "POST") {
    const session = await spawnWorker(repoRoot, await readBody(request));
    return [201, { name: session.name, cwd: session.cwd, meta: session.meta }];
  }

  // Queue a message, or type one right away.
  if (QUEUE_ROUTES.includes(name)) return answerQueue(name, target, request.method === "POST" ? await readBody(request) : {});
  if (name === "input") {
    typeMessage(target, (await readBody(request)).text);
    return [200, { ok: true }];
  }
  if (name === "kickoff") {
    if (requireSession("assistant").typed) throw new Error("The assistant already has a conversation.");
    typeMessage("assistant", kickoffPrompt(needsSetup(repoRoot)));
    return [200, { ok: true }];
  }

  // Who the project is, and whether setup still runs.
  if (name === "project") return [200, describeProject(repoRoot)];
  if (name === "setup" && target === "done" && request.method === "POST") return [200, finishSetup(repoRoot)];

  // Read or stop a session; never the control pair.
  if (name === "screen") return [200, { text: screenLines(requireSession(target).screen, Number(url.searchParams.get("lines") ?? 60)) }];
  if (name === "stop") {
    if (CONTROL.includes(target) && request.headers["x-cc-from"]) throw new Error(`Only ${loadConfig().ownerName} stops the assistant or the master, from the page.`);
    stopSession(target, url.searchParams.has("forget"));
    return [200, { ok: true }];
  }

  // Views for Map, Progress, Versions, and Status; some act.
  if (name === "map") return [200, buildMap(repoRoot, url.searchParams.has("fresh"))];
  if (name === "progress") return [200, buildProgress(repoRoot, url.searchParams.has("fresh"))];
  if (name === "plan" && request.method === "POST") return [200, tickPlanLine(repoRoot, await readBody(request))];
  if (name === "status") return [200, { instances: await describeStatus(), usage: readUsage() }];
  if (name === "version") return [200, { current: readCurrent(repoRoot) }];
  if (name === "versions" && request.method === "GET") return [200, listVersions(repoRoot, url.searchParams.has("fresh"))];
  if (name === "versions" && request.method === "POST") return [201, createVersion(repoRoot, await readBody(request))];
  if (name === "stacks") return answerStacks(repoRoot, target, request.method === "POST" ? await readBody(request) : null, url.searchParams.has("fresh"));
  return [404, { error: "unknown endpoint" }];
}



/**
 * Handles one HTTP request.
 *
 * Purpose: Serve static files and delegate the API.
 *
 * @param repoRoot Main checkout path.
 * @param request Incoming request.
 * @param response Outgoing response.
 * @returns Promise resolving when the response is sent.
 */
export async function handleHttp(repoRoot, request, response) {
  // Static UI files and vendored terminal assets first.
  const url = new URL(request.url, "http://localhost");
  const file = request.method === "GET" ? staticFile(url.pathname) : null;
  if (file) {
    response.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "text/plain" });
    return response.end(fs.readFileSync(file));
  }

  // Everything else is the JSON API; errors become 400s.
  if (!url.pathname.startsWith("/api/")) return sendJson(response, 404, { error: "not found" });
  try {
    const [status, value] = await answerApi(repoRoot, request, url);
    return sendJson(response, status, value);
  } catch (error) {
    return sendJson(response, 400, { error: error.message });
  }
}
