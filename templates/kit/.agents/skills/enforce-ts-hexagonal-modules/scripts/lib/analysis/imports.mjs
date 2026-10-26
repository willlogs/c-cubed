// Collects and resolves module references in parsed sources.
// Keeps syntax traversal separate from boundary policy.



/**
 * Resolves an import using TypeScript configuration.
 *
 * Purpose: Support path aliases and relative module paths.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {string} specifier Imported module specifier.
 * @param {string} containingFile File owning the import.
 * @param {object} compilerOptions Parsed compiler options.
 * @returns {string|undefined} Resolved filename.
 */
export function resolveImport(ts, specifier, containingFile, compilerOptions) {
  // Ask TypeScript to apply project resolution rules.
  const result = ts.resolveModuleName(
    specifier,
    containingFile,
    compilerOptions,
    ts.sys,
  );
  return result.resolvedModule?.resolvedFileName;
}



/**
 * Extracts a module reference from one syntax node.
 *
 * Purpose: Cover declarations, dynamic imports, requires, type imports.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} node Parsed syntax node.
 * @returns {object|undefined} Specifier node, text, and statement.
 */
function moduleReference(ts, node) {
  // Static import and export declarations carry specifiers.
  const declared = node.moduleSpecifier;
  if (declared && ts.isStringLiteralLike(declared)) {
    return { node: declared, specifier: declared.text, statement: node };
  }

  // Dynamic import and require calls pass literal arguments.
  if (ts.isCallExpression(node)) {
    const called = node.expression;
    const runtime = called.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(called) && called.text === 'require');
    const argument = node.arguments[0];
    if (runtime && argument && ts.isStringLiteralLike(argument)) {
      return { node: argument, specifier: argument.text, statement: node };
    }
  }

  // Type-level import() references couple modules too.
  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
    const literal = node.argument.literal;
    if (ts.isStringLiteral(literal)) {
      return { node: literal, specifier: literal.text, statement: node };
    }
  }
  return undefined;
}



/**
 * Records module references below one node.
 *
 * Purpose: Walk the complete syntax tree recursively.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} node Current syntax node.
 * @param {Array<object>} imports Mutable reference collection.
 * @returns {void} No value.
 */
function visitImports(ts, node, imports) {
  // Record this node, then descend into children.
  const reference = moduleReference(ts, node);
  if (reference) imports.push(reference);
  ts.forEachChild(node, (child) => visitImports(ts, child, imports));
}



/**
 * Collects static, runtime, and type-level module references.
 *
 * Purpose: Feed every dependency into boundary rules.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} source Parsed TypeScript source.
 * @returns {Array<object>} Specifier nodes, texts, and statements.
 */
export function collectImports(ts, source) {
  // Start recursive traversal at the file root.
  const imports = [];
  visitImports(ts, source, imports);
  return imports;
}
