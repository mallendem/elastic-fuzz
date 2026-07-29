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
 */

const { parse } = require('@elastic/esql');

module.exports.fuzz = function (data) {
  parse(data.toString('utf-8'));
};
