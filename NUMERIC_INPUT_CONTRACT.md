# Numeric search contract

## Accepted input and normalization

- Surface, consumption and GES accept unsigned decimal text with either a comma or
  dot separator, with an optional leading `<` or `>` and surrounding whitespace.
- Both forms preserve the original text. Only the validated request is normalized:
  `65,5` → numeric `65.5`; `>65,5` → comparison string `>65.5`.
- Mixed/repeated separators, incomplete decimals, units, grouped digits, signs,
  exponent notation in user text, non-finite values and precision-losing input
  are rejected. Nothing strips punctuation, concatenates digits or uses parseInt.
- Existing required-field/minimum validation remains. Optional blank/null GES is
  absent. Explicit `0`, `0.0` or `0,0` GES means an exact zero criterion.
- Canonical values survive local history serialization/replay. Nearby history now
  also retains consumption and GES; older records clear these missing fields
  rather than inheriting criteria from a more recent form edit.

## Query tolerances and deliberate changes

- Modern listing and nearby exact surface search retain ±1 m², now centred on the
  actual fractional value: 65.5 → [64.5 TO 66.5].
- Legacy strict surface search retains ±1%: 65.5 → [64.845 TO 66.155].
- Fallback percentages remain: surface ±15% / ±35%, energy/GES ±5% / ±10%; fuzzy
  point variations remain energy ±10% and GES ±20%, with the existing surface
  post-filter ±30%. No location radii are changed.
- Plain-integer percentage bounds retain their previous Math.round behavior.
  Fractional bounds use decimal arithmetic, avoiding both whole-unit rounding and
  binary tails (65.5 ±15% → [55.675 TO 75.325]).
- Existing `<` / `>` UI syntax uses INCLUSIVE API boundaries, not strict mathematical
  inequalities: `<65.5` → [0 TO 65.5], `>65.5` → [65.5 TO 9999]. The existing upper
  cap 9999 is unchanged. Zero comparison boundaries are retained too. Every fallback preserves that requested boundary instead
  of turning it into a two-sided band, emitting NaN or dropping it.
- A numeric GES constraint is retained when an energy class is selected, including
  comparison fallbacks. This fixes a previously dropped criterion.
- Explicit zero GES is now queried and scored as zero, rather than silently
  omitted. This and comparator corrections are intentional exceptions to
  unchanged positive-integer query behavior. Blank/null GES remains unfiltered.
- Scoring keeps the existing weights/tolerances and receives the actual fractional
  value. Legacy/nearby comparison arithmetic uses the numeric boundary rather than
  producing NaN from the `<` / `>` string. Final score rounding is unchanged.

## Runtime compatibility

The new numeric path does not require Object.hasOwn or BigInt. Decimal bounds use
small digit-by-digit arithmetic, and a regression disables both newer APIs while
normalizing criteria and constructing fractional bounds.

## Regression coverage

`fractional-input-contract.spec.js`: real modern/legacy parsers and query builders,
exact and fallback queries, inclusive boundary cases, scoring, nearby address and
radius searches, zero/blank/null GES, malformed/overflow rejection and small values.
`NumericSearchInput.spec.js`: typed/pasted raw text and canonical submitted values.
`FractionalHistory.spec.js`: form → request → serialized history → replay.
`numericSearchInput.spec.js`: syntax, finite values, precision and empty fields.

Real-browser/device verification is separate. Existing skipped live-network tests
remain opt-in and are not replaced by fixture-based tests.
