export function formatCurrency(amount: number, currency: string): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '+';
  return `${sign}${currency}${abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatNet(amount: number | null, currency: string): string {
  if (amount === null) return '—';
  return formatCurrency(amount, currency);
}

export function formatProfitPerHour(pph: number | null, currency: string): string {
  if (pph === null) return '—';
  return `${formatCurrency(pph, currency)}/hr`;
}

export function formatStack(amount: number | null, currency: string): string {
  if (amount === null) return '—';
  return `${currency}${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export { formatElapsedTime, formatElapsedHours } from '@/domain/sessionTime';

export function suitSymbol(suit: string): string {
  switch (suit) {
    case 's': return '♠';
    case 'h': return '♥';
    case 'd': return '♦';
    case 'c': return '♣';
    default: return suit;
  }
}

export function isRedSuit(suit: string): boolean {
  return suit === 'h' || suit === 'd';
}
