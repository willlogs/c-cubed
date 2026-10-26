// Finds dependency-bearing construction in TypeScript sources.
// Separates object-graph detection from boundary policy.



/**
 * Records local names from one import declaration.
 *
 * Purpose: Connect constructed symbols to their source modules.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} statement Parsed import declaration.
 * @param {Map<string, string>} bindings Mutable import bindings.
 * @returns {void} No value.
 */
function recordImport(ts, statement, bindings) {
  // Ignore side-effect imports without local bindings.
  const clause = statement.importClause;
  if (!clause) return;
  const specifier = statement.moduleSpecifier.text;
  if (clause.name) bindings.set(clause.name.text, specifier);

  // Record namespace and named imports.
  const named = clause.namedBindings;
  if (named && ts.isNamespaceImport(named)) bindings.set(named.name.text, specifier);
  if (named && ts.isNamedImports(named)) {
    for (const element of named.elements) bindings.set(element.name.text, specifier);
  }
}



/**
 * Identifies a constructed imported symbol.
 *
 * Purpose: Detect service graph creation sites.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} node Parsed syntax node.
 * @returns {string|undefined} Constructed local symbol name.
 */
function constructionName(ts, node) {
  // Treat imported constructors as object-graph creation.
  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
    return node.expression.text;
  }

  // Treat create-prefixed factories as graph creation.
  if (
    ts.isCallExpression(node)
    && ts.isIdentifier(node.expression)
    && /^create[A-Z]/.test(node.expression.text)
  ) return node.expression.text;
  return undefined;
}



/**
 * Records constructions of imported symbols below one node.
 *
 * Purpose: Walk the complete implementation tree recursively.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} node Current syntax node.
 * @param {Map<string, string>} bindings Imported names and specifiers.
 * @param {Array<object>} constructions Mutable construction collection.
 * @returns {void} No value.
 */
function visitConstructions(ts, node, bindings, constructions) {
  // Record imported constructions, then descend.
  const name = constructionName(ts, node);
  const specifier = name ? bindings.get(name) : undefined;
  if (specifier) constructions.push({ name, specifier, node });
  ts.forEachChild(node, (child) => visitConstructions(ts, child, bindings, constructions));
}



/**
 * Collects imported constructors and factories.
 *
 * Purpose: Enforce composition-only dependency construction.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} source Parsed TypeScript source.
 * @returns {Array<object>} Construction nodes and import sources.
 */
export function collectConstructions(ts, source) {
  // Map local imported names to module specifiers.
  const bindings = new Map();
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) recordImport(ts, statement, bindings);
  }

  // Search the syntax tree for imported constructions.
  const constructions = [];
  visitConstructions(ts, source, bindings, constructions);
  return constructions;
}
