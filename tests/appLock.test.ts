import { describe, expect, it } from 'vitest';
import { checkPin, DEFAULT_LOCK, hashPin, isValidPin, randomSalt } from '../src/lib/appLock';

describe('app lock PIN', () => {
  it('stores only a salted hash and checks it', async () => {
    const salt = randomSalt();
    const pinHash = await hashPin('2580', salt);
    expect(pinHash).toMatch(/^[0-9a-f]{64}$/);
    expect(pinHash).not.toContain('2580');
    const s = { ...DEFAULT_LOCK, enabled: true, salt, pinHash };
    expect(await checkPin('2580', s)).toBe(true);
    expect(await checkPin('0000', s)).toBe(false);
    expect(await hashPin('2580', randomSalt())).not.toBe(pinHash); // salt changes the hash
  });
  it('accepts 4 to 6 digits', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
  });
});
