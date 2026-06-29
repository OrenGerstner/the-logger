# The Logger — Preflop Hand Tracker

**A mobile PWA for logging poker hands live at the table, checking preflop play against charts, and tracking tournament strategy with push/fold recommendations.**

Companion file: `thelogger-mockups.html` (open in a browser to see all screens).
Repository: `https://github.com/OrenGerstner/the-logger`
Target deployment: `https://the-logger.playthetab.com` (Vercel)

---

## 1. Goal & context

The user is a live poker player who wants to verify, hand by hand, that he is making the correct preflop decision (fold / call / raise) for his cards, position, and the action in front of him. The app lets him log each hand quickly and discreetly at the table, compares his preflop action to a known set of preflop charts, flags deviations, and exports everything to CSV for later review.

**Supported game types: cash games and tournaments.** Cash sessions use the preflop chart engine (9-handed, 100bb PokerCoaching charts). Tournament sessions use push/fold Nash equilibrium charts when effective stack is <20bb and the same cash charts when ≥20bb.

Primary success criterion: after a session, the player can see which hands he misplayed preflop versus the charts, understand session profitability or tournament result, and export a clean CSV.

Multiple sessions in the same day at the same venue are fully supported — each session is an independent DB entry.

---

## 2. Platform & architecture

- **Type:** Progressive Web App (PWA), installable to the phone home screen, runs full-screen, works fully offline.
- **Stack:** React + TypeScript + Vite. Service worker for offline caching. No backend, no server, no accounts.
- **Storage:** All data on-device.
  - Hands and sessions: **IndexedDB** (use Dexie.js).
  - Settings and persistent table state: `localStorage`.
  - Active hand draft: `localStorage` (persists across phone lock/unlock).
  - Tournament structure templates: `localStorage`.
  - Anthropic API key (optional): `localStorage`, separate key, never sent to any app server.
- **Hosting:** Vercel, served at `the-logger.playthetab.com`. Build output is static assets only.
- **No backup / sync.** Data lives only on the device. CSV export is the manual safety valve. (Note in settings that clearing site data deletes everything.)
- **Orientation:** Portrait (vertical) only. Lock to portrait.
- **Cost:** Entirely free — all libraries open-source. Optional AI photo parsing uses the user's own Anthropic API key billed to their account.

### Architecture layers

1. **UI (React components)** — screens listed in §9.
2. **Domain logic (pure, unit-tested functions)** — position engine, hand normalizer, scenario resolver, chart lookup, deviation checker, push/fold lookup, tournament structure helpers. No I/O; fully testable.
3. **Data** — preflop charts (`charts.json`) and push/fold tables (`pushfold.json`) bundled as static JSON.
4. **Persistence** — Dexie repository for sessions/hands/stackSnapshots; localStorage for settings, table state, active hand draft, tournament templates, and API key; CSV exporter.

---

## 3. Core domain model

### Entities

**Session**
| field | type | notes |
|---|---|---|
| id | string (uuid) | |
| createdAt | ISO datetime | |
| gameType | `"cash" \| "tournament"` | |
| venue | string (optional) | |
| stakes | `{ smallBlind, bigBlind }` | level 1 blinds for tournaments |
| currency | string | default from settings |
| startingTableSize | `6 \| 8 \| 9` | |
| buyIns | `Array<{ amount, at }>` | supports rebuys / add-ons |
| startingStack | number \| null | chips for tournament |
| cashOut | number \| null | set on session end; for tournaments = prizeWon |
| status | `"active" \| "ended"` | |
| endedAt | ISO datetime \| null | |
| timerStartedAt | ISO datetime | |
| timerPausedAt | ISO datetime \| null | |
| timerPauses | `Array<{ startedAt, endedAt }>` | |
| target | `SessionTarget \| null` | cash only |
| structure | `TournamentStructure \| null` | tournament only |
| currentLevel | number \| null | tournament: current blind level |
| icmPressure | `IcmPressure \| null` | tournament: chipEV / nearBubble / finalTable |
| addOns | `AddOn[]` | tournament add-ons |
| fieldSize | number \| null | tournament field size |
| finishPlace | number \| null | tournament finish position |
| prizeWon | number \| null | tournament prize (0 if busted) |
| itm | boolean | tournament: in the money |
| _elapsedSeconds_ (derived) | number | wall-clock seconds minus pauses |
| _net_ (derived) | number | `cashOut - sum(buyIns)` |
| _profitPerHour_ (derived) | number \| null | cash only |

