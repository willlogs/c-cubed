// Defines strict hexagonal layer dependency rules.
// Keeps policy independent from compiler traversal.

import { describePlace, describeTarget } from '../analysis/places.mjs';



/**
 * Checks whether a target is a same-module layer.
 *
 * Purpose: Express in-module permissions compactly.
 *
 * @param {object} target Target architectural classification.
 * @param {Array<string>} layers Layers the source may import.
 * @returns {boolean} Whether the target sits in an allowed layer.
 */
function isOwnLayer(target, layers) {
  // Cross-module targets are handled before this check.
  return target.kind === 'module' && layers.includes(target.layer);
}



/** Same-module dependencies each module layer may use. */
const LAYER_PERMISSIONS = {
  domain: (target) => isOwnLayer(target, ['domain']),
  application: (target) => target.kind === 'core'
    || isOwnLayer(target, ['domain', 'application']),
  adapters: (target) => ['core', 'generated', 'root-infrastructure'].includes(target.kind)
    || isOwnLayer(target, ['domain', 'adapters', 'infrastructure']),
  infrastructure: (target) => ['core', 'generated'].includes(target.kind)
    || isOwnLayer(target, ['domain', 'infrastructure']),
  interface: (target) => target.kind === 'core'
    || isOwnLayer(target, ['interface'])
    || (isOwnLayer(target, ['domain']) && target.tail === 'driver.ts'),
};



/**
 * Checks one import that crosses module boundaries.
 *
 * Purpose: Permit only adapters reading provider driver contracts.
 *
 * @param {object} source Source architectural classification.
 * @param {object} target Target architectural classification.
 * @param {string} specifier Imported module specifier.
 * @returns {object|undefined} Rule and message when illegal.
 */
function crossModuleViolation(source, target, specifier) {
  // Adapters may read another module's domain/driver.ts only.
  const legal = source.layer === 'adapters'
    && target.layer === 'domain'
    && target.tail === 'driver.ts';
  if (legal) return undefined;
  return {
    rule: 'boundary/cross-module',
    message: `${describePlace(source)} imports ${describeTarget(target)} via '${specifier}'; cross-module imports require adapter → driver`,
  };
}



/**
 * Determines whether one internal import is allowed.
 *
 * Purpose: Encode strict layer dependency direction.
 *
 * @param {object} source Source architectural classification.
 * @param {object} target Target architectural classification.
 * @param {string} specifier Imported module specifier.
 * @returns {object|undefined} Rule and message when illegal.
 */
export function boundaryViolation(source, target, specifier) {
  // Protect core and shared infrastructure from business code.
  const reached = `${describeTarget(target)} via '${specifier}'`;
  if (source.kind === 'core' && target.kind !== 'core') {
    return { rule: 'boundary/layer', message: `core may only import core, not ${reached}` };
  }
  const rootInfrastructure = ['core', 'generated', 'root-infrastructure'];
  if (source.kind === 'root-infrastructure' && !rootInfrastructure.includes(target.kind)) {
    return { rule: 'boundary/layer', message: `root infrastructure may not import ${reached}` };
  }

  // Composition and unlayered roots may wire freely.
  if (source.kind !== 'module') return undefined;
  if (target.kind === 'module' && source.module !== target.module) {
    return crossModuleViolation(source, target, specifier);
  }

  // Apply permissions inside the owning module.
  if (LAYER_PERMISSIONS[source.layer]?.(target)) return undefined;
  return {
    rule: 'boundary/layer',
    message: `${describePlace(source)} may not import ${reached}`,
  };
}
