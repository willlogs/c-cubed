// Verifies module contracts have owned implementations.
// Keeps coverage rules separate from module discovery.

import { classify } from '../analysis/places.mjs';
import {
  contractDeclarations,
  propagateCoverage,
  usesContract,
} from '../analysis/contracts.mjs';
import { fileFinding, report } from '../analysis/findings.mjs';
import { normalize } from '../project/locations.mjs';



/**
 * Lists one module layer's parsed sources.
 *
 * Purpose: Limit implementation searches to the owning layer.
 *
 * @param {object} context Compiler, project, and locations.
 * @param {string} moduleName Owning module name.
 * @param {string} layer Layer that must implement contracts.
 * @returns {Array<object>} Parsed sources inside that layer.
 */
function layerSources(context, moduleName, layer) {
  // Filter every parsed source by its classification.
  return [...context.project.sources.values()].filter((source) => {
    const place = classify(source.fileName, context.locations);
    return place.kind === 'module' && place.module === moduleName && place.layer === layer;
  });
}



/**
 * Reports contract interfaces without owned implementations.
 *
 * Purpose: Ensure every port has one concrete boundary.
 *
 * @param {object} context Compiler, project, and locations.
 * @param {object} moduleInfo Module name and absolute base folder.
 * @param {object} check Contract file, layer, label, and rule.
 * @param {Array<object>} findings Mutable finding collection.
 * @returns {void} No value.
 */
export function requireCoverage(context, moduleInfo, check, findings) {
  // Read every declaration published by the contract.
  const { ts, project } = context;
  const contract = project.sources.get(normalize(check.file));
  if (!contract) return;
  const declarations = contractDeclarations(ts, contract);

  // Cover direct implementations, then their composite members.
  const owners = layerSources(context, moduleInfo.name, check.layer);
  const direct = [...declarations.keys()].filter((name) => (
    owners.some((source) => usesContract(ts, source, name))
  ));
  const covered = propagateCoverage(ts, declarations, direct);

  // Report interfaces still lacking any implementation.
  for (const [name, statement] of declarations) {
    if (!ts.isInterfaceDeclaration(statement) || covered.has(name)) continue;
    report(findings, contract, {
      node: statement.name,
      span: statement,
      rule: check.rule,
      message: `${check.label} ${name} has no ${check.layer} implementation`,
      module: moduleInfo,
    });
  }
}



/**
 * Reports top-level adapters without local driven ports.
 *
 * Purpose: Prevent adapters becoming arbitrary shared utilities.
 *
 * @param {object} context Compiler, project, and locations.
 * @param {object} moduleInfo Module name and absolute base folder.
 * @param {string} drivenFile Absolute driven contract filename.
 * @param {Array<object>} findings Mutable finding collection.
 * @returns {void} No value.
 */
export function requireAdapterOwnership(context, moduleInfo, drivenFile, findings) {
  // Collect every local driven-port interface.
  const { ts, project } = context;
  const driven = project.sources.get(normalize(drivenFile));
  const ports = driven?.statements
    .filter((statement) => ts.isInterfaceDeclaration(statement))
    .map((statement) => statement.name.text) ?? [];

  // Ensure each top-level adapter references one local port.
  for (const source of layerSources(context, moduleInfo.name, 'adapters')) {
    const place = classify(source.fileName, context.locations);
    if (place.tail.includes('/')) continue;
    if (ports.some((name) => usesContract(ts, source, name))) continue;
    fileFinding(findings, source.fileName, {
      rule: 'adapter/ownership',
      message: `adapter ${moduleInfo.name}/adapters/${place.tail} implements no port from its domain/driven.ts`,
    });
  }
}