**SessionTarget**
```ts
{ type: 'multiplier'; multiplier: 2 | 3 | 4 | 5 }
{ type: 'amount'; amount: number }
```

**Hand**
| field | type | notes |
|---|---|---|
| id | string (uuid) | |
| sessionId | string | |
| handNumber | number | |
| timestamp | ISO datetime | |
| tableSize | number | |
| shortHanded | boolean | `tableSize < 9` |
| buttonSeat | number | |
| heroSeat | number | |
| heroPosition | position label | |
| holeCards | `[Card, Card]` | |
| handKey | string | normalized 169-key |
| preflop | Preflop (below) | |
| board | `{ flop?, turn?, river? }` | |
| postflop | `{ flop?, turn?, river? }` | |
| result | `"won" \| "lost" \| "folded" \| null` | |
| wouldHave | `"won" \| "lost" \| "no_showdown" \| null` | |
| amount | number \| null | |
| amountSource | `"manual" \| "stack_snapshot" \| "unentered"` | |
| stackBefore | number \| null | chips for tournament |
| stackAfter | number \| null | |
| stackAttributionConfidence | `"exact" \| "likely" \| "ambiguous" \| null` | |
| note | string | |
| level | number \| null | tournament: blind level at hand time |
| effBB | number \| null | tournament: effective BB at hand time |
| regime | `"cash" \| "pushfold" \| "offchart" \| null` | tournament |
| pushFoldRec | `"Shove" \| "Call" \| "Fold" \| null` | tournament: computed at save time |
| icmPressureAtHand | `IcmPressure \| null` | tournament |

**Preflop** (embedded in Hand)
| field | type | notes |
|---|---|---|
| scenario | `"RFI" \| "FacingRFI" \| "RFIvs3Bet" \| "OffChart"` | |
| facingPosition | position \| null | |
| chartRecommendation | string \| null | |
| heroAction | `"Fold" \| "Call" \| "Raise"` | |
| heroSecondAction | `"Fold" \| "Call" \| "Raise" \| null` | |
| opponentActions | `Array<{ seat, position, action }>` | |
| deviation | boolean | |

**TournamentStructure**
```ts
{
  name: string;
  venue?: string;
  gameType?: string;
  buyIn?: number;
  startingChips?: number;
  anteType?: string;
  rows: TournamentStructureRow[];
}
type TournamentStructureRow =
  | { kind: 'level'; level: number; sb: number; bb: number; ante: number; minutes?: number }
  | { kind: 'break' | 'chiprace' | 'chipremoval'; label?: string; minutes?: number }
```

**IcmPressure** = `'chipEV' | 'nearBubble' | 'finalTable'`

**TableState**, **StackSnapshot**, **Settings** — unchanged from cash design.

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
When `tableSize < 9`, the app uses that position's 9-max chart and sets `shortHanded = true`, showing a warning.

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

Charts come from `preflop-charts.pdf` (PokerCoaching, 9-handed, 100bb). Bundled as `charts.json`. Do not hand-transcribe. Re-run `extract_charts.py` only if source PDF changes.

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
- Tapping the recommendation badge disables it.
- Off-chart spots show no recommendation.
- **Tournament T0 rule:** In tournament mode, no recommendation is shown at any point during a live hand. Recommendations are revealed post-hand only on the Hand Result screen.

