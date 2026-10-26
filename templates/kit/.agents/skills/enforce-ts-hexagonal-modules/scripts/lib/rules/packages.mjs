// Decides which packages domain and application code may import.
// Allows shared contract packages by naming convention or flag.



/**
 * Extracts the package name from a bare specifier.
 *
 * Purpose: Compare scoped and unscoped packages uniformly.
 *
 * @param {string} specifier Bare module specifier.
 * @returns {string} Package name without subpath.
 */
export function packageName(specifier) {
  // Keep both segments of scoped package names.
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}



/**
 * Decides whether restricted layers may import a package.
 *
 * Purpose: Admit shared contracts while rejecting other packages.
 *
 * @param {string} specifier Imported module specifier text.
 * @param {Array<string>} allowed Extra packages from --allow-package.
 * @returns {boolean} Whether the import is permitted.
 */
export function isAllowedPackage(specifier, allowed) {
  // Relative and absolute paths are never allow-listed.
  if (specifier.startsWith('.') || specifier.startsWith('/')) return false;

  // Accept packages ending in "contracts" and explicit allowances.
  const name = packageName(specifier);
  if (name.split('/').at(-1) === 'contracts') return true;
  return allowed.some((entry) => (
    name === entry || specifier === entry || specifier.startsWith(`${entry}/`)
  ));
}
