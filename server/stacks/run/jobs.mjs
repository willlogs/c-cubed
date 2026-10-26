// Runs slow stack work in the background with progress.
// The Status tab polls these instead of holding requests open.

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The instances CLI from the same checkout as this server. */
const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../instances/cli.mjs");

/** Output lines kept per job. */
const KEEP_LINES = 30;

/** Color and cursor codes that tools print. */
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;

/** Latest job per row id, running or finished. */
const jobs = new Map();



/**
 * Starts background work for one row.
 *
 * Purpose: Answer the click at once; the UI polls progress.
 *
 * Side effects: Runs work after returning.
 *
 * @param id Row id; one job per row.
 * @param action Short verb such as start, stop, or use.
 * @param work Async function receiving a log callback.
 * @param options exclusive: run one such job at a time.
 * @returns The new job's public summary.
 */
export function runJob(id, action, work, { exclusive = false } = {}) {
  // Double clicks and parallel starts get a clear refusal.
  const busy = jobs.get(id);
  if (busy?.state === "running") throw new Error(`${id} is still running ${busy.action}; wait for it to finish.`);
  const other = exclusive && [...jobs.values()].find((job) => job.exclusive && job.state === "running");
  if (other) throw new Error(`${other.id} is still running ${other.action}; start one stack at a time.`);

  // Record progress lines while the work runs.
  const job = { id, action, exclusive, state: "running", step: "Starting…", lines: [], error: null, startedAt: Date.now(), finishedAt: null };
  jobs.set(id, job);
  Promise.resolve()
    .then(() => work((text) => appendLines(job, text)))
    .then(() => Object.assign(job, { state: "done", finishedAt: Date.now() }))
    .catch((error) => Object.assign(job, { state: "failed", error: error.message, finishedAt: Date.now() }));
  return summarize(job);
}



/**
 * Lists every row's latest job.
 *
 * Purpose: Feed the Status rows their progress and results.
 *
 * Inputs: None.
 *
 * @returns Job summaries keyed by row id.
 */
export function listJobs() {
  // Summaries leave out internal flags.
  return Object.fromEntries([...jobs.values()].map((job) => [job.id, summarize(job)]));
}



/**
 * Runs the instances CLI, streaming output into a job.
 *
 * Purpose: Reuse the CLI's commands instead of duplicating them.
 *
 * Side effects: Whatever the CLI command does.
 *
 * @param repoRoot Main checkout path, the CLI's working folder.
 * @param args CLI arguments such as ["down", "pr-41"].
 * @param log Job callback receiving output text.
 * @returns Promise that rejects with the CLI's last line.
 */
export function runCli(repoRoot, args, log) {
  // Plain output: no colors, since lines become UI text.
  return new Promise((resolve, reject) => {
    // Remember the last line; the CLI prints its error last.
    const output = { last: "" };
    const child = spawn(process.execPath, [CLI, ...args], { cwd: repoRoot, env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" } });
    for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => forward(chunk, output, log));
    child.once("error", reject);
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(output.last || `instances ${args[0]} exited ${code}`))));
  });
}



/**
 * Passes CLI output to a job, remembering the last line.
 *
 * Purpose: A failed command's error is its last line.
 *
 * Side effects: Updates output.last.
 *
 * @param chunk Raw output chunk.
 * @param output Holder of the last line seen.
 * @param log Job callback receiving output text.
 * @returns No value.
 */
function forward(chunk, output, log) {
  // Blank chunks keep the previous last line.
  output.last = cleanLines(chunk).at(-1) ?? output.last;
  log(String(chunk));
}



/**
 * Adds output text to a job, keeping only recent lines.
 *
 * Purpose: Show the latest step without unbounded memory.
 *
 * Side effects: Updates the job's lines and step.
 *
 * @param job Job record.
 * @param text Raw output, possibly several lines.
 * @returns No value.
 */
function appendLines(job, text) {
  // The newest non-empty line is the current step.
  const lines = cleanLines(text);
  if (!lines.length) return;
  job.lines = [...job.lines, ...lines].slice(-KEEP_LINES);
  job.step = lines.at(-1);
}



/**
 * Splits output into clean, non-empty lines.
 *
 * Purpose: Drop color codes and progress redraws.
 *
 * @param text Raw output text.
 * @returns Trimmed lines.
 */
function cleanLines(text) {
  // Carriage returns redraw a line, so treat them as breaks.
  return String(text).replace(ANSI, "").split(/\r?\n|\r/).map((line) => line.trim()).filter(Boolean);
}



/**
 * Copies the fields the UI shows.
 *
 * Purpose: Keep internal flags out of API answers.
 *
 * @param job Job record.
 * @returns Public job summary.
 */
function summarize(job) {
  // The last few lines are enough to explain a failure.
  const { id, action, state, step, error, startedAt, finishedAt } = job;
  return { id, action, state, step, error, startedAt, finishedAt, lines: job.lines.slice(-8) };
}
