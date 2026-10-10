import { describe, expect, it } from 'vitest';
import { waNumber, whatsappUrl } from '../src/lib/phone';

describe('WhatsApp numbers', () => {
  it('adds the Venezuelan code to local numbers', () => {
    expect(waNumber('0414-123 4567')).toBe('584141234567');
    expect(waNumber('414 1234567')).toBe('584141234567');
  });
  it('keeps international numbers', () => {
    expect(waNumber('+58 412 7654321')).toBe('584127654321');
    expect(waNumber('0034 600 111 222')).toBe('34600111222');
    expect(waNumber('+1 (305) 555-0101')).toBe('13055550101');
  });
  it('rejects numbers too short to be real', () => {
    expect(waNumber('123')).toBe('');
    expect(whatsappUrl('', 'hola')).toBe('');
  });
  it('builds the link with the message', () => {
    expect(whatsappUrl('04141234567', 'Hola Ana')).toBe('https://wa.me/584141234567?text=Hola%20Ana');
  });
});
