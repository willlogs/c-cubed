// Runs every architecture rule against one application root.
// Returns findings without printing or change scoping.

import fs from 'node:fs';
import { loadProject } from '../project/load.mjs';
import { buildLocations } from '../project/locations.mjs';
import { loadTypeScript } from '../project/typescript.mjs';
import { auditDependencies } from './dependencies.mjs';
import { auditModules } from './modules.mjs';



/**
 * Audits one application root completely.
 *
 * Purpose: Load the project, then apply every rule.
 *
 * @param {string} root Application root directory.
 * @param {object} options Parsed command options.
 * @returns {object} Findings and source count, or error text.
 */
export function auditRoot(root, options) {
  // Resolve locations and required entry points.
  const locations = buildLocations(root, options);
  if (!fs.existsSync(locations.composition)) {
    return { error: `Missing composition root: ${locations.composition}` };
  }
  if (!fs.existsSync(locations.modules)) {
    return { error: `Missing modules directory: ${locations.modules}` };
  }

  // Load the compiler and parse handwritten sources.
  const compiler = loadTypeScript(locations.root, options.typescript);
  if (compiler.error) return { error: compiler.error };
  if (compiler.note) console.error(compiler.note);
  const project = loadProject(compiler.ts, locations.root, locations.src);
  if (project.error) return { error: project.error };

  // Apply dependency and bounded-context rules.
  const context = {
    ts: compiler.ts,
    project,
    locations,
    allowedPackages: options.allowPackages,
  };
  const findings = [];
  auditDependencies(context, findings);
  auditModules(context, findings);
  return { root: locations.root, findings, sourceCount: project.sources.size };
}
