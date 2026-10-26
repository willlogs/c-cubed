#!/usr/bin/env node
// Applies TypeScript-aware readability rules for the Python checker.
// Prints JSON so scoping and reporting stay in Python.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { checkTypeDocs, checkUnitDocs } from './rules/docs.mjs';
import { checkSpacing, checkStepComments } from './rules/layout.mjs';
import { loadTypeScript } from './loader.mjs';
import { collectUnits } from './syntax/collect.mjs';



/**
 * Reads the optional --typescript folder argument.
 *
 * Purpose: Let callers pin the typescript package location.
 *
 * Inputs: None.
 *
 * @returns {string|undefined} Folder argument, when supplied.
 */
function typescriptOption() {
  // Return the value following the flag.
  const index = process.argv.indexOf('--typescript');
  return index === -1 ? undefined : process.argv[index + 1];
}



/**
 * Reads newline-separated target files from stdin.
 *
 * Purpose: Accept long file lists without argument limits.
 *
 * Inputs: None.
 *
 * @returns {Promise<string[]>} Absolute target file paths.
 */
async function readTargets() {
  // Read the stream; readFileSync(0) hits EAGAIN on big pipes.
  process.stdin.setEncoding('utf8');
  let text = '';
  for await (const chunk of process.stdin) {
    text += chunk;
  }

  // Drop blank lines from the streamed list.
  return text.split('\n').map((line) => line.trim()).filter(Boolean);
}



/**
 * Builds a reporter converting positions into findings.
 *
 * Purpose: Give every rule one consistent finding shape.
 *
 * @param {object} sourceFile Parsed source file.
 * @param {object[]} findings Mutable finding collection.
 * @returns {Function} Reporter accepting rule, span, and message.
 */
function createReporter(sourceFile, findings) {
  // Translate offsets into one-based editor coordinates.
  return function report({ rule, level = 'error', from, to = from, message }) {
    // Anchor at the span start; keep the end for scoping.
    const start = sourceFile.getLineAndCharacterOfPosition(from);
    const end = sourceFile.getLineAndCharacterOfPosition(to);
    findings.push({
      path: sourceFile.fileName,
      line: start.line + 1,
      column: start.character + 1,
      endLine: end.line + 1,
      level,
      rule,
      message,
    });
  };
}



/**
 * Chooses the parser dialect for one file.
 *
 * Purpose: Parse JSX and plain JavaScript correctly.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {string} file Target file path.
 * @returns {number} TypeScript script kind.
 */
function scriptKind(ts, file) {
  // Map extensions onto TypeScript script kinds.
  const kinds = {
    '.ts': ts.ScriptKind.TS, '.mts': ts.ScriptKind.TS, '.cts': ts.ScriptKind.TS,
    '.tsx': ts.ScriptKind.TSX, '.jsx': ts.ScriptKind.JSX,
  };
  return kinds[path.extname(file).toLowerCase()] ?? ts.ScriptKind.JS;
}



/**
 * Applies every syntax rule to one file.
 *
 * Purpose: Run documentation, outline, and spacing rules together.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {string} file Target file path.
 * @param {object[]} findings Mutable finding collection.
 * @returns {void} No value.
 */
function analyzeFile(ts, file, findings) {
  // Parse with parent links so names render correctly.
  const text = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(ts, file));
  const report = createReporter(sourceFile, findings);
  const units = collectUnits(ts, sourceFile);

  // Run each rule family over the collected units.
  for (const unit of units.declared) checkUnitDocs(ts, sourceFile, unit, report);
  for (const unit of units.types) checkTypeDocs(sourceFile, unit, report);
  checkStepComments(ts, sourceFile, units, report);
  checkSpacing(ts, sourceFile, units, report);
}



/**
 * Runs the analyzer and prints its JSON result.
 *
 * Purpose: Serve the Python checker one parseable document.
 *
 * Inputs: None.
 *
 * @returns {Promise<void>} Resolves once the JSON is written.
 */
async function main() {
  // Resolve typescript near the targets or main checkout.
  const files = await readTargets();
  const starts = [process.cwd(), ...files.slice(0, 1).map((file) => path.dirname(file))];
  const loaded = loadTypeScript(typescriptOption(), starts);
  if (loaded.error) {
    process.stdout.write(JSON.stringify({ error: loaded.error }));
    return;
  }

  // Analyze each file, isolating unreadable ones.
  const findings = [];
  const notes = loaded.note ? [loaded.note] : [];
  for (const file of files) {
    try {
      analyzeFile(loaded.ts, file, findings);
    } catch (error) {
      notes.push(`Skipped ${file}: ${error.message}`);
    }
  }
  process.stdout.write(JSON.stringify({ findings, notes }));
}



// Emit one JSON document for the Python bridge.
main();
