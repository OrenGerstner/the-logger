# The Logger — Preflop Hand Tracker

**A mobile PWA for logging poker hands live at the table and checking your preflop play against the PokerCoaching preflop charts.**

Companion file: `thelogger-mockups.html` (open in a browser to see all screens).
Repository: `https://github.com/OrenGerstner/the-logger`
Target deployment: `https://the-logger.playthetab.com` (Vercel)

---

## 1. Goal & context

The user is a live poker player who wants to verify, hand by hand, that he is making the correct preflop decision (fold / call / raise) for his cards, position, and the action in front of him. The app lets him log each hand quickly and discreetly at the table, compares his preflop action to a known set of preflop charts, flags deviations, and exports everything to CSV for later review with an AI assistant.

**v1 scope: 9-handed cash games.** Tournament support (ICM, push/fold, blind levels) is explicitly out of scope for v1 but the data model should not block adding it later.

Primary success criterion: after a session, the player can see which hands he misplayed preflop versus the charts, understand session profitability including elapsed time and $/hour, and export a clean CSV.

Multiple sessions in the same day at the same venue are fully supported — each session is an independent DB entry.

---

## 2. Platform & architecture

- **Type:** Progressive Web App (PWA), installable to the phone home screen, runs full-screen, works fully offline.
- **Stack:** React + TypeScript + Vite. Service worker for offline caching. No backend, no server, no accounts.
- **Storage:** All data on-device.
  - Hands and sessions: **IndexedDB** (use Dexie.js).
  - Settings and persistent table state: `localStorage`.
  - Active hand draft: `localStorage` (persists across phone lock/unlock).
- **Hosting:** Vercel, served at `the-logger.playthetab.com`. Build output is static assets only.
- **No backup / sync in v1.** Data lives only on the device. CSV export is the manual safety valve. (Note in onboarding/settings that clearing site data deletes everything.)
- **Orientation:** Portrait (vertical) only. Lock to portrait.
- **Cost:** Entirely free — all libraries open-source, no paid services required.

### Architecture layers

1. **UI (React components)** — screens listed in §9.
2. **Domain logic (pure, unit-tested functions)** — position engine, hand normalizer, scenario resolver, chart lookup, deviation checker. No I/O; fully testable.
3. **Data** — the preflop charts bundled as static JSON (see §6).
4. **Persistence** — Dexie repository for sessions/hands/stackSnapshots; localStorage for settings, table state, and active hand draft; CSV exporter.

---

## 3. Core domain model

### Entities

**Session**
| field | type | notes |
|---|---|---|
| id | string (uuid) | |
| createdAt | ISO datetime | |
| gameType | `"cash" \| "tournament"` | v1 uses `cash` |
| venue | string (optional) | e.g. "Commerce Casino, LA" |
| stakes | `{ smallBlind: number, bigBlind: number }` | |
| currency | string | default from settings |
| startingTableSize | `6 \| 8 \| 9` | starting seating only |
| buyIns | `Array<{ amount: number, at: ISO datetime }>` | supports multiple buy-ins / rebuys |
| startingStack | number \| null | defaults to initial buy-in |
| cashOut | number \| null | set when session ends |
| status | `"active" \| "ended"` | |
| endedAt | ISO datetime \| null | |
| timerStartedAt | ISO datetime | |
| timerPausedAt | ISO datetime \| null | |
| timerPauses | `Array<{ startedAt, endedAt }>` | excluded from elapsed time |
| target | `SessionTarget \| null` (optional) | profit goal; see §3A |
| _elapsedSeconds_ (derived) | number | wall-clock seconds minus pauses |
| _net_ (derived) | number | `cashOut - sum(buyIns)` |
| _profitPerHour_ (derived) | number \| null | `net / elapsedHours` |

**SessionTarget**
```ts
{ type: 'multiplier'; multiplier: 2 | 3 | 4 | 5 }
  — target stack = startingStack × multiplier
{ type: 'amount'; amount: number }
  — target stack = exact stack amount
```
Set at session creation. A progress bar is shown live in the play screen.

**Hand**
| field | type | notes |
|---|---|---|
| id | string (uuid) | |
| sessionId | string | |
| handNumber | number | sequential within session |
| timestamp | ISO datetime | |
| tableSize | number | active player count for this hand |
| shortHanded | boolean | `tableSize < 9` |
| buttonSeat | number | |
| heroSeat | number | |
| heroPosition | position label | derived |
| holeCards | `[Card, Card]` | |
| handKey | string | normalized 169-key |
| preflop | Preflop (below) | |
| board | `{ flop?, turn?, river? }` | |
| postflop | `{ flop?, turn?, river? }` | hero action per street (Fold/Call/Raise) |
| result | `"won" \| "lost" \| "folded" \| null` | |
| wouldHave | `"won" \| "lost" \| "no_showdown" \| null` | when result = "folded" |
| amount | number \| null | |
| amountSource | `"manual" \| "stack_snapshot" \| "unentered"` | |
| stackBefore | number \| null | |
| stackAfter | number \| null | |
| stackAttributionConfidence | `"exact" \| "likely" \| "ambiguous" \| null` | |
| note | string | |

