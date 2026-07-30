# Fuzzing findings

Known issues surfaced by the CFLite harnesses. Findings that are suppressed in a
harness (to keep the PR gate green and let the fuzzer keep exploring for NEW
bugs) are recorded here so they are not lost.

---

## F-001 - rison-node unbounded recursion DoS (RangeError)

- **Status:** Triaged / known. Suppressed in `rison.js` (`isExpectedParseError`
  matches `"Maximum call stack size exceeded"`) so the recursion crash does not
  halt the fuzzer on trivial input. Flip that substring out of the filter for a
  dedicated recursion-depth hunt.
- **Target:** `rison-node` `decode()` (exercised by Kibana via `@kbn/rison`,
  `src/platform/packages/shared/kbn-rison`).
- **Trigger input:** a single unbalanced open paren `(`. Also `((`, `(a:(`.
- **Error:** `RangeError: Maximum call stack size exceeded`.
- **Root cause:** `rison.parser.prototype.table['(']` reads the next char; when
  the string is exhausted mid-object it falls through to `--this.index` and calls
  `readValue()`, which re-reads the same `(` without consuming it. Each recursion
  re-enters the `(` handler on the same index, so the parser recurses without
  bound until the JS call stack overflows.
- **Reachability:** 1 byte. RISON is attacker-influenced (parsed out of URLs and
  app/saved-object state throughout Kibana), so malformed RISON reaches this path
  from untrusted input.
- **Severity note:** the throw is a catchable `RangeError`, not a native crash,
  so impact is limited to callers that invoke `decode`/`decode_uri` without
  wrapping it - a synchronous DoS (request/worker aborts on that input). Most
  Kibana call sites likely wrap RISON decoding in try/catch, which would contain
  it; unwrapped call sites would abort. Worth an upstream fix (bound recursion
  depth or detect the non-consuming re-read) regardless.
- **Reproduce:**
  ```js
  require('rison-node').decode('(');  // RangeError: Maximum call stack size exceeded
  ```
