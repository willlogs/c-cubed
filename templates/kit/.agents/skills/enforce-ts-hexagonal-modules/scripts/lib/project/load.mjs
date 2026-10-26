// Parses an application's TypeScript sources for architecture rules.
// Isolates compiler configuration from rule evaluation.

import fs from 'node:fs';
import path from 'node:path';
import { normalize } from './locations.mjs';



/**
 * Loads and parses one application's handwritten sources.
 *
 * Purpose: Reuse the audited project's compiler configuration.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {string} root Absolute application root.
 * @param {string} src Absolute source root.
 * @returns {object} Parsed project, or error text.
 */
export function loadProject(ts, root, src) {
  // Read the nearest application TypeScript configuration.
  const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) return { error: `Missing tsconfig.json under ${root}` };
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configPath),
  );

  // Parse handwritten source files into syntax trees.
  const sources = new Map();
  for (const fileName of parsed.fileNames) {
    const file = normalize(fileName);
    if (!file.startsWith(`${src}${path.sep}`) || file.endsWith('.d.ts')) continue;
    const text = fs.readFileSync(file, 'utf8');
    sources.set(file, ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true));
  }
  return { options: parsed.options, sources };
}
