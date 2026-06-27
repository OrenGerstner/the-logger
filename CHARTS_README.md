# Generating `charts.json` from the preflop PDF

The app's recommendations come entirely from the PokerCoaching preflop charts. Rather
than hand-typing ~70 colour-coded grids (error-prone), `extract_charts.py` reads the
colours straight out of `preflop-charts.pdf` and self-verifies.

## Run it

```bash
pip install pymupdf
python3 extract_charts.py preflop-charts.pdf charts.json
```

You need `preflop-charts.pdf` in the same folder (the file the charts came from).

## What it does

- The charts are embedded **images** (one per chart: the 13×13 grid plus its summary
  table). The script matches each image to its title text (the JSON key), renders the
  chart region, and **samples each cell's background colour** on the fixed 13×13 layout
  (top square of the image; row/col = A,K,Q,…,2, diagonal = pairs, upper-right = suited,
  lower-left = offsuit).
- Maps colour → action per chart set:
  - **RFI:** red = Raise, white = Fold. *(Small Blind:* red = Raise for Value,
    blue = Raise as a Bluff, green = Limp, white = Fold.)
  - **Facing RFI:** red = 3-Bet for Value, blue = 3-Bet as a Bluff, green = Call,
    white = Fold.
  - **RFI vs 3-Bet:** red = 4-Bet for Value, blue = 4-Bet as a Bluff, green = Call,
    white = Fold.
- Writes `charts.json` in the schema from the requirements doc (§6):
  ```json
  { "RFI": { "BTN": { "AA": "Raise", ... } },
    "FacingRFI": { "CO vs UTG/UTG+1": { ... } },
    "RFIvs3Bet": { "UTG vs CO/BTN": { ... } } }
  ```

## Reading the report

Every grid prints a line:

```
[OK] p3 RFI :: UTG  cells=169/169 combos=1326/1326  Fold=1192 Raise=134
```

- `cells=169/169` and `combos=1326/1326` are the hard invariants (13 pairs + 78 suited +
  78 offsuit; pair=6, suited=4, offsuit=12 combos → 1326). Any grid that misses these
  prints `[FAIL]`.
- The per-action combo counts (e.g. `Raise=134`) should match the numbers printed under
  each grid in the PDF — a quick eyeball confirms the colours were read correctly.
  Spot-check a few against the PDF (e.g. RFI UTG Raise = 134, BTN Raise = 678).

## If something fails

Almost always it's the colour thresholds. Open `extract_charts.py`, adjust
`color_bucket()` (the red/blue/green/white cutoffs), and re-run until every line is
`[OK]`. If a grid is `skipped` for "no title", the page layout split a title oddly —
check the `find_title` heuristic for that page.

The script exits non-zero until all grids pass, so it's safe to wire into a build step.

## Then

Drop the verified `charts.json` into the app bundle as the static chart data. Add the
combo-count checksum as a unit test (assert each grid = 169 keys / 1326 combos, and
optionally that key per-action counts match the PDF) so a bad regenerate can't ship.
