// Inspects driver and driven contracts and their implementations.
// Supports composite contracts covered through implemented parents.



/**
 * Checks whether a subtree names one identifier.
 *
 * Purpose: Ignore declaration-only import and export references.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} node Current syntax node.
 * @param {string} name Contract identifier.
 * @returns {boolean} Whether the subtree references the name.
 */
function containsReference(ts, node, name) {
  // Skip import and export declarations entirely.
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return false;
  if (ts.isIdentifier(node) && node.text === name) return true;
  return ts.forEachChild(node, (child) => containsReference(ts, child, name) || undefined) ?? false;
}



/**
 * Finds meaningful identifier usage outside imports.
 *
 * Purpose: Verify port implementation coverage.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} source Parsed TypeScript source.
 * @param {string} name Contract identifier.
 * @returns {boolean} Whether implementation code references it.
 */
export function usesContract(ts, source, name) {
  // Search the complete implementation syntax tree.
  return containsReference(ts, source, name);
}



/**
 * Lists interfaces and type aliases declared by a contract.
 *
 * Purpose: Index contract declarations by name.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} contract Parsed driver or driven file.
 * @returns {Map<string, object>} Declarations keyed by name.
 */
export function contractDeclarations(ts, contract) {
  // Keep only named top-level type declarations.
  const declarations = new Map();
  for (const statement of contract.statements) {
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      declarations.set(statement.name.text, statement);
    }
  }
  return declarations;
}



/**
 * Recognizes signatures whose types are inputs, not members.
 *
 * Purpose: Keep parameter types from implying coverage.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} node Current syntax node.
 * @returns {boolean} Whether traversal should stop here.
 */
function isSignature(ts, node) {
  // Methods, calls, constructors, and parameters take inputs.
  return ts.isMethodSignature(node)
    || ts.isCallSignatureDeclaration(node)
    || ts.isConstructSignatureDeclaration(node)
    || ts.isFunctionTypeNode(node)
    || ts.isConstructorTypeNode(node)
    || ts.isParameter(node);
}



/**
 * Records sibling declarations used as member types.
 *
 * Purpose: Follow properties and heritage, not method parameters.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} node Current syntax node.
 * @param {Map<string, object>} declarations Sibling contract declarations.
 * @param {Set<string>} found Mutable referenced-name collection.
 * @returns {void} No value.
 */
function visitMemberTypes(ts, node, declarations, found) {
  // Stop at signatures whose types are not members.
  if (isSignature(ts, node)) return;
  const named = ts.isTypeReferenceNode(node) ? node.typeName
    : ts.isExpressionWithTypeArguments(node) ? node.expression : undefined;
  if (named && ts.isIdentifier(named) && declarations.has(named.text)) found.add(named.text);
  ts.forEachChild(node, (child) => visitMemberTypes(ts, child, declarations, found));
}



/**
 * Spreads coverage from implemented composites to members.
 *
 * Purpose: Count member contracts of implemented parents.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {Map<string, object>} declarations Contract declarations by name.
 * @param {Array<string>} direct Names implemented directly.
 * @returns {Set<string>} Directly and transitively covered names.
 */
export function propagateCoverage(ts, declarations, direct) {
  // Visit each covered declaration once.
  const covered = new Set(direct);
  const pending = [...direct];
  while (pending.length) {
    const found = new Set();
    visitMemberTypes(ts, declarations.get(pending.pop()), declarations, found);
    for (const name of found) {
      if (!covered.has(name)) pending.push(name);
      covered.add(name);
    }
  }
  return covered;
}
