export type Item = { id: string; name: string; quantity: number; unit: string; category: string; location: string };
export type HistoryEntry = { id: string; text: string; time: string };
export type Pantry = { items: Item[]; history: HistoryEntry[] };

// Trim floating-point noise (e.g. 0.14 + 1 = 1.1400000000000001) from stored quantities.
export const roundQuantity = (value: number) => Number(value.toPrecision(15));

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function isItem(value: unknown): value is Item {
  return isRecord(value) && typeof value.id === 'string'
    && ['name', 'unit', 'category', 'location'].every(key => typeof value[key] === 'string')
    && typeof value.quantity === 'number' && Number.isFinite(value.quantity) && value.quantity >= 0;
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  return isRecord(value) && typeof value.id === 'string' && typeof value.text === 'string' && typeof value.time === 'string';
}

// Structural check for data read back from browser storage.
export function isPantry(data: unknown): data is Pantry {
  return isRecord(data) && Array.isArray(data.items) && Array.isArray(data.history)
    && data.items.every(isItem) && data.history.every(isHistoryEntry);
}

type IdSource = Pick<Crypto, 'getRandomValues'> & { randomUUID?: () => string };

// crypto.randomUUID only exists on HTTPS and localhost. Over plain HTTP (e.g. a phone
// on the LAN hitting `vite --host`) build a v4 UUID from getRandomValues instead.
export function createId(source: IdSource): string {
  if (typeof source.randomUUID === 'function') return source.randomUUID();
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type Consumption = { ok: true; amount: number; remaining: number } | { ok: false; error: string };

// Validate a typed consume amount against the stock on hand.
export function checkConsumption(raw: string, item: Pick<Item, 'name' | 'quantity' | 'unit'>): Consumption {
  const text = raw.trim();
  const amount = Number(text);
  if (!text || !Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter a positive amount to consume.' };
  if (amount > item.quantity) return { ok: false, error: `Cannot consume more than ${item.quantity} ${item.unit} of ${item.name}.` };
  return { ok: true, amount, remaining: roundQuantity(item.quantity - amount) };
}
