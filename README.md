# elastic-fuzz — ClusterFuzzLite harnesses for Kibana JS parsers

Continuous and per-PR fuzzing of Kibana's JavaScript parsers using
[ClusterFuzzLite](https://google.github.io/clusterfuzzlite/) (Jazzer.js on
libFuzzer), running entirely in GitHub Actions — no self-hosted cluster, no GCP.

> Temporary home. This may migrate to `elastic/kibana-fuzz`. The genuine
> per-Kibana-PR gate ultimately requires `.clusterfuzzlite/` to live in
> `elastic/kibana` (see "Fuzz-per-PR" below).

## Targets

| Fuzzer | Module under test | Kibana surface |
|--------|-------------------|----------------|
| `esql` | [`@elastic/esql`](https://www.npmjs.com/package/@elastic/esql) `parse()` | ES|QL query text (`@kbn/esql-ast`) |
| `rison` | [`rison-node`](https://www.npmjs.com/package/rison-node) `decode()` / `decode_array()` | RISON in URLs / app state (`@kbn/rison`) |

Both are standalone npm packages (pure JS), pinned in `package.json` to the
versions tracking the target Kibana release — so no Kibana monorepo build is
needed. Bump the pins to fuzz a newer Kibana.

## How it works

- `.clusterfuzzlite/Dockerfile` builds on `gcr.io/oss-fuzz-base/base-builder-javascript`
  (Ubuntu 20.04 / glibc 2.31). Jazzer.js is pinned to **2.1.0** because 4.0.0's
  prebuilt requires GLIBC_2.32+; moving to 4.x needs a glibc≥2.32 base for both
  this track and the self-hosted cluster.
- `.clusterfuzzlite/build.sh` `npm install`s the pinned parsers and runs
  `compile_javascript_fuzzer` once per target, plus zips the seed corpora.
- Harnesses (`esql.js`, `rison.js`) export `fuzz(data)`. A finding is any
  uncaught throw, OOM, hang, or native crash.

## Corpus

CFLite has **no LLM corpus generation** (unlike the self-hosted cluster's
Vertex/oss-fuzz-gen path). Corpus comes from:

1. **Seeds** in `seeds/<target>/`, zipped to `$OUT/<target>_seed_corpus.zip` at
   build time. AI/LLM-generated inputs can be committed here.
2. **Coverage-guided mutation** by libFuzzer during a run (keeps inputs that hit
   new coverage).
3. **Persistence** across runs (wired) — see "Corpus & coverage persistence".

## Workflows

- `.github/workflows/cflite_pr.yml` — `code-change` mode: fuzzes a PR for 5 min,
  fails on a new crash. Gates **this** repo's PRs (template for elastic/kibana).
- `.github/workflows/cflite_batch.yml` — `batch` mode: 30-min scheduled run per
  target to surface crashes over time.

## Corpus & coverage persistence (wired)

Corpus and coverage survive across runs, stored in two orphan branches of **this
same repo**, authenticated with the built-in `secrets.GITHUB_TOKEN` (no PAT):

| Branch | Holds | Written by |
|--------|-------|------------|
| `corpus` | `corpus/<target>/` — accumulated inputs | `cflite_batch.yml` `batch` job |
| `coverage` | `coverage/<target>/` — coverage reports | `cflite_batch.yml` `coverage` job |

CIFuzz's git filestore clones `storage-repo` by URL and pushes with plain git, so
the token is embedded in the URL (`x-access-token:${{ secrets.GITHUB_TOKEN }}`)
and the batch workflow grants `permissions: contents: write`. GITHUB_TOKEN pushes
don't re-trigger workflows, so there's no recursion. `cflite_pr.yml` reads the
`corpus` branch (read-only) so PRs fuzz against accumulated inputs.

## Deferred integrations (handoff)

These are intentionally **not** wired yet — the scaffold runs without them:

- **GCS-backed corpus/coverage** (optional, needs WIF + a service account) —
  the more "production" alternative to the same-repo storage branches.

## Fuzz-per-PR on Kibana (north star)

A `cflite_pr.yml` here only gates this repo's PRs. To gate real Kibana PRs,
this `.clusterfuzzlite/` setup must live in `elastic/kibana` and build the
in-tree parsers — which needs Kibana-team buy-in. This repo is the proving
ground and the lift-and-shift template.

## Local smoke test

```bash
podman build -t elastic-fuzz -f .clusterfuzzlite/Dockerfile .
mkdir -p /tmp/ef-out
# :Z relabels the mount for SELinux (Fedora). Drop it on non-SELinux hosts.
podman run --rm -e FUZZING_LANGUAGE=javascript -e SANITIZER=none \
  -e FUZZING_ENGINE=libfuzzer -e ARCHITECTURE=x86_64 \
  -v /tmp/ef-out:/out:Z elastic-fuzz compile
# then run a target briefly:
podman run --rm -v /tmp/ef-out:/out:Z elastic-fuzz /out/esql -runs=500
podman run --rm -v /tmp/ef-out:/out:Z elastic-fuzz /out/rison -runs=500
```
