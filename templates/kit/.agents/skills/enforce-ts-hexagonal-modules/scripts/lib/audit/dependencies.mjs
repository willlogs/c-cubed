// Audits imports, construction, and wiring in every source.
// Applies boundary rules to resolved dependencies.

import path from 'node:path';
import { collectConstructions } from '../analysis/construction.mjs';
import { report } from '../analysis/findings.mjs';
import { collectImports, resolveImport } from '../analysis/imports.mjs';
import { classify, describePlace } from '../analysis/places.mjs';
import { normalize } from '../project/locations.mjs';
import { boundaryViolation } from '../rules/boundaries.mjs';
import { isAllowedPackage } from '../rules/packages.mjs';
import { configurationViolations } from '../rules/wiring.mjs';



/**
 * Resolves a specifier into an architectural place.
 *
 * Purpose: Share resolution between import and construction rules.
 *
 * @param {object} context Compiler, project, and locations.
 * @param {object} source Parsed source owning the specifier.
 * @param {string} specifier Imported module specifier.
 * @returns {object} Resolved file and place, when internal.
 */
function resolvePlace(context, source, specifier) {
  // Resolve with the application's compiler options.
  const { ts, project, locations } = context;
  const resolved = resolveImport(ts, specifier, source.fileName, project.options);
  const file = resolved && normalize(resolved);
  const internal = Boolean(file?.startsWith(`${locations.src}${path.sep}`));
  return { resolved, place: internal ? classify(file, locations) : undefined };
}



/**
 * Evaluates one import against every boundary rule.
 *
 * Purpose: Combine package and layer policies.
 *
 * @param {object} context Compiler, project, and locations.
 * @param {object} place Importing file's classification.
 * @param {object} source Parsed importing source.
 * @param {string} specifier Imported module specifier.
 * @returns {object|undefined} Rule and message when illegal.
 */
function importViolation(context, place, source, specifier) {
  // Apply layer rules to dependencies inside the source tree.
  const target = resolvePlace(context, source, specifier);
  if (target.place) return boundaryViolation(place, target.place, specifier);

  // Keep packages out of domain and application code.
  const restricted = place.kind === 'module'
    && ['domain', 'application'].includes(place.layer);
  const external = Boolean(target.resolved) || !specifier.startsWith('.');
  if (!restricted || !external) return undefined;
  if (isAllowedPackage(specifier, context.allowedPackages)) return undefined;
  return {
    rule: 'boundary/external-package',
    message: `${describePlace(place)} may not import external package '${specifier}'`,
  };
}



/**
 * Reports hidden wiring and construction outside composition.
 *
 * Purpose: Keep the object graph inside the composition root.
 *
 * @param {object} context Compiler, project, and locations.
 * @param {object} source Parsed non-composition source.
 * @param {Array<object>} findings Mutable finding collection.
 * @returns {void} No value.
 */
function auditWiring(context, source, findings) {
  // Reject mutable port setters and service locators.
  for (const match of configurationViolations(source.text)) {
    const node = { getStart: () => match.index, getEnd: () => match.index + match.text.length };
    report(findings, source, {
      node,
      rule: 'composition/hidden-wiring',
      message: `hidden dependency wiring '${match.text}' belongs in composition`,
    });
  }

  // Reject module services, adapters, and infrastructure built here.
  for (const construction of collectConstructions(context.ts, source)) {
    const { place } = resolvePlace(context, source, construction.specifier);
    const owned = ['application', 'adapters', 'infrastructure'].includes(place?.layer);
    if (place?.kind !== 'module' || !owned) continue;
    report(findings, source, {
      node: construction.node,
      rule: 'composition/construction',
      message: `${construction.name} from ${describePlace(place)} must be constructed in composition`,
    });
  }
}



/**
 * Audits dependencies and wiring across all sources.
 *
 * Purpose: Enforce dependency direction and composition ownership.
 *
 * @param {object} context Compiler, project, locations, and allowances.
 * @param {Array<object>} findings Mutable finding collection.
 * @returns {void} No value.
 */
export function auditDependencies(context, findings) {
  // Inspect every module reference in every parsed source.
  for (const source of context.project.sources.values()) {
    const place = classify(source.fileName, context.locations);
    for (const imported of collectImports(context.ts, source)) {
      const violation = importViolation(context, place, source, imported.specifier);
      if (violation) report(findings, source, { node: imported.node, span: imported.statement, ...violation });
    }

    // Composition owns construction; everything else is checked.
    if (place.kind !== 'composition') auditWiring(context, source, findings);
  }
}