### Deviation check
Collapse to families for comparison:
- **Raise family:** `Raise`, `Raise for Value`, `Raise as a Bluff`, `3-Bet for Value`, `3-Bet as a Bluff`, `4-Bet for Value`, `4-Bet as a Bluff`.
- **Call family:** `Call`, `Limp`.
- **Fold family:** `Fold`.

`deviation = true` when player's action family ≠ chart action family.

For push/fold hands in tournaments: `deviation = true` when heroAction ≠ recommended action (Shove/Call/Fold).

---

## 7A. Tournament push/fold engine

### Stack routing
- `effBB = chips / currentBigBlind` (from latest stack snapshot)
- `effBB ≥ 20` → use cash preflop charts (same as cash session)
- `effBB < 20` → use push/fold tables
- `regime` label shown in play screen: `Charts` or `Push/fold`

### Push/fold tables (`pushfold.json`)
Bundled static JSON. Nash equilibrium chip-EV baseline, validated against Primedope. Four ranges:
- `push.SB` — SB open-shove, no ante
- `push.SB_bbAnte` — SB open-shove, big-blind-ante format
- `call.BB_vs_SB` — BB call vs SB shove, no ante
- `call.BB_vs_SB_bbAnte` — BB call vs SB shove, big-blind-ante

Each range has exactly 169 hand keys (enforced by test suite). Values are max-BB thresholds: `rec = effBB ≤ threshold × icmFactor ? 'Shove'/'Call' : 'Fold'`.

**Off-chart positions:** Only SB open-shove (RFI) and BB-vs-SB call (FacingRFI from SB) are covered. All other positions return `regime = 'offchart'` — hand is logged but no recommendation is generated.

### ICM pressure (Level 1)
Manual toggle on the play screen. Tightens all thresholds multiplicatively:

| Mode | Push factor | Call factor |
|---|---|---|
| Chip-EV (default) | ×1.00 | ×1.00 |
| Near bubble | ×0.85 | ×0.90 |
| Final table | ×0.72 | ×0.72 |

### T0 compliance
In tournament mode: zero recommendations shown during a live hand on the play screen. The push/fold recommendation (or cash chart rec for deep stacks) is revealed only after the hand is saved, on the Hand Result screen.

---

## 8. Hand lifecycle

### Standard flow (preflop focus mode OFF)
`preflop → [optional 3-bet decision] → flop → turn → river → hand result`

### Preflop focus mode (default ON)
After hero selects Fold / Call / Raise preflop, skip postflop screens and go directly to hand result.

### Postflop flow (preflop focus OFF)
- Each street captures board cards + hero action (Fold/Call/Raise).
- If hero folds at any postflop street, a **"× No Showdown — save & new hand"** quick-save button appears.
- Board cards are entered via the card picker.

### wouldHave outcomes (when hero folds)
- **Would Win** — hero would have won the pot
- **Would Lose** — hero would have lost
- **No Showdown** — hand didn't reach showdown

### Tournament hand context
When starting a hand in a tournament session, the `TournamentHandContext` is synced into the hand draft by a `useEffect` in the play screen. It captures: `level`, `effBB`, `icmPressure`, `regime`. The `pushFoldRec` is computed at save time in HandResult (not stored in draft), ensuring T0 compliance.

### "Log new hand" and "Save & log new hand"
Saves current hand, advances button seat, starts fresh hand draft, navigates to play screen.

### Draft persistence
Active hand draft is persisted to `localStorage` so phone lock/unlock does not reset it.

---

## 8A. Session stopwatch, stack updates, and hourly profit

### Session stopwatch
- Starts automatically when session starts.
- Shown as `HH:MM` in the session header.
- Optional pause/resume for breaks.

### Stack tracking
1. **Manual hand amount** on the Hand Result screen.
2. **Quick stack update** from the play screen header. (Label shows "Chips" for tournament sessions.)

### Session target & progress bar (cash only)
If a session target is set, the play screen shows a compact progress bar tracking current stack vs target.

### Reporting
- Net = `cashOut - totalBuyIns` (ended); `latestStack - totalBuyIns` (active)
- $/hr = `net / elapsedHours` (cash sessions)