**Preflop** (embedded in Hand)
| field | type | notes |
|---|---|---|
| scenario | `"RFI" \| "FacingRFI" \| "RFIvs3Bet" \| "OffChart"` | |
| facingPosition | position \| null | |
| chartRecommendation | string \| null | |
| heroAction | `"Fold" \| "Call" \| "Raise"` | |
| heroSecondAction | `"Fold" \| "Call" \| "Raise" \| null` | for RFIvs3Bet second decision |
| opponentActions | `Array<{ seat, position, action }>` | |
| deviation | boolean | |

**TableState** (localStorage)
- `occupiedSeats: number[]`
- `heroSeat: number`
- `buttonSeat: number`
- `maxSeats: number`

**StackSnapshot**
| field | type | notes |
|---|---|---|
| id | string (uuid) | |
| sessionId | string | |
| createdAt | ISO datetime | |
| handNumberContext | number | |
| stackAmount | number | |
| previousStackAmount | number \| null | |
| deltaFromPrevious | number \| null | |
| source | `"session_start" \| "quick_update" \| "hand_result" \| "session_end"` | |
| candidateHandIds | string[] | |
| assignedHandId | string \| null | |
| attributionConfidence | `"exact" \| "likely" \| "ambiguous" \| null` | |
| note | string | |

**Settings** (localStorage) — see §10.

### Card & position types
- `Card` = rank + suit, rank ∈ `A K Q J T 9 8 7 6 5 4 3 2`, suit ∈ `s h d c`.
- Position labels (9-handed): `UTG, UTG+1, UTG+2, LJ, HJ, CO, BTN, SB, BB`.

---

## 4. Position engine & live player count

**Player count is dynamic, never fixed.** Every hand, the active count = number of occupied seats. Positions, scenario selection, and recommendations are all recomputed per hand from the current occupied seats + button.

### Deriving positions
Given `occupiedSeats`, `buttonSeat`, and `heroSeat`:

1. Order the occupied seats clockwise starting after the button.
2. Assign positions anchored to the button:
   - The button seat = `BTN`; the two seats clockwise after = `SB`, then `BB`.
   - The remaining seats fill backward: `CO, HJ, LJ, UTG+2, UTG+1, UTG`.
3. Positions that don't exist at the current count are absent (earliest positions drop first).

Deterministic mapping by active count N:

| N | positions present |
|---|---|
| 9 | UTG, UTG+1, UTG+2, LJ, HJ, CO, BTN, SB, BB |
| 8 | UTG+1, UTG+2, LJ, HJ, CO, BTN, SB, BB |
| 7 | UTG+2, LJ, HJ, CO, BTN, SB, BB |
| 6 | LJ, HJ, CO, BTN, SB, BB |
| 5 | HJ, CO, BTN, SB, BB |
| 4 | CO, BTN, SB, BB |
| 3 | BTN, SB, BB |

### Short-handed flag
When `tableSize < 9`, the app uses that position's 9-max chart and sets `shortHanded = true`, showing a warning. Blinds and button positions stay exact.

---

## 5. Scenario resolver (which chart applies)

**First decision:**
- No raise before hero → **RFI**
- One raise before hero → **FacingRFI**
- Limper (no raise) before hero → **OffChart**
- Two or more raises before hero → **OffChart**

**Second decision (hero opened, someone 3-bets behind):**
- Single 3-bet behind → **RFIvs3Bet**
- Beyond this → **OffChart**

**Off-chart:** log fully, set `scenario = "OffChart"`, no recommendation, no deviation flag.

---

## 6. The preflop charts (data asset)

Charts come from `preflop-charts.pdf` (PokerCoaching, 9-handed, 100bb). Bundled as `charts.json` generated by `extract_charts.py`. Do not hand-transcribe. Re-run script only if source PDF changes.

### Three chart sets
1. **RFI** — one chart per opening position (UTG through SB, no BB RFI). SB uses Raise for Value / Raise as Bluff / Limp / Fold.
2. **FacingRFI** — keyed `heroPosition vs raiserGroup`.
3. **RFIvs3Bet** — keyed `heroPosition vs threeBettorGroup`.

### JSON schema
```jsonc
{
  "RFI": { "BTN": { "AA": "Raise", ... }, "SB": { "AA": "Raise for Value", ... } },
  "FacingRFI": { "CO vs UTG/UTG+1": { "AA": "3-Bet for Value", ... } },
  "RFIvs3Bet": { "UTG vs CO/BTN": { "AA": "4-Bet for Value", ... } }
}
```
Every grid must contain exactly 169 hand keys.

