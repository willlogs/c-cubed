// Maps architecture rule ids to one-line fix recipes.
// Keeps remediation wording beside the printed legend.



/** One-line remediation recipe for every rule id. */
export const FIX_RECIPES = Object.freeze({
  'boundary/cross-module': "Declare a driven port in the consumer's domain/driven.ts, implement it in the consumer's adapters/<capability>.ts by calling the provider's domain/driver.ts, and wire both in composition.",
  'boundary/layer': 'Move the code into the layer allowed to own it, or depend on a port or driver contract instead of the forbidden layer.',
  'boundary/external-package': 'Hide the package behind a driven port and adapter, or a stateless core/ helper; only shared contract packages may enter domain/application.',
  'module/contracts': 'Create the missing file: domain/driver.ts lists what the module offers, domain/driven.ts what it needs.',
  'module/loose-file': 'Move the file into domain/, application/, adapters/, infrastructure/, or interface/ by responsibility.',
  'coverage/driver': "Implement the driver in the module's application layer, expose it through an implemented composite driver, or delete the unused contract.",
  'coverage/driven': "Implement the port in the module's adapters/<capability>.ts and wire it in composition, or delete the unused port.",
  'adapter/ownership': "Make the top-level adapter implement a port from its own domain/driven.ts, or move support code under adapters/<capability>/.",
  'composition/construction': 'Construct services, adapters, and infrastructure in composition and pass them in as ports.',
  'composition/hidden-wiring': 'Replace mutable port setters and service locators with dependencies passed in by composition.',
});



/**
 * Prints remediation recipes for rules that occurred.
 *
 * Purpose: Pair every reported rule with its fix.
 *
 * @param {Set<string>} rules Rule ids shown in this run.
 * @returns {void} No value.
 */
export function printLegend(rules) {
  // Print nothing when the run reported no findings.
  if (!rules.size) return;
  console.log('Fixes:');
  for (const [rule, recipe] of Object.entries(FIX_RECIPES)) {
    if (rules.has(rule)) console.log(`  [${rule}] ${recipe}`);
  }
}