---

## 9. Screens & interactions

All screens portrait-only.

1. **Home** — active session card (hands, elapsed time, stack/chips); Continue session / Hand history / Edit table / All sessions / End session. No active session → New session / All sessions. **Tap "The Logger" logo** to open a version modal showing the build number (`YY.MM.DD.XX` format) and copyright.

2. **New session** — game type selector (Cash / Tournament).
   - **Cash tab:** venue, stakes (presets + custom), table size, buy-in, session target.
   - **Tournament tab:** venue, blind structure (Import/select → StructureEditor), starting chips, buy-in, table size. Start → Table Setup.

3. **Tournament structure editor (StructureEditor)** — accessed from the tournament tab.
   - Saved templates list at top (tap to use, ✕ to delete).
   - **Upload PDF** → pdfjs-dist extracts text from digital PDFs → heuristic parser reconstructs level rows.
   - **Use photo** → AI vision via direct browser call to Anthropic API using user's own key; requires key in Settings.
   - Editable level table: columns Level / SB / BB / Ante / Min; each cell editable; + Add level; ✕ to remove row.
   - Always falls back to manual entry; auto-parse just pre-fills the table.
   - "Use this structure" → sets pending structure → returns to NewSession. "Save as template" → localStorage.

4. **Table setup / edit mode** — poker table ring with seat numbers; tap a seat to assign me/sitting/empty.

5. **Play screen (main)** — session header (elapsed, stack, net/$/hr); optional target progress bar (cash only); hand/table info bar; 9-seat oval; hole card display; recommendation badge (hidden during tournament hands — T0); Fold/Call/Raise buttons; Log new hand; Go to flop.
   - **Tournament: TournamentInfoRow** — level stepper (− / +), blind readout, effBB, regime label (`Push/fold` or `Charts`); ICM pressure toggle (Chip-EV / Bubble / FT).
   - **Tournament: posInfo** — shows `· {effBB} BB · Push/fold` or `· Charts` after position.
   - **Tournament T0:** hint "Chart shown after hand (tournament rules)" replaces recommendation area.

6. **Card picker** — 52 cards in four suit columns.

7. **Postflop screens** — board card entry, hero's hole cards, Fold/Call/Raise, No Showdown quick-save.

8. **Hand result** — deviation banner; Won/Lost or Would Win/Would Lose/No Showdown; amount (labeled "Chips" for tournament); current stack entry; note; Save & log new hand.
   - **Tournament post-hand reveal section:** push/fold rec (or cash rec for deep stacks) shown here after saving. Includes deviation flag and ✓ if correct. Shows "Off-chart position (log only)" when regime = offchart.

9. **Hand history** — session summary strip; scrollable hand list.

10. **All sessions (Past Sessions)** — list ordered newest first; tap to open; trash to delete; active session marked.

11. **Session detail** — date/venue header; stats; street breakdown table; results section.
    - **Cash:** P/L, earn rate, buy-in, cash-out.
    - **Tournament:** net, buy-in(s), finish place, prize won, ITM. Shows structure name in header.

12. **Settings** — see §10.

### Seat interactions
- **Two modes:** Play mode — tap seat to log opponent action. Edit mode — tap seat to change occupancy.
- **Opponent action popover** — seat number + Raise/Call/Fold + X.
- **Auto-named raise levels:** first raise = open, next = 3-bet, next = 4-bet.

---

## 10. Settings

