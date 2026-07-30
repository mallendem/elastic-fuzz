#!/bin/bash -eu
#
# ClusterFuzzLite build for Kibana JS parsers.
#
# base-builder-javascript supplies node + Jazzer.js; we npm-install the pinned
# parsers and compile one fuzzer per target. `compile_javascript_fuzzer` writes
# an LLVMFuzzerTestOneInput-marked wrapper into $OUT and copies node_modules
# alongside it. The `-i <substr>` flag tells Jazzer.js which module to
# instrument for coverage-guided fuzzing; `--sync` runs the (synchronous)
# harnesses synchronously.

cd "$SRC/kibana-fuzz"
npm ci --no-audit --no-fund

# ES|QL parser (@elastic/esql) — instrument the esql package.
compile_javascript_fuzzer kibana-fuzz esql.js -i esql --sync

# ES|QL keyword/operator dictionary. libFuzzer auto-loads <fuzzer>.dict from the
# fuzzer's directory, so shipping it as $OUT/esql.dict seeds the mutator with
# valid grammar tokens. Only esql benefits (rison's tiny grammar is saturated).
cp esql.dict "$OUT/esql.dict"

# RISON decoder (rison-node) — instrument the rison-node package.
compile_javascript_fuzzer kibana-fuzz rison.js -i rison-node --sync

# Seed corpora bootstrap coverage-guided fuzzing. libFuzzer picks up
# $OUT/<fuzzer>_seed_corpus.zip automatically. AI/LLM-generated inputs (e.g.
# from the cluster's Vertex corpus-gen) can be dropped into seeds/<target>/ too.
# nullglob so an empty seeds dir yields an empty array instead of a literal glob.
shopt -s nullglob
esql_seeds=(seeds/esql/*)
rison_seeds=(seeds/rison/*)
if [ ${#esql_seeds[@]} -gt 0 ]; then
  zip -j "$OUT/esql_seed_corpus.zip" "${esql_seeds[@]}"
fi
if [ ${#rison_seeds[@]} -gt 0 ]; then
  zip -j "$OUT/rison_seed_corpus.zip" "${rison_seeds[@]}"
fi
