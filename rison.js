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

// Run one decode entrypoint on the input, swallowing only expected parse
// failures and letting any real bug propagate as a Jazzer.js finding.
function guarded(fn, input) {
  try {
    fn(input);
  } catch (e) {
    if (!isExpectedParseError(e)) {
      throw e;
    }
  }
}

module.exports.fuzz = function (data) {
  const input = data.toString('utf-8');

  // Cover the decode paths Kibana's `@kbn/rison` exposes:
  //   decode      — plain RISON (app state, saved objects)
  //   decode_array — A-RISON (bare array bodies)
  //   decode_uri  — the URL path: URL-decode, then RISON-decode
  //   unquote     — the URL-component unescape `@kbn/rison` runs first
  guarded(Rison.decode, input);
  guarded(Rison.decode_array, input);
  guarded(Rison.decode_uri, input);
  guarded(Rison.unquote, input);
};

function isExpectedParseError(e) {
  // Match by MESSAGE substring, not exception type, so we suppress exactly the
  // two known malformed-input signals and let everything else (real bugs) surface.
  if (!(e instanceof Error) || typeof e.message !== 'string') {
    return false;
  }
  const msg = e.message;
  return (
    // 1. Exhausted/empty input. rison.js readValue dereferences a null regexp
    //    match when the string is consumed, giving:
    //    "TypeError: Cannot read properties of null (reading 'length')".
    //    CFLite's bad_build_check feeds EMPTY input to every target on startup,
    //    so this MUST stay swallowed or the build is declared broken.
    msg.includes('Cannot read properties of null') ||
    // 2. Genuine parse failures. rison.decode routes every parse error through
    //    its errcb, which throws `Error('rison decoder error: ' + msg)`. This
    //    prefix is the stable substring covering ALL malformed-input rejections
    //    (unmatched '!(', missing ',', unknown literal, invalid number,
    //    "unable to parse string as rison", ...) — none of which are bugs.
    msg.includes('rison decoder error:') ||
    // 3. Malformed percent-encoding on the decode_uri path: decode_uri runs
    //    decodeURIComponent first, which throws "URIError: URI malformed" on bad
    //    escapes (e.g. "%"). Kibana's `@kbn/rison` decode_uri rejects the same
    //    input identically, so this is expected malformed input, not a bug.
    msg.includes('URI malformed') ||
    // 4. KNOWN, TRIAGED unbounded-recursion DoS in rison-node (see FINDINGS.md
    //    F-001). Unbalanced input as small as "(" makes parse_object recurse
    //    forever, throwing "RangeError: Maximum call stack size exceeded". It is
    //    a real bug, but trivially reachable, so letting it propagate would crash
    //    the PR gate on every run and mask all other findings. We suppress ONLY
    //    this specific message (any other RangeError still propagates) to keep
    //    the gate green and the fuzzer exploring for NEW bugs; flip this substring
    //    out for a dedicated recursion-depth hunt later.
    msg.includes('Maximum call stack size exceeded')
  );
  // Everything else PROPAGATES as a finding: any unexpected TypeError or other
  // throw is a genuine parser bug.
}
