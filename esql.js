'use strict';

/*
 * Jazzer.js fuzz target: ES|QL query parsing.
 *
 * Attack surface: ES|QL query text is attacker-influenced (search bars, saved
 * objects, URLs). The parser turns raw query text into an AST.
 *
 * We fuzz `@elastic/esql` — the standalone npm publish of Kibana's ES|QL parser
 * (src/platform/packages/shared/kbn-esql-ast), pinned in package.json to the
 * version that tracks the target Kibana release. It is pure JS (antlr4), so no
 * Kibana monorepo build is needed.
 *
 * `parse()` collects malformed-input errors into `result.errors` and does NOT
 * throw on bad input, so we deliberately DON'T catch anything: any thrown
 * exception is an unexpected parser bug and a real finding. A RangeError
 * ("Maximum call stack size exceeded") from unbounded recursion is a DoS
 * finding and should surface too.
 *
 * We also exercise the two downstream consumers Kibana runs on every parsed
 * query: Walker.walk (AST traversal — visitors, autocomplete, validation all
 * ride on it) and BasicPrettyPrinter.print (serializes the AST back to text).
 * Both tolerate error-ASTs without throwing (verified against malformed input),
 * so — like parse() — they get NO try/catch: a throw is a real bug. Finally we
 * re-parse the printed form as a print/parse round-trip: printing a valid AST
 * must yield re-parseable text.
 */

const { parse, walk, BasicPrettyPrinter } = require('@elastic/esql');

module.exports.fuzz = function (data) {
  const { root } = parse(data.toString('utf-8'));

  // Traverse the AST (visitAny fires on every node).
  walk(root, { visitAny() {} });

  // Serialize the AST back to a query string, then re-parse it.
  const printed = BasicPrettyPrinter.print(root);
  parse(printed);
};
