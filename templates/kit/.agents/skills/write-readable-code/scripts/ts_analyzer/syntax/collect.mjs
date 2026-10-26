// Collects documentable units and statement lists in one walk.
// Keeps traversal separate from per-declaration recognition.

import { declaredUnit, memberKind, unit } from './functions.mjs';



/**
 * Describes a class or exported type needing a summary.
 *
 * Purpose: Require docs on classes and shared data shapes.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} node Candidate declaration.
 * @returns {object|undefined} Type unit, when applicable.
 */
function typeUnit(ts, node) {
  // Document every class declaration.
  if (ts.isClassDeclaration(node)) return unit('class', node, undefined, node.name?.text ?? 'default');

  // Document interfaces, aliases, and enums others import.
  const exported = node.modifiers?.some((item) => item.kind === ts.SyntaxKind.ExportKeyword);
  const shape = ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
    || ts.isEnumDeclaration(node);
  return exported && shape ? unit('type', node, undefined, node.name.text) : undefined;
}



/**
 * Recognizes inline functions with block bodies.
 *
 * Purpose: Find callbacks and object members for outline checks.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} node Candidate syntax node.
 * @returns {boolean} Whether the node is a block-bodied inline function.
 */
function isInlineFunction(ts, node) {
  // Match callbacks and members of object literals.
  const callback = ts.isArrowFunction(node) || ts.isFunctionExpression(node);
  const member = Boolean(node.parent) && ts.isObjectLiteralExpression(node.parent)
    && Boolean(memberKind(ts, node));
  return (callback || member) && Boolean(node.body) && ts.isBlock(node.body);
}



/**
 * Collects every unit and statement list in a file.
 *
 * Purpose: Classify syntax once for all rule families.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} sourceFile Parsed source file.
 * @returns {object} Declared, inline, type units, and lists.
 */
export function collectUnits(ts, sourceFile) {
  // Prepare one bucket per rule family.
  const found = { declared: [], inline: [], types: [], lists: [] };
  const claimed = new Set();



  /**
   * Records one node, then visits its children.
   *
   * Purpose: Classify every node in a single traversal.
   *
   * @param {object} node Current syntax node.
   * @returns {void} No value.
   */
  function visit(node) {
    // Remember statement and member lists for spacing.
    if (ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node)) found.lists.push(node.statements);
    if (ts.isClassLike(node)) found.lists.push(node.members);

    // Classify declared, inline, and type units.
    const declared = declaredUnit(ts, node);
    if (declared) {
      found.declared.push(declared);
      claimed.add(declared.fn);
    } else if (!claimed.has(node) && isInlineFunction(ts, node)) {
      found.inline.push(node);
    }
    const type = typeUnit(ts, node);
    if (type) found.types.push(type);
    ts.forEachChild(node, visit);
  }



  // Walk the whole file once.
  visit(sourceFile);
  return found;
}