- **Theme:** Dark (default) / Light.
- **Preflop focus mode (default ON).**
- **Focus on RFI only (default ON).**
- **Show recommendation:** Before I act (default) / After I act.
- **Show chart after I fold** (preflop only, default on).
- **Hide hole cards postflop** (default on).
- **Flag chart deviations** (default on).
- **Currency** (default $).
- **Default table size:** 6 / 8 / 9 (default 9).
- **Pause timer during breaks** (default on).
- **Export all data (CSV).**
- **Anthropic API key** (optional) — stored only in `localStorage` on this device. Required for AI photo import in StructureEditor. Key is masked in the UI; user can remove it at any time. Calls go directly from browser to `api.anthropic.com` with `anthropic-dangerous-direct-browser-access: true` — no proxy, no server involvement.

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
result, would_have, amount, amount_source, stack_attribution_confidence, note, opponent_actions,
tournament_level, effective_bb, regime, push_fold_rec, icm_pressure,
session_finish_place, session_prize_won, session_itm, session_field_size
```

Tournament columns are blank for cash sessions.

Separate optional export for stack snapshots:
```
session_id, snapshot_id, created_at, hand_number_context, stack_amount,
previous_stack_amount, delta_from_previous, source, candidate_hand_ids,
assigned_hand_id, attribution_confidence, note
```

---

## 12. Out of scope

- 6-max-specific charts.
- Cloud sync, accounts, backup/restore.
- Postflop strategy/recommendations.
- Multiway and limped-pot preflop recommendations (logged as off-chart).
- Check/Bet as distinct postflop actions (postflop is Fold/Call/Raise).
- Heads-up (2-handed) position derivation.
- ICM Level 2+ (full ICM calculation from chip counts and pay table) — current implementation is Level 1 (manual toggle only).
- Tournament push/fold coverage beyond SB open-shove and BB-vs-SB call (all other positions are off-chart).

---

## 13. Build versioning

Version format: `YY.MM.DD.XX`
- `YY` — 2-digit year of build
- `MM` — 2-digit month
- `DD` — 2-digit day
- `XX` — build number for that day (starts at 01, auto-increments on each `npm run build`)

Counter is stored in `.build-counter.json` at project root (gitignored). Version is injected at build time as `__APP_VERSION__` via Vite's `define`. Dev server reads without incrementing. Visible by tapping "The Logger" on the Home screen.

---

## 14. Implementation notes

- **Framework:** Vite + React + TypeScript + Dexie.js + Radix UI (Dialog) + pdfjs-dist (lazy-loaded for PDF parsing).
- **Navigation:** State-based (no React Router). `NavigationContext` maintains a screen stack. `navigate()` pushes; `goBack()` pops. Each screen unmounts when not on top.
- **Hand draft:** `HandContext` (React Context, global). Draft is persisted to `localStorage` via `useEffect`.
- **Table state:** `useTableState` is a local `useState` hook (not global context). Always compute `nextBtnSeat` synchronously before any state updates.
- **Chart data:** `charts.json` at repo root. `@charts` Vite alias + TypeScript path alias.
- **Push/fold data:** `pushfold.json` at repo root. `@pushfold` Vite alias. Separate alias entry required in both `vite.config.ts` and `vitest.config.ts`.
- **Button advancement:** After saving a hand, compute next button seat from sorted occupied seats, call `setButtonSeat(nextBtnSeat)` directly, then pass to `startNewHand`. Do NOT rely on React state having updated.
- **Cross-screen data (StructureEditor → NewSession):** Screens unmount when not on top. `pendingStructure.ts` holds the selected structure in a module-level variable. NewSession picks it up in a `useEffect` on mount (not in the render body to avoid React Strict Mode side-effect issues).
- **Tournament context sync:** PlayScreen `useEffect` watches `currentLevel`, `icmPressure`, `latestSnapshot.stackAmount`, and `draft.id`. Calls `setTournamentContext()` to keep HandDraft current. Push/fold rec is computed at HandResult save time (not during the hand) for T0 compliance.
- **AI structure parsing:** Direct `fetch` to `https://api.anthropic.com/v1/messages` with `anthropic-dangerous-direct-browser-access: true` header. No SDK bundle. User's API key never leaves their device. PDF parsing uses `pdfjs-dist` with CDN worker URL (acceptable since user has network when uploading a file).
- **Tests:** Vitest. 127 tests total including 10 push/fold integrity tests (169-key checksum per range, known-value assertions, ICM tightening verification).
