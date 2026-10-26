// Audits bounded-context contracts and module layout.
// Keeps module ownership checks separate from import rules.

import fs from 'node:fs';
import path from 'node:path';
import { fileFinding } from '../analysis/findings.mjs';
import { requireAdapterOwnership, requireCoverage } from './coverage.mjs';



/**
 * Reports missing module boundary files.
 *
 * Purpose: Require explicit driver and driven contracts.
 *
 * @param {object} moduleInfo Module name and absolute base folder.
 * @param {Array<object>} findings Mutable finding collection.
 * @returns {object} Expected contract filenames.
 */
function requireContracts(moduleInfo, findings) {
  // Define both mandatory domain boundary files.
  const files = {
    driver: path.join(moduleInfo.base, 'domain', 'driver.ts'),
    driven: path.join(moduleInfo.base, 'domain', 'driven.ts'),
  };
  for (const required of Object.values(files)) {
    if (fs.existsSync(required)) continue;
    fileFinding(findings, required, {
      rule: 'module/contracts',
      message: `module ${moduleInfo.name} requires domain/${path.basename(required)}`,
      module: moduleInfo,
    });
  }
  return files;
}



/**
 * Reports files outside named module layers.
 *
 * Purpose: Prevent ambiguous module-level responsibilities.
 *
 * @param {object} moduleInfo Module name and absolute base folder.
 * @param {Array<object>} findings Mutable finding collection.
 * @returns {void} No value.
 */
function rejectLooseFiles(moduleInfo, findings) {
  // Inspect direct children for unlayered files.
  for (const entry of fs.readdirSync(moduleInfo.base, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    fileFinding(findings, path.join(moduleInfo.base, entry.name), {
      rule: 'module/loose-file',
      message: `${moduleInfo.name}/${entry.name} must live inside a named layer`,
    });
  }
}



/**
 * Audits one module's contracts, layout, and coverage.
 *
 * Purpose: Ensure every boundary owns an implementation.
 *
 * @param {object} context Compiler, project, and locations.
 * @param {string} name Audited module name.
 * @param {Array<object>} findings Mutable finding collection.
 * @returns {void} No value.
 */
function auditModule(context, name, findings) {
  // Establish and validate the module boundary files.
  const moduleInfo = { name, base: path.join(context.locations.modules, name) };
  const files = requireContracts(moduleInfo, findings);
  rejectLooseFiles(moduleInfo, findings);

  // Match public and required contracts to implementations.
  requireCoverage(context, moduleInfo, {
    file: files.driver, layer: 'application', label: 'driver', rule: 'coverage/driver',
  }, findings);
  requireCoverage(context, moduleInfo, {
    file: files.driven, layer: 'adapters', label: 'driven port', rule: 'coverage/driven',
  }, findings);
  requireAdapterOwnership(context, moduleInfo, files.driven, findings);
}



/**
 * Audits every bounded context under modules.
 *
 * Purpose: Treat each module folder as one context.
 *
 * @param {object} context Compiler, project, and locations.
 * @param {Array<object>} findings Mutable finding collection.
 * @returns {void} No value.
 */
export function auditModules(context, findings) {
  // Audit each directory below the modules folder.
  const entries = fs.readdirSync(context.locations.modules, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) auditModule(context, entry.name, findings);
  }
}
