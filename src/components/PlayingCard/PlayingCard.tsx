import type { Card } from '@/domain/types';
import { suitSymbol, isRedSuit } from '@/utils/formatting';
import styles from './PlayingCard.module.css';

interface Props {
  card?: Card;
  size?: 'normal' | 'sm';
  placeholder?: boolean;
  dimmed?: boolean;
}

export function PlayingCard({ card, size = 'normal', placeholder = false, dimmed = false }: Props) {
  const cls = [
    styles.card,
    size === 'sm' ? styles.sm : '',
    placeholder ? styles.placeholder : '',
    dimmed ? styles.dimmed : '',
  ].filter(Boolean).join(' ');

  if (placeholder || !card) {
    return <span className={cls}>+</span>;
  }

  return (
    <span className={cls}>
      <span className={isRedSuit(card.suit) ? styles.red : ''}>
        {card.rank}{suitSymbol(card.suit)}
      </span>
    </span>
  );
}
