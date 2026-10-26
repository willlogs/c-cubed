// Classifies source files into architectural places.
// Centralizes layer and module detection for every rule.

import path from 'node:path';



/**
 * Describes a source file's architectural location.
 *
 * Purpose: Map paths onto composition, core, infrastructure, modules.
 *
 * @param {string} file Absolute source filename.
 * @param {object} locations Audited architecture locations.
 * @returns {object} Architectural classification.
 */
export function classify(file, locations) {
  // Treat the composition file and folder as one root.
  if (
    file === locations.composition
    || file.startsWith(`${locations.compositionDir}${path.sep}`)
  ) return { kind: 'composition' };

  // Place module files by module, layer, and tail.
  if (file.startsWith(`${locations.modules}${path.sep}`)) {
    const [module, layer, ...tail] = path.relative(locations.modules, file).split(path.sep);
    return { kind: 'module', module, layer, tail: tail.join('/') };
  }

  // Classify remaining source roots by first segment.
  const [first] = path.relative(locations.src, file).split(path.sep);
  if (first === 'core' || first === 'generated') return { kind: first };
  if (first === 'infrastructure') return { kind: 'root-infrastructure' };
  return { kind: 'root', layer: first };
}



/**
 * Names an architectural place for diagnostics.
 *
 * Purpose: Make violation messages say what was reached.
 *
 * @param {object} place Architectural classification.
 * @returns {string} Short human-readable place name.
 */
export function describePlace(place) {
  // Prefer module/layer names for module code.
  if (place.kind === 'module') return `${place.module}/${place.layer}`;
  if (place.kind === 'root-infrastructure') return 'root infrastructure';
  if (place.kind === 'root') return `src/${place.layer}`;
  return place.kind;
}



/**
 * Names an import target, including its file tail.
 *
 * Purpose: Show exactly which file a violation reached.
 *
 * @param {object} place Target architectural classification.
 * @returns {string} Place name with module-relative file.
 */
export function describeTarget(place) {
  // Append the in-layer path for module targets.
  const name = describePlace(place);
  return place.kind === 'module' && place.tail ? `${name}/${place.tail}` : name;
}
