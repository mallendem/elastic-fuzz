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
npm install --no-audit --no-fund

# ES|QL parser (@elastic/esql) — instrument the esql package.
compile_javascript_fuzzer kibana-fuzz esql.js -i esql --sync

# RISON decoder (rison-node) — instrument the rison-node package.
compile_javascript_fuzzer kibana-fuzz rison.js -i rison-node --sync

# Seed corpora bootstrap coverage-guided fuzzing. libFuzzer picks up
# $OUT/<fuzzer>_seed_corpus.zip automatically. AI/LLM-generated inputs (e.g.
# from the cluster's Vertex corpus-gen) can be dropped into seeds/<target>/ too.
zip -j "$OUT/esql_seed_corpus.zip" seeds/esql/*
zip -j "$OUT/rison_seed_corpus.zip" seeds/rison/*
