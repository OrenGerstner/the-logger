import { useState } from 'react';
import { useNavigation } from '@/navigation/NavigationContext';
import { useHand } from '@/store/HandContext';
import type { Card } from '@/domain/types';
import { ALL_RANKS, ALL_SUITS, cardToString } from '@/domain/handNormalizer';
import { suitSymbol, isRedSuit } from '@/utils/formatting';
import styles from './CardPicker.module.css';

type Mode = 'hole' | 'flop' | 'turn' | 'river';

function getUsedCards(
  draft: ReturnType<typeof useHand>['draft'],
  excludeMode: Mode
): Set<string> {
  if (!draft) return new Set();
  const used = new Set<string>();
  // Exclude hole cards when re-picking them so they're selectable again
  if (excludeMode !== 'hole' && draft.holeCards) {
    used.add(cardToString(draft.holeCards[0]));
    used.add(cardToString(draft.holeCards[1]));
  }
  if (excludeMode !== 'flop' && draft.board.flop) {
    draft.board.flop.forEach((c) => used.add(cardToString(c)));
  }
  if (excludeMode !== 'turn' && draft.board.turn) {
    used.add(cardToString(draft.board.turn));
  }
  if (excludeMode !== 'river' && draft.board.river) {
    used.add(cardToString(draft.board.river));
  }
  return used;
}

const MODE_CONFIG: Record<Mode, { maxCards: number; label: string; backLabel: string }> = {
  hole:  { maxCards: 2, label: 'tap 2 cards',   backLabel: 'Your hand' },
  flop:  { maxCards: 3, label: 'tap 3 cards',   backLabel: 'Flop' },
  turn:  { maxCards: 1, label: 'tap 1 card',    backLabel: 'Turn' },
  river: { maxCards: 1, label: 'tap 1 card',    backLabel: 'River' },
};

export function CardPicker() {
  const { currentScreen, goBack } = useNavigation();
  const { draft, setHoleCards, setBoard } = useHand();

  const mode = (currentScreen.params?.mode as Mode | undefined) ?? 'hole';
  const { maxCards, label, backLabel } = MODE_CONFIG[mode];

  const usedCards = getUsedCards(draft, mode);

  // Pre-populate with existing selection if re-entering
  const existingCards: Card[] = (() => {
    if (!draft) return [];
    if (mode === 'hole') return draft.holeCards ? [...draft.holeCards] : [];
    if (mode === 'flop') return draft.board.flop ? [...draft.board.flop] : [];
    if (mode === 'turn') return draft.board.turn ? [draft.board.turn] : [];
    if (mode === 'river') return draft.board.river ? [draft.board.river] : [];
    return [];
  })();

  const [selected, setSelected] = useState<Card[]>(existingCards);

  function toggle(card: Card) {
    const key = cardToString(card);
    if (usedCards.has(key)) return;
    setSelected((prev) => {
      const idx = prev.findIndex((c) => cardToString(c) === key);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      if (prev.length >= maxCards) {
        // Shift out oldest, append new
        return [...prev.slice(1), card];
      }
      return [...prev, card];
    });
  }

  function handleDone() {
    if (selected.length !== maxCards) return;
    if (mode === 'hole') {
      setHoleCards([selected[0], selected[1]]);
    } else if (mode === 'flop') {
      setBoard({ flop: [selected[0], selected[1], selected[2]] });
    } else if (mode === 'turn') {
      setBoard({ turn: selected[0] });
    } else if (mode === 'river') {
      setBoard({ river: selected[0] });
    }
    goBack();
  }

  const isSelected = (card: Card) =>
    selected.some((c) => cardToString(c) === cardToString(card));

  return (
    <div className="screen">
      <div className="bar">
        <button className={styles.back} onClick={goBack}>← {backLabel}</button>
        <span className="label">{label} · {selected.length}/{maxCards}</span>
      </div>

      <div className={styles.suitHeaders}>
        {ALL_SUITS.map((suit) => (
          <div key={suit} className={`${styles.suitHeader} ${isRedSuit(suit) ? styles.red : ''}`}>
            {suitSymbol(suit)}
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        {ALL_SUITS.map((suit) => (
          <div key={suit} className={styles.col}>
            {ALL_RANKS.map((rank) => {
              const card: Card = { rank, suit };
              const key = cardToString(card);
              const used = usedCards.has(key);
              const sel = isSelected(card);
              return (
                <button
                  key={key}
                  className={[
                    styles.card,
                    sel ? styles.sel : '',
                    used ? styles.used : '',
                    isRedSuit(suit) ? styles.red : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => toggle(card)}
                  disabled={used}
                >
                  {rank}{suitSymbol(suit)}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="note">Hole cards and already-entered board cards are greyed out</div>

      <div className="btn-row">
        <button className="btn" onClick={() => setSelected([])}>Clear</button>
        <button
          className={`btn ${selected.length === maxCards ? 'info' : ''}`}
          onClick={handleDone}
          disabled={selected.length !== maxCards}
        >Done</button>
      </div>
    </div>
  );
}
