# ClusterFuzzLite build image for Kibana JS parsers (Jazzer.js).
#
# base-builder-javascript provides the Node.js runtime + Jazzer.js toolchain
# (compile_javascript_fuzzer). NOTE: this image is Ubuntu 20.04 / glibc 2.31, so
# Jazzer.js is pinned to 2.1.0 in package.json (its prebuilt loads on 2.31;
# 4.0.0's prebuilt needs GLIBC_2.32+). Upgrading to Jazzer 4.x needs a
# glibc>=2.32 base for CFLite AND the cluster alike. The harnesses + pinned
# parsers are installed by build.sh.
FROM gcr.io/oss-fuzz-base/base-builder-javascript@sha256:32e3e2333b153cdf47c6322bcdb8006805cb673dfc4b0f8cba585d491dfc7011

# Reconcile the two-layer sanitizer mismatch for JavaScript in CFLite CI:
# cifuzz's config_utils only accepts address|memory|undefined|coverage (rejects
# `none`), but base-builder's `compile` refuses native sanitizers for JS and
# wants `none`. Full OSS-Fuzz sidesteps this via the helper.py CLI (which maps JS
# -> none); the CFLite action does not. Jazzer.js has no native sanitizer, so we
# force SANITIZER=none for JavaScript at compile time regardless of what the CI
# passes in.
RUN sed -i '1a if [ "${FUZZING_LANGUAGE:-}" = "javascript" ]; then export SANITIZER=none; fi' /usr/local/bin/compile

COPY . $SRC/kibana-fuzz
WORKDIR $SRC/kibana-fuzz

# oss-fuzz's `compile` entrypoint runs $SRC/build.sh.
COPY .clusterfuzzlite/build.sh $SRC/
