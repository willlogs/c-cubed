// Parses architecture-checker command options.
// Keeps flag conventions separate from audit behavior.



/** Command usage printed for help and invalid input. */
export const USAGE = [
  'Usage: node check-architecture.mjs [options]',
  '  --root <dir>            Application root containing tsconfig.json and src/.',
  '  --changed               Report only uncommitted and untracked changes.',
  '  --since <ref>           Report only changes since merge-base with <ref>.',
  '  --allow-package <name>  Allow a shared package in domain/application (repeatable).',
  '  --typescript <dir>      Directory from which to resolve the typescript package.',
  '  --src <dir>             Source folder under the root (default: src).',
  '  --modules <dir>         Modules folder under src (default: modules).',
  '  --composition <file>    Composition root under src (default: composition.ts).',
  '  --help                  Print this message.',
].join('\n');



/** Value-taking flags mapped to their option keys. */
const VALUE_FLAGS = {
  root: 'root',
  src: 'src',
  modules: 'modules',
  composition: 'composition',
  typescript: 'typescript',
  since: 'since',
  'allow-package': 'allowPackages',
};



/**
 * Builds options holding every documented default.
 *
 * Purpose: Keep conventions visible in one place.
 *
 * Inputs: None.
 * @returns {object} Default command options.
 */
function defaultOptions() {
  // Mirror the conventional application layout.
  return {
    src: 'src',
    modules: 'modules',
    composition: 'composition.ts',
    allowPackages: [],
    changed: false,
    help: false,
  };
}



/**
 * Stores one flag value on the options.
 *
 * Purpose: Accumulate repeatable flags and overwrite single ones.
 *
 * @param {object} options Mutable command options.
 * @param {string} key Option key receiving the value.
 * @param {string} value Raw command-line value.
 * @returns {void} No value.
 */
function assignValue(options, key, value) {
  // Repeatable package allowances accumulate in order.
  if (Array.isArray(options[key])) options[key].push(value);
  else options[key] = value;
}



/**
 * Parses command-line arguments into audit options.
 *
 * Purpose: Validate flags without external parsing dependencies.
 *
 * @param {Array<string>} argv Arguments after the script path.
 * @returns {object} Options, with error text when invalid.
 */
export function parseOptions(argv) {
  // Walk arguments, supporting both "--flag value" and "--flag=value".
  const options = defaultOptions();
  for (let index = 0; index < argv.length; index += 1) {
    const [flag, inline] = argv[index].split(/=(.*)/s);
    const key = VALUE_FLAGS[flag.replace(/^--/, '')];
    if (flag === '--help' || flag === '-h') options.help = true;
    else if (flag === '--changed') options.changed = true;
    else if (key && flag.startsWith('--')) {
      const value = inline ?? argv[++index];
      if (value === undefined || value.startsWith('--')) {
        return { ...options, error: `Missing value for ${flag}.` };
      }
      assignValue(options, key, value);
    } else return { ...options, error: `Unknown option: ${argv[index]}` };
  }

  // Reject contradictory change scopes.
  if (options.changed && options.since) {
    return { ...options, error: 'Use either --changed or --since, not both.' };
  }
  return options;
}
