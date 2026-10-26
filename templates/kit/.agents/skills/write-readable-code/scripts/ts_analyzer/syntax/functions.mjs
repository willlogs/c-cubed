// Recognizes declared functions that must carry documentation.
// Keeps function syntax rules apart from file traversal.

/** Wrapper calls whose first argument is the real function. */
const FUNCTION_WRAPPERS = new Set(['memo', 'forwardRef', 'useCallback']);

/** Display labels for each documentable unit kind. */
const KIND_LABELS = {
  function: 'Function',
  method: 'Method',
  constructor: 'Constructor',
  getter: 'Getter',
  setter: 'Setter',
  class: 'Class',
  type: 'Type',
};



/**
 * Names the function a wrapper call invokes.
 *
 * Purpose: Recognize bare and namespaced component wrappers.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} call Parsed call expression.
 * @returns {string} Called name, or an empty string.
 */
function calleeName(ts, call) {
  // Accept identifiers and property access like React.memo.
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  return ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
}



/**
 * Returns the function an initializer ultimately holds.
 *
 * Purpose: Treat wrapped components and handlers as functions.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object|undefined} expression Initializer expression.
 * @returns {object|undefined} Arrow or function expression, if any.
 */
function unwrapFunction(ts, expression) {
  // Peel parentheses and type assertions that keep meaning.
  let current = expression;
  while (current && (ts.isParenthesizedExpression(current) || ts.isAsExpression(current)
    || ts.isTypeAssertionExpression?.(current) || ts.isSatisfiesExpression?.(current))) {
    current = current.expression;
  }

  // Look through known wrappers, then accept function syntax.
  if (current && ts.isCallExpression(current) && FUNCTION_WRAPPERS.has(calleeName(ts, current))) {
    return unwrapFunction(ts, current.arguments[0]);
  }
  return current && (ts.isArrowFunction(current) || ts.isFunctionExpression(current))
    ? current
    : undefined;
}



/**
 * Classifies declarations that own a function body.
 *
 * Purpose: Map syntax kinds onto documentation unit kinds.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} node Statement or class member.
 * @returns {string|undefined} Unit kind, when function-like.
 */
export function memberKind(ts, node) {
  // Translate each function-like declaration kind.
  if (ts.isFunctionDeclaration(node)) return 'function';
  if (ts.isMethodDeclaration(node)) return 'method';
  if (ts.isConstructorDeclaration(node)) return 'constructor';
  if (ts.isGetAccessorDeclaration(node)) return 'getter';
  return ts.isSetAccessorDeclaration(node) ? 'setter' : undefined;
}



/**
 * Builds one unit record with a readable label.
 *
 * Purpose: Keep unit shapes identical across producers.
 *
 * @param {string} kind Unit kind key.
 * @param {object} owner Node carrying the JSDoc.
 * @param {object|undefined} fn Function node, absent for types.
 * @param {string} name Declared name, possibly empty.
 * @returns {object} Unit with kind, owner, function, label.
 */
export function unit(kind, owner, fn, name) {
  // Join the kind label and name for messages.
  const label = [KIND_LABELS[kind], name].filter(Boolean).join(' ');
  return { kind, owner, fn, label };
}



/**
 * Describes a declaration that must carry function docs.
 *
 * Purpose: Decide which functions are named, documentable units.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} node Statement or class member.
 * @returns {object|undefined} Declared unit, when applicable.
 */
export function declaredUnit(ts, node) {
  // Leave object-literal members to inline callback rules.
  const kind = memberKind(ts, node);
  const inObject = Boolean(node.parent) && ts.isObjectLiteralExpression(node.parent);
  if (kind && node.body && !inObject) {
    const name = kind === 'constructor' ? '' : (node.name?.getText() ?? 'default');
    return unit(kind, node, node, name);
  }

  // Accept variables and class fields holding functions.
  if (ts.isVariableStatement(node)) {
    const holder = node.declarationList.declarations
      .find((item) => unwrapFunction(ts, item.initializer));
    return holder && unit('function', node, unwrapFunction(ts, holder.initializer), holder.name.getText());
  }
  const field = ts.isPropertyDeclaration(node) && unwrapFunction(ts, node.initializer);
  return field ? unit('method', node, field, node.name.getText()) : undefined;
}