---

## 7. Recommendation display & deviation flagging

### Display
- Plain label only: `Fold`, `3-Bet for Value`, etc. **Limp → displayed as `Call`**.
- **Timing setting:** Before I act (default) / After I act.
- **Focus on RFI setting (default ON):** recommendation only shown when `scenario === 'RFI'`. Facing-raise and 3-bet scenarios show no rec.
- Tapping the recommendation badge disables it (sets showRecommendation → 'after', showChartAfterFold → false).
- Off-chart spots show no recommendation.

### Deviation check
Collapse to families for comparison:
- **Raise family:** `Raise`, `Raise for Value`, `Raise as a Bluff`, `3-Bet for Value`, `3-Bet as a Bluff`, `4-Bet for Value`, `4-Bet as a Bluff`.
- **Call family:** `Call`, `Limp`.
- **Fold family:** `Fold`.

`deviation = true` when player's action family ≠ chart action family.

---

## 8. Hand lifecycle

### Standard flow (preflop focus mode OFF)
`preflop → [optional 3-bet decision] → flop → turn → river → hand result`

### Preflop focus mode (default ON)
After the hero selects Fold / Call / Raise preflop, skip postflop screens entirely and go directly to hand result. The hand result shows:
- **Won / Lost** (if hero did not fold)
- **Would Win / Would Lose / No Showdown** (if hero folded)

This is the recommended mode for live play. Disable in Settings to re-enable the postflop flow.

### Postflop flow (preflop focus OFF)
- Each street captures board cards + hero action (Fold/Call/Raise).
- If hero folds at any postflop street, a **"× No Showdown — save & new hand"** quick-save button appears. Tapping it saves the hand (result=folded, wouldHave=no_showdown) and immediately starts a new hand.
- Board cards are entered via the card picker (tappable placeholders per street).

### wouldHave outcomes (when hero folds at any street)
- **Would Win** — hero would have won the pot
- **Would Lose** — hero would have lost
- **No Showdown** — hand didn't reach showdown (e.g. villain bluffed, hero folded, no cards shown)

### "Log new hand" and "Save & log new hand"
Always available. Saves the current hand in its current state, advances the button seat, starts a fresh hand draft, and navigates to the play screen. If table positions can't be derived (misconfigured table), navigates to table setup instead.

### Draft persistence
The active hand draft is persisted to localStorage so phone lock/unlock does not reset it.

### Hole card editing
After picking hole cards, tapping the displayed cards re-opens the card picker for corrections. Previously selected cards are pre-populated and selectable.

---

## 8A. Session stopwatch, stack updates, and hourly profit

### Session stopwatch
- Starts automatically when session starts.
- Shown as `HH:MM` in the session header.
- Optional pause/resume for breaks.

### Stack tracking
1. **Manual hand amount** on the Hand Result screen.
2. **Quick stack update** from the play screen header (Update Stack button).

### Session target & progress bar
If a session target is set, the play screen shows a compact progress bar:
- Baseline = starting stack
- Current = latest stack snapshot amount
- Target = computed from target type (multiplier or exact amount)
- Bar fills blue toward target; turns green when reached; shows remaining amount

### Reporting
- Net = `cashOut - totalBuyIns` (ended); `latestStack - totalBuyIns` (active)
- $/hr = `net / elapsedHours`

---

## 9. Screens & interactions

All screens portrait-only.

1. **Home** — active session card (hands, elapsed time, stack); Continue session / Hand history / Edit table / All sessions / End session. No active session → New session / All sessions.

2. **New session** — venue, stakes (presets + custom), table size (6/8/9), buy-in, **session target** (None / 2x / 3x / 4x / 5x / custom amount). Start session → Table Setup.

3. **Table setup / edit mode** — poker table ring with seat numbers displayed outside circles; tap a seat to assign me/sitting/empty; short-handed indicator. Home button to return to main menu.

4. **Play screen (main)** — session header (elapsed, stack, net, $/hr); optional target progress bar; hand/table info bar with Home (⌂) and Edit buttons; 9-seat oval with position labels and opponent action badges; hole card display (tap to edit); recommendation badge (tap to dismiss); Fold/Call/Raise action buttons; Log new hand button; Go to flop button (visible only when preflop focus mode is OFF and hero has called/raised).

5. **Card picker** — 52 cards in four suit columns, ranks down. Used for hole cards (2 cards) and board cards (flop=3, turn=1, river=1). Already-used cards greyed out; re-picking existing cards makes them selectable again.

6. **Postflop screens (flop / turn / river)** — board card entry (tap placeholders); hero's hole cards hidden with tap-to-peek; Fold/Call/Raise; No Showdown quick-save button (visible when hero has folded); note field; Log new hand / Next street or Hand result buttons. (Only reachable when preflop focus mode is OFF.)

