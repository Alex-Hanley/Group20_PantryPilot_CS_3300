// AI-generated white-box unit tests (Claude Code). Prompt: "Read src/pantry.ts and write
// Vitest unit tests that exercise every branch, targeting floating-point drift, schema
// permutations that pass JSON.parse but should fail isPantry, and the UUID version/variant
// bits. Use table-driven cases and avoid duplicating src/pantry.test.ts."
import { describe, expect, it } from 'vitest';
import { checkConsumption, createId, isPantry, roundQuantity } from './pantry';

const item = { id: '1', name: 'Salt', quantity: 2, unit: 'kg', category: '', location: 'Pantry' };
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Fake getRandomValues that fills the requested buffer with known bytes.
const fakeBytes = (fill: (bytes: Uint8Array) => void) => ({
  getRandomValues: <T extends ArrayBufferView | null>(array: T): T => { fill(array as unknown as Uint8Array); return array; },
});

describe('roundQuantity drift table', () => {
  it.each([
    [0.1 + 0.2, 0.3],
    [0.36 + 1, 1.36],
    [0.57 + 1, 1.57],
    [1.1 * 3, 3.3],
  ])('normalizes %s to %s', (raw, expected) => {
    expect(roundQuantity(raw)).toBe(expected);
  });

  // Open defect D-4: 2.3 - 2.2 is 0.09999999999999964, and 15 significant digits
  // still keep the tail (0.0999999999999996), so the leftover cannot be consumed as 0.1.
  it.fails('normalizes 2.3 - 2.2 to 0.1 (open defect D-4)', () => {
    expect(roundQuantity(2.3 - 2.2)).toBe(0.1);
  });

  it('keeps 15 significant digits for ordinary large quantities', () => {
    expect(roundQuantity(123456789.123456)).toBe(123456789.123456);
  });
});

describe('checkConsumption edge cases', () => {
  it('lets a drifted remainder be consumed exactly (0.3 - 0.1, then 0.2)', () => {
    const first = checkConsumption('0.1', { name: 'Rice', quantity: 0.3, unit: 'kg' });
    expect(first).toEqual({ ok: true, amount: 0.1, remaining: 0.2 });
    if (!first.ok) throw new Error('unreachable');
    expect(checkConsumption('0.2', { name: 'Rice', quantity: first.remaining, unit: 'kg' }))
      .toEqual({ ok: true, amount: 0.2, remaining: 0 });
  });

  it.each(['-Infinity', 'NaN', '1e400', '-0', '0x', '1,5'])('rejects %j', raw => {
    expect(checkConsumption(raw, item).ok).toBe(false);
  });

  it.each([['1e-3', 0.001], ['.5', 0.5], ['0x1', 1], ['\t1\n', 1]])('accepts %j as %s (JavaScript Number rules)', (raw, amount) => {
    expect(checkConsumption(raw, item)).toMatchObject({ ok: true, amount });
  });

  it('rejects any amount when the item has no stock', () => {
    expect(checkConsumption('0.001', { ...item, quantity: 0 }))
      .toEqual({ ok: false, error: 'Cannot consume more than 0 kg of Salt.' });
  });
});

describe('isPantry schema permutations', () => {
  it.each([
    ['an array instead of an object', []],
    ['a string', '{"items":[]}'],
    ['history as an object', { items: [], history: {} }],
    ['a null item', { items: [null], history: [] }],
    ['a numeric id', { items: [{ ...item, id: 1 }], history: [] }],
    ['a string quantity', { items: [{ ...item, quantity: '2' }], history: [] }],
    ['a NaN quantity', { items: [{ ...item, quantity: NaN }], history: [] }],
    ['an infinite quantity', { items: [{ ...item, quantity: Infinity }], history: [] }],
    ['a null category', { items: [{ ...item, category: null }], history: [] }],
    ['a history entry missing time', { items: [], history: [{ id: 'h', text: 't' }] }],
  ])('rejects %s', (_label, data) => {
    expect(isPantry(data)).toBe(false);
  });

  it('ignores extra fields on valid records', () => {
    expect(isPantry({ items: [{ ...item, extra: true }], history: [], version: 2 })).toBe(true);
  });
});

describe('createId fallback bits', () => {
  it.each([0x00, 0x5a, 0xff])('sets version 4 and the RFC 4122 variant when every byte is %s', byte => {
    const source = fakeBytes(bytes => bytes.fill(byte));
    expect(createId(source)).toMatch(uuidV4);
  });

  it('produces unique ids from real random bytes', () => {
    const source = { getRandomValues: crypto.getRandomValues.bind(crypto) };
    const ids = new Set(Array.from({ length: 1000 }, () => createId(source)));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(id).toMatch(uuidV4);
  });

  it('ignores a randomUUID property that is not a function', () => {
    const source = { ...fakeBytes(() => {}), randomUUID: undefined };
    expect(createId(source)).toBe('00000000-0000-4000-8000-000000000000');
  });
});
