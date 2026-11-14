# Risk level rule

`risk_level` in `GET /api/conditions` is computed by `data/scripts/build_data.py` for every sol. The worst factor wins; a missing value (`null`) never raises the level.

| Factor | Yellow | Red | Basis |
| --- | --- | --- | --- |
| Minimum air temperature (REMS) | ≤ −80 °C | ≤ −100 °C | ASSUMPTION: cold-soak stress on suit heaters |
| Radiation dose rate | ≥ 2 × RAD mean | ≥ 10 × RAD mean | RAD mean surface dose equivalent 0.64 mSv/day ≈ 26.7 µSv/h (Hassler et al., 2014). Multipliers are an ASSUMPTION (red ≈ solar particle event) |
| Dust optical depth | ≥ 1.0 | ≥ 2.0 | ASSUMPTION; the 2018 global dust storm exceeded tau 8 |
| UV index (REMS) | `very_high` | — | ASSUMPTION: longer exposure needs extra visor protection |

## Data limits

- **Radiation:** REMS has no daily radiation value. Every sol uses the RAD mission mean, so radiation alone never changes the level today. Daily RAD values from the NASA PDS archive can replace it later without changing the format.
- **Dust:** the REMS daily summary only says "Sunny", so `dust_opacity` is `null` for now. Mastcam optical depth from PDS is the candidate source.
- **REMS values** come from the outreach summary published by NASA (processed by CAB, Spain). CAB notes they are for outreach; scientific data is in PDS.

## Result on the current data

4745 sols: 3588 green, 1147 yellow, 10 red (all red days come from very cold nights).

**Caveat on the red days:** all 10 have a minimum of exactly −100 °C. That looks like the lower limit of the reported values rather than a measured extreme, so these sols are flagged in the interface as "may be the sensor limit". They stay red: we cannot tell that the night was warmer.

## Effect on the route

The route verdict (`POST /api/route` with `sol`) uses this level: red makes the EVA No-Go, yellow makes it Caution. The weather does not change walking time or oxygen use (no sourced coefficient for that).
