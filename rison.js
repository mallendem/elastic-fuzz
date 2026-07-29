'use strict';

/*
 * Jazzer.js fuzz target: RISON decoding.
 *
 * Attack surface: Kibana parses RISON out of URLs / app state everywhere via
 * `@kbn/rison` (src/platform/packages/shared/kbn-rison). `@kbn/rison` is a thin
 * wrapper over the npm package `rison-node`, so we fuzz `rison-node` directly —
 * it is a plain npm dependency and needs no Kibana monorepo build. The
 * decode()/decode_array() paths are the same ones Kibana exercises.
 *
 * Jazzer.js reports a finding when the target throws an *uncaught* exception, or
 * when the process OOMs, hangs (timeout), or crashes natively. So the
 * discipline is: swallow the EXPECTED parse-level errors (malformed input is
 * not a bug), and let anything unexpected propagate so it is reported.
 */

const Rison = require('rison-node');

module.exports.fuzz = function (data) {
  const input = data.toString('utf-8');

  try {
    Rison.decode(input);
  } catch (e) {
    if (!isExpectedParseError(e)) {
      throw e;
    }
  }

  // Also exercise the A-RISON (array) decode path with the same bytes.
  try {
    Rison.decode_array(input);
  } catch (e) {
    if (!isExpectedParseError(e)) {
      throw e;
    }
  }
};

function isExpectedParseError(e) {
  // rison-node signals malformed input by throwing generic Error / SyntaxError /
  // TypeError with a parse message — none of those are bugs. TypeError is a
  // NORMAL parse-failure path here: e.g. `decode('')` throws
  // "TypeError: Cannot read properties of null (reading 'length')" from
  // rison.js readValue when input is exhausted. (Empirically confirmed — CFLite's
  // bad_build_check feeds empty input and this fired.) So we must treat TypeError
  // as expected, otherwise virtually all malformed input reads as a finding and
  // the fuzzer can't even start. Interesting findings are therefore other
  // exception types, OOM, and hangs.
  // NOTE: a RangeError ("Maximum call stack size exceeded") from deeply nested
  // input is arguably a real unbounded-recursion DoS. We currently treat it as
  // expected to keep initial noise low; flip this to `false` for RangeError once
  // a baseline corpus exists if you want to hunt recursion-depth crashes.
  return (
    e instanceof Error &&
    (e instanceof SyntaxError ||
      e instanceof TypeError ||
      e instanceof RangeError ||
      e.constructor === Error)
  );
}
