# The Logger — Tournament Mode (v2 spec section)

Merge this into the main requirements doc. It adds tournament support alongside the existing cash-game app. Where it says "cash charts," that means the existing `charts.json` (RFI / Facing / 3-bet). Where it says "push/fold," that means the new `pushfold.json`.

Also update earlier sections when merging:
- §1: change "v1 scope: 9-handed cash games" → "v1: 9-handed cash games + tournament mode (push/fold + ICM Level 1)."
- §12 (out of scope): remove "Tournament features"; keep the narrower exclusions listed in §T9 below.

---

## T0. Rules compliance — recommendations are POST-HAND ONLY in tournament mode

**In tournament mode, the app never shows a recommendation, chart, or deviation flag during a live hand.** Showing strategy guidance mid-hand is "real-time assistance" and is prohibited by tournament rules (penalty / disqualification risk). Behaviour in tournament mode:

- **During the hand:** the app only *logs* (cards, position, actions, board). No recommendation badge, no chart label, no deviation indicator anywhere on the play/postflop screens.
- **After the hand concludes** (hand-result screen, or when the hand is saved): the recommendation, the chart/push-fold call, and the deviation flag are revealed for review.
- This overrides the cash-game "Show recommendation: before/after" setting — in tournament mode that setting is forced to **post-hand** and the toggle is disabled/greyed with a note ("hidden during hands to comply with tournament rules").
- Applies to **both** the cash-chart regime and the push/fold regime within a tournament session.
- (Cash mode keeps the existing before/after behaviour; this restriction is tournament-only, per the player's setup. The player can still review everything after each hand and in hand history.)

---

## T1. Overview

Tournament mode reuses the entire cash logging flow (table, positions, hand logging, deviations, CSV) and adds the things tournaments require: a **blind structure**, **stack measured in big blinds**, **short-stack push/fold strategy**, **ICM awareness**, and a **tournament money/result model** (buy-in + rebuys → finishing place + prize instead of cash-out).

The single new master variable is **effective stack in big blinds (`effBB`)**. It is what selects the strategy regime each hand:

- **`effBB ≥ 20` → cash charts** (the existing RFI/Facing/3-bet `charts.json`; they assume an ante, so they fit deep tournament play).
- **`effBB < 20` → push/fold** (`pushfold.json`; pure push/fold below ~12bb, mixed 12–20bb but shove is the simplification used here).

`effBB = currentStackChips / currentBigBlind`, where `currentBigBlind` comes from the tournament structure + the level the player is currently on.

---

## T2. Tournament structure

A structure is a list of rows. Most are playable **levels**; some are non-playing rows (breaks, chip races). The app only needs `sb/bb/ante` from the levels; everything else feeds the optional level timer.

### Normalized structure schema
```jsonc
{
  "name": "Choctaw $120 NL Holdem",
  "venue": "Choctaw",            // optional
  "gameType": "tournament",
  "buyIn": 120,                   // entry cost incl. rake (rake split optional)
  "startingChips": 20000,         // entered/confirmed at setup even if absent on the sheet
  "anteType": "big_blind",        // "big_blind" | "traditional" | "none"
  "rows": [
    { "kind": "level", "level": 1, "sb": 100, "bb": 200, "ante": 200, "minutes": 30 },
    { "kind": "break", "label": "Break", "minutes": 15 },
    { "kind": "chiprace", "label": "Race 100's", "minutes": 15 }
    // kinds: "level" | "break" | "chiprace" | "chipremoval"
  ]
}
```
Rules:
- **Never assume SB = BB/2.** Read actual SB, BB, ante per level (real sheets use 100-200, 200-300, 200-400, etc.).
- `anteType: "big_blind"` means ante = BB (the standard now); the app uses the **big-blind-ante** push/fold ranges.
- Non-`level` rows are ignored for strategy; they only drive the optional level timer.

### Getting a structure in (three methods)
1. **AI-assisted prep import (primary convenience):** the player pastes/imports a normalized structure block produced ahead of time (e.g., by dropping the venue's structure sheet into an AI assistant). The app accepts a paste of the normalized JSON/CSV above. The app itself does **not** parse arbitrary PDFs/photos (unreliable, and must work offline).
2. **Manual editor:** add/edit level rows by hand. Always available, fully offline.
3. **Templates:** any structure can be saved and reused as a one-tap preset (recurring venues/events).

A worked example structure file (`wsop-event86-structure.json`) is provided for the WSOP $600 Ultra Stack.

### During play
- The active-session header shows a **Current Level** control (stepper +/- or picker).
- From the current level the app derives `sb/bb/ante` → `effBB` → strategy regime + ante variant.
- Optional: a per-level countdown timer that **suggests** advancing the level (manual confirm; do not auto-advance — clocks drift, breaks happen).

---

## T3. Stack-in-BB routing & ante variant

Each hand:
1. `effBB = currentStackChips / currentBigBlind` (chip stack from the latest stack snapshot / Update Stack; BB from current level).
2. If `effBB ≥ 20` → use cash charts (existing scenario resolver).
3. If `effBB < 20` → use push/fold:
   - **Open-shove** (folded to hero): look up the shove threshold for hero's position; **recommend Shove if `effBB ≤ threshold`, else Fold.**
   - **Facing an all-in** (a player shoved, hero to act): look up the call threshold; **recommend Call if `effBB ≤ threshold`, else Fold.**
4. **Ante variant:** if the current level has an ante (big-blind ante) → use the `*_bbAnte` ranges; if ante 0 (early levels) → use the no-ante ranges.
5. Show the `effBB` and the regime on the play screen so the player understands which engine is active. Flag short-handed as in cash (§4).

Hero's logged action stays Fold / Call / Raise; in the push/fold regime, "Raise" = Shove. Deviation flagging works the same (action family vs recommended family).

---

## T4. Push/fold data (`pushfold.json`)

Generated from a from-scratch Nash push/fold solver (chip-EV equilibrium, Chen-Ankenman model), **validated against the published Primedope equilibrium charts**. Format: each value is the **max effective stack in BB** at which the action is profitable.

### Schema
```jsonc
{
  "meta": { ... },
  "push": {
    "SB":        { "AA": 50, "K6s": 36, "72o": 2.1, ... },   // no-ante, exact Primedope
    "SB_bbAnte": { "AA": 50, "K6s": 36, "72o": 3.6, ... }    // big-blind-ante
  },
  "call": {
    "BB_vs_SB":        { ... },   // no-ante
    "BB_vs_SB_bbAnte": { ... }    // big-blind-ante
  }
}
```
Usage: `shove if effBB <= push[posKey][hand]`; `call if effBB <= call[key][hand]`. `50` = "always" within the model's ceiling.

### Coverage & accuracy (be explicit in the app)
- **Covered now (verified):** SB open-shove + BB-calls-SB-shove, for **no-ante and big-blind-ante**. No-ante numbers are exact (Primedope reference); big-blind-ante = exact no-ante + solver-computed ante delta.
- **NOT covered:** open-shoving from any other position (UTG…BTN when folded to you). The multiway/independent-caller approximation was built and rejected — it under-shoves late positions and could not be verified. **v1 behaviour: when hero is short (<20bb) and would be open-shoving from a non-SB position, treat it as `off-chart` — log the hand, show no push/fold recommendation.** Adding these positions later requires either a validated full-ring solver or an extracted published position chart.
- These are **chip-EV baselines**; apply ICM (T5) on top, and they assume reasonable opponents (adjust vs very tight/loose players).

---

## T5. ICM — Level 1 (manual pressure + heuristic)

True ICM depends on every remaining stack and the exact payout ladder, so it cannot be a static chart and is not auto-computed in v1. Instead:

- A **manual ICM pressure setting** the player sets during play: **Chip-EV (default) / Near bubble / Final table**.
- When set above Chip-EV, the app **tightens** the push/fold recommendation by a heuristic and shows a **risk-premium banner**:
  - *Near bubble:* tighten shove thresholds ~15% and **drop the bottom ~5–10% of the call range**.
  - *Final table:* tighten more (~25–30%); calls especially tighten.
  - (Tightening a "max-BB threshold" range = lower the threshold by the % factor, so marginal hands drop out sooner.)
- Store the ICM pressure setting per hand (it can change as the tournament progresses) for CSV/analysis.
- **Out of scope (Level 2, later):** a real client-side ICM calculator (player enters payout ladder + key stacks → exact ICM-adjusted decision). Capture the payout ladder optionally now (T6) so this can be added without a data migration.

---

## T6. Tournament session & result model

Extends the existing Session entity (gameType = "tournament"):

| field | type | notes |
|---|---|---|
| structure | normalized structure (T2) or templateId | blinds/ante by level |
| currentLevel | number | player-set during play |
| startingChips | number | entered/confirmed at setup |
| buyIns | `Array<{ amount, at }>` | entry + re-entries/rebuys |
| addOns | `Array<{ amount, chips, at }>` | optional |
| payouts | `Array<{ place, amount }>` \| null | optional; enables auto-prize + future ICM. Satellites pay *seats*, not cash — model as a flag/label if needed |
| fieldSize | number \| null | optional (entrants) |
| icmPressure | `"chipEV" \| "nearBubble" \| "finalTable"` | current live setting |
| finishPlace | number \| null | set at bust/end |
| prizeWon | number \| null | from payouts[finishPlace] or entered manually |
| itm | boolean | in the money |
| _net_ (derived) | number | `prizeWon - (sum buyIns + sum addOns)` |

Result entry (replaces cash-out): **finishing place + prize won + ITM flag.** v1 keeps payouts simple — entering the prize at the end always works; importing the full payout ladder is optional.

### Hand additions (tournament)
| field | type | notes |
|---|---|---|
| level | number | level at hand time |
| effBB | number | effective stack in BB at hand time |
| regime | `"cash" \| "pushfold" \| "offchart"` | which engine advised |
| pushFoldRec | `"Shove" \| "Call" \| "Fold" \| null` | when regime = pushfold |
| icmPressureAtHand | same enum | snapshot |

---

## T7. Screen additions

- **New session (tournament):** game type Tournament → fields for structure (pick template / import / build), starting chips, buy-in, optional payouts, optional target. Start → Table Setup.
- **Play screen:** header gains **Current Level** control, **effBB** readout, and an **ICM pressure** toggle. The recommendation area shows the push/fold call (Shove/Fold/Call) with the ante variant, plus the short-handed and ICM banners when active.
- **Structure editor screen:** table of level rows (level/SB/BB/ante/minutes), add/remove/reorder, save as template, import-paste box.
- **Session detail / result:** finishing place + prize + ITM; net and ROI; for tournaments the "stack over time" chart is in chips (with BB axis optional).

---

## T8. CSV additions (tournament rows)

Add columns (blank for cash sessions):
```
tournament_level, effective_bb, regime, push_fold_rec, icm_pressure,
session_finish_place, session_prize_won, session_itm, session_field_size
```

---

## T9. Out of scope (v1 tournament)

- **Full-ring open-shove from non-SB/BTN positions** — pending the multiway push/fold model (next build).
- **Level-2 ICM** (real client-side ICM calculator). Level-1 manual pressure + heuristic only.
- **Satellite seat-payout modeling** beyond a simple flag (satellites pay entries, not a cash ladder).
- **Automatic level advancement** by clock (manual confirm only).
- **Rebuy/bounty-specific EV math** beyond tracking the money in/out.

---

## T10. Build notes

1. Bundle `pushfold.json` as static data alongside `charts.json`. Add a checksum test: every range has 169 hand keys; monotonic sanity (shove thresholds widen later position / shorter stack / with ante).
2. Implement `effBB` routing (T3) and the ante-variant selection.
3. Implement the structure model + editor + paste-import + templates (T2).
4. Implement the ICM Level-1 tightening (T5) as a pure function over the push/fold thresholds.
5. Extend the session/hand/CSV models (T6, T8).
6. Verification: run a mock tournament — deep (cash charts) → mid → short (push/fold, both ante states) → blind battle → ICM pressure toggled — confirm regime switching, ante variant, and CSV.
