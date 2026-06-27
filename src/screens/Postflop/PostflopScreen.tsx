import { useState } from 'react';
import { useNavigation } from '@/navigation/NavigationContext';
import { useHand } from '@/store/HandContext';
import { useSession } from '@/store/SessionContext';
import { useSettings } from '@/store/settingsStore';
import { useTableState } from '@/store/tableStateStore';
import { handRepo } from '@/db/handRepo';
import { getHeroPosition } from '@/domain/positions';
import { PlayingCard } from '@/components/PlayingCard/PlayingCard';
import type { HeroAction } from '@/domain/types';
import styles from './PostflopScreen.module.css';

type Street = 'flop' | 'turn' | 'river';

interface Props {
  street: Street;
}

export function PostflopScreen({ street }: Props) {
  const { navigate } = useNavigation();
  const { draft, setPostflopAction, startNewHand, toHand } = useHand();
  const { activeSession } = useSession();
  const { settings } = useSettings();
  const { tableState, setButtonSeat } = useTableState();
  const [cardsHidden, setCardsHidden] = useState(settings.hideHoleCardsPostflop);
  const [note, setNote] = useState(draft?.note ?? '');

  if (!draft) return null;

  const streetTitle = street === 'flop' ? 'Flop' : street === 'turn' ? 'Turn' : 'River';
  const posLabel = `${draft.heroPosition} · ${draft.preflop.heroAction?.toLowerCase() ?? 'no action'}`;

  // Hero folded at the current or any previous street
  const heroFolded =
    draft.preflop.heroAction === 'Fold' ||
    draft.postflop.flop === 'Fold' ||
    draft.postflop.turn === 'Fold' ||
    draft.postflop.river === 'Fold';

  function handleAction(action: HeroAction) {
    setPostflopAction(street, action);
  }

  function handleNext() {
    if (street === 'flop') navigate({ name: 'postflop', params: { street: 'turn' } });
    else if (street === 'turn') navigate({ name: 'postflop', params: { street: 'river' } });
    else navigate({ name: 'handResult' });
  }

  function computeNextHand() {
    const { occupiedSeats, buttonSeat, heroSeat } = tableState;
    const sorted = [...occupiedSeats].sort((a, b) => a - b);
    const nextBtnSeat = sorted[(sorted.indexOf(buttonSeat) + 1) % sorted.length];
    const nextPos = getHeroPosition(occupiedSeats, nextBtnSeat, heroSeat);
    return { nextBtnSeat, nextPos, occupiedSeats, heroSeat };
  }

  async function handleLogNewHand() {
    const hand = toHand();
    if (hand) await handRepo.create({ ...hand, note });

    const { nextBtnSeat, nextPos, occupiedSeats, heroSeat } = computeNextHand();
    setButtonSeat(nextBtnSeat);
    if (nextPos && activeSession) {
      startNewHand({
        sessionId: activeSession.id,
        handNumber: draft!.handNumber + 1,
        occupiedSeats,
        buttonSeat: nextBtnSeat,
        heroSeat,
        heroPosition: nextPos,
      });
    }
    navigate({ name: 'play' });
  }

  async function handleNoShowdown() {
    const hand = toHand();
    if (hand) {
      await handRepo.create({
        ...hand,
        note,
        result: 'folded',
        wouldHave: 'no_showdown',
      });
    }

    const { nextBtnSeat, nextPos, occupiedSeats, heroSeat } = computeNextHand();
    setButtonSeat(nextBtnSeat);
    if (nextPos && activeSession) {
      startNewHand({
        sessionId: activeSession.id,
        handNumber: draft!.handNumber + 1,
        occupiedSeats,
        buttonSeat: nextBtnSeat,
        heroSeat,
        heroPosition: nextPos,
      });
    }
    navigate({ name: 'play' });
  }

  function handlePickBoardCards() {
    navigate({ name: 'cardPicker', params: { mode: street } });
  }

  const nextLabel =
    street === 'flop' ? 'Next: turn →' : street === 'turn' ? 'Next: river →' : 'Hand result →';

  const currentAction = draft.postflop[street];
  const flopCards = draft.board.flop;
  const turnCard = draft.board.turn;
  const riverCard = draft.board.river;

  return (
    <div className="screen">
      <div className="bar">
        <span>{streetTitle}</span>
        <span className="label">{posLabel}</span>
      </div>

      <button
        className={styles.hiddenCards}
        onClick={() => setCardsHidden(!cardsHidden)}
      >
        {cardsHidden ? (
          <>🔒 Your hand hidden · tap to peek</>
        ) : (
          <>
            {draft.holeCards?.map((c, i) => (
              <PlayingCard key={i} card={c} />
            ))}
            <span style={{ fontSize: 11, color: 'var(--t3)', marginLeft: 4 }}>· tap to hide</span>
          </>
        )}
      </button>

      <div className="label">Board <span className="note">tap cards to enter</span></div>
      <div className={styles.boardCards}>
        {street === 'flop' && (
          flopCards ? (
            flopCards.map((c, i) => (
              <button key={i} className={styles.boardCardBtn} onClick={handlePickBoardCards}>
                <PlayingCard card={c} />
              </button>
            ))
          ) : (
            <button className={styles.boardCardBtn} onClick={handlePickBoardCards}>
              <PlayingCard placeholder />
              <PlayingCard placeholder />
              <PlayingCard placeholder />
            </button>
          )
        )}
        {(street === 'turn' || street === 'river') && flopCards && (
          flopCards.map((c, i) => <PlayingCard key={i} card={c} />)
        )}
        {(street === 'turn' || street === 'river') && (
          turnCard ? (
            <button className={styles.boardCardBtn} onClick={() => navigate({ name: 'cardPicker', params: { mode: 'turn' } })}>
              <PlayingCard card={turnCard} />
            </button>
          ) : street === 'turn' ? (
            <button className={styles.boardCardBtn} onClick={handlePickBoardCards}>
              <PlayingCard placeholder />
            </button>
          ) : null
        )}
        {street === 'river' && (
          riverCard ? (
            <button className={styles.boardCardBtn} onClick={() => navigate({ name: 'cardPicker', params: { mode: 'river' } })}>
              <PlayingCard card={riverCard} />
            </button>
          ) : (
            <button className={styles.boardCardBtn} onClick={handlePickBoardCards}>
              <PlayingCard placeholder />
            </button>
          )
        )}
      </div>

      <div className="label">Your action</div>
      <div className="btn-row">
        {(['Fold', 'Call', 'Raise'] as HeroAction[]).map((a) => (
          <button
            key={a}
            className={`btn ${currentAction === a ? 'info' : ''}`}
            onClick={() => handleAction(a)}
          >
            {a}
          </button>
        ))}
      </div>

      {heroFolded && (
        <button className={styles.noShowdownBtn} onClick={handleNoShowdown}>
          × No Showdown — save &amp; new hand
        </button>
      )}

      <input
        className="field"
        placeholder="Note to self…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="btn-row" style={{ marginTop: 'auto' }}>
        <button className="btn" onClick={handleLogNewHand}>Log new hand</button>
        {!heroFolded && (
          <button className="btn info" onClick={handleNext}>{nextLabel}</button>
        )}
        {heroFolded && (
          <button className="btn info" onClick={() => navigate({ name: 'handResult' })}>Review hand →</button>
        )}
      </div>
    </div>
  );
}