7. **Hand result** — hole cards revealed; deviation banner; Won/Lost or Would Win/Would Lose/No Showdown depending on whether hero folded; optional amount won/lost; optional current stack entry; note; Save & log new hand.

8. **Hand history** — session summary strip; scrollable hand list (cards, position, action, result, deviation, amount).

9. **All sessions (Past Sessions)** — list of all sessions ordered newest first; tap a session row to open its detail; trash icon to delete session and all its data (confirmation dialog); active session marked with badge.

10. **Session detail** — date/venue/stakes header; stats: time played, total hands; street breakdown table (Folded preflop / Saw flop / Saw turn / Saw river / Went to showdown — count and % of total); Results (total P/L, earn rate $/hr, buy-in, cash-out); SVG stack-over-time chart (plotted from stack snapshots, green if up / red if down, dashed baseline at starting stack).

11. **Settings** — see §10.

### Seat interactions
- **Two modes:** Play mode (default) — tap seat to log opponent action. Edit mode — tap seat to change occupancy/your seat.
- **Seat numbers** shown outside circles so seats are identifiable without guessing.
- **Opponent action popover** — shows seat number + action buttons (Raise/Call/Fold) + X to close.
- **Long-press** occupied seat in edit mode → quick-remove.
- **Auto-named raise levels**: first raise = open, raise over raise = 3-bet, next = 4-bet.

---

## 10. Settings

- **Theme:** Dark (default) / Light.
- **Preflop focus mode (default ON):** After preflop action, skip postflop screens and go straight to hand result. Recommended for live play. Disable to enable full postflop street logging.
- **Focus on RFI only (default ON):** Show recommendation only for RFI scenarios. Facing-raise and 3-bet spots show no rec.
- **Show recommendation:** Before I act (default) / After I act.
- **Show chart after I fold** (preflop only): on/off (default on).
- **Hide hole cards postflop:** on/off (default on).
- **Flag chart deviations:** on/off (default on).
- **Currency:** symbol/code (default $).
- **Default table size:** 6 / 8 / 9 (default 9).
- **Pause timer during breaks:** on/off (default on).
- **Export all data (CSV).**

---

## 11. CSV export

One row per hand. Columns:

```
session_id, session_venue, game_type, stakes, session_buyin_total, session_cashout,
session_elapsed_seconds, session_elapsed_hours, session_net, session_profit_per_hour,
hand_number, timestamp, table_size, short_handed, button_seat, hero_seat, hero_position,
hole_cards, hand_key, stack_before, stack_after, preflop_scenario, facing_position,
chart_recommendation, hero_preflop_action, hero_second_action, deviation,
flop, turn, river, hero_flop_action, hero_turn_action, hero_river_action,
result, would_have, amount, amount_source, stack_attribution_confidence, note, opponent_actions
```

Separate optional export for stack snapshots:
```
session_id, snapshot_id, created_at, hand_number_context, stack_amount,
previous_stack_amount, delta_from_previous, source, candidate_hand_ids,
assigned_hand_id, attribution_confidence, note
```

---

## 12. Out of scope (v1)

- Tournament features: ICM, push/fold charts, blind levels.
- 6-max-specific charts.
- Cloud sync, accounts, backup/restore.
- Postflop strategy/recommendations.
- Multiway and limped-pot preflop recommendations (logged as off-chart).
- Check/Bet as distinct postflop actions (v1 postflop is Fold/Call/Raise).
- Heads-up (2-handed) position derivation.

---

## 13. Implementation notes

- **Framework:** Vite + React + TypeScript + Dexie.js + Radix UI (Dialog). `vite-plugin-pwa` for service worker.
- **Navigation:** State-based (no React Router). `NavigationContext` maintains a screen stack. `navigate()` pushes; `goBack()` pops. Each screen unmounts when not on top.
- **Hand draft:** `HandContext` (React Context, global). Draft is persisted to `localStorage` via `useEffect` so phone lock doesn't lose progress.
- **Table state:** `useTableState` is a local `useState` hook (not global context). Each component gets its own copy synced to localStorage. Always compute `nextBtnSeat` synchronously before any state updates.
- **Chart data:** `charts.json` at repo root. `lookupRFI('SB', 'AA')` → `'Limp'`; displayed as `'Call'`.
- **Button advancement:** After saving a hand, compute the next button seat from the sorted occupied seats array, call `setButtonSeat(nextBtnSeat)` directly, then pass `nextBtnSeat` to `startNewHand`. Do NOT rely on React state having updated.
- **Postflop "No Showdown" shortcut:** Saves hand with `result='folded'`, `wouldHave='no_showdown'`, overriding the draft's current values directly in the `handRepo.create()` call (not via state setters which are async).
