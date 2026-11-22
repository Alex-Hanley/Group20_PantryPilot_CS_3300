// Traditional white-box unit tests: one case per equivalence class and boundary
// of each function in pantry.ts, derived from its branches.
import { describe, expect, it } from 'vitest';
import { checkConsumption, createId, isPantry, roundQuantity } from './pantry';

const rice = { name: 'Rice', quantity: 2.5, unit: 'kg' };
const item = { id: '1', name: 'Salt', quantity: 2, unit: 'kg', category: '', location: 'Pantry' };
const entry = { id: 'h1', text: 'Added Salt: 2 kg', time: '2026-11-22T12:00:00.000Z' };

// Fake getRandomValues that fills the requested buffer with known bytes.
const fakeBytes = (fill: (bytes: Uint8Array) => void) => ({
  getRandomValues: <T extends ArrayBufferView | null>(array: T): T => { fill(array as unknown as Uint8Array); return array; },
});

describe('roundQuantity', () => {
  it('removes binary floating-point tails', () => {
    expect(0.14 + 1).not.toBe(1.14);
    expect(roundQuantity(0.14 + 1)).toBe(1.14);
    expect(roundQuantity(0.3 - 0.1)).toBe(0.2);
  });

  it('leaves exact values unchanged', () => {
    expect(roundQuantity(2)).toBe(2);
    expect(roundQuantity(0)).toBe(0);
  });
});

describe('checkConsumption', () => {
  it('accepts a valid amount and returns the remainder', () => {
    expect(checkConsumption('0.5', rice)).toEqual({ ok: true, amount: 0.5, remaining: 2 });
  });

  it('accepts the exact amount in stock (upper boundary)', () => {
    expect(checkConsumption('2.5', rice)).toEqual({ ok: true, amount: 2.5, remaining: 0 });
  });

  it('rejects an amount just above stock', () => {
    expect(checkConsumption('2.51', rice)).toEqual({ ok: false, error: 'Cannot consume more than 2.5 kg of Rice.' });
  });

  it.each(['', '   ', 'abc', 'Infinity', '0', '-1'])('rejects %j as not a positive amount', raw => {
    expect(checkConsumption(raw, rice)).toEqual({ ok: false, error: 'Enter a positive amount to consume.' });
  });

  it('trims surrounding spaces from a valid amount', () => {
    expect(checkConsumption(' 1 ', rice)).toEqual({ ok: true, amount: 1, remaining: 1.5 });
  });
});

describe('isPantry', () => {
  it('accepts an empty pantry and a valid pantry', () => {
    expect(isPantry({ items: [], history: [] })).toBe(true);
    expect(isPantry({ items: [item], history: [entry] })).toBe(true);
  });

  it('accepts a zero quantity (lower boundary)', () => {
    expect(isPantry({ items: [{ ...item, quantity: 0 }], history: [] })).toBe(true);
  });

  it('rejects a negative quantity', () => {
    expect(isPantry({ items: [{ ...item, quantity: -0.01 }], history: [] })).toBe(false);
  });

  it('rejects non-object data and missing arrays', () => {
    expect(isPantry(null)).toBe(false);
    expect(isPantry(5)).toBe(false);
    expect(isPantry({ items: [] })).toBe(false);
    expect(isPantry({ items: {}, history: [] })).toBe(false);
  });

  it('rejects an item with a missing text field', () => {
    const { unit: _unit, ...noUnit } = item;
    expect(isPantry({ items: [noUnit], history: [] })).toBe(false);
  });

  it('rejects a malformed history entry', () => {
    expect(isPantry({ items: [], history: [{ ...entry, id: 1 }] })).toBe(false);
  });
});

describe('createId', () => {
  it('uses randomUUID when it is available', () => {
    const source = { ...fakeBytes(() => {}), randomUUID: () => 'fixed-id' };
    expect(createId(source)).toBe('fixed-id');
  });

  it('builds a v4 UUID from getRandomValues when randomUUID is missing', () => {
    const source = fakeBytes(bytes => bytes.fill(0xff));
    expect(createId(source)).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });
});
