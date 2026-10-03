# Derived geography indexes

These indexes are generated only from the checked-in `public/data/departments` files.
They do not refresh geography, DPE records, averages, or source dates. Source hashes are
recorded in `source-manifest.json`; no source department JSON is rewritten.

Regenerate: `node scripts/generate-geography-indexes.mjs`
Verify without writing: `node scripts/generate-geography-indexes.mjs --check`

- Postcode identifiers remain strings. Every actual matching department is retained,
  including cross-department postcodes and overseas territories. Unknown postcodes
  return no department, rather than a prefix guess.
- The normalized-name index retains all departments for homonyms and accent collisions.
  Known names resolve to coordinates only when exactly one source commune matches.
  Legacy INSEE queries retain every exact candidate instead of choosing by population.
  Query count remains bounded by the existing strict/expanded strategies; regional
  expansion requires exactly one source department. Indexed geography is not a claim
  that ADEME has DPE coverage for every indexed territory.
- The name index uses a dynamic import; service-worker precaching must also be considered
  when measuring first-visit transfer cost.

## Optional averages: temporary freshness policy

The current UI does not identify comparisons as historical snapshots. Until it does,
comparisons require positive, validated samples and a snapshot at most 45 days old.
This is a conservative product safeguard, with a monthly validated source-refresh
target, not a claim that the underlying DPE methodology stays constant for 45 days.
A methodology change requires revalidation or suppression regardless of snapshot age.

The bundled September 2025 averages are therefore suppressed at the time of this fix.
They are not relabeled as current, zero-valued samples are not presented as averages,
and nonexistent files (including Corsica `20`) are not requested. A refreshed source
must be independently validated before replacing source data and regenerating indexes.
The refresh itself is outside this routing patch.
