const KEY = 'logger-anthropic-key';

export function getAnthropicKey(): string {
  return localStorage.getItem(KEY) ?? '';
}

export function setAnthropicKey(key: string): void {
  if (key.trim()) {
    localStorage.setItem(KEY, key.trim());
  } else {
    localStorage.removeItem(KEY);
  }
}
