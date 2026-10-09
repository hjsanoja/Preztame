import { describe, expect, it } from 'vitest';
import { ageInDays, dueDateOf, getDueStatus } from '../src/lib/dueStatus';
import { normalizeTag, tagOptions, tagSlot } from '../src/lib/tags';

const today = new Date(2026, 9, 9); // 9 Oct 2026
const pending = (mesPago: string) => ({ estado: 'pendiente' as const, saldo: 10, mesPago });

describe('getDueStatus', () => {
  it('uses the last day of the payment month', () => {
    expect(dueDateOf('2026-02')?.getDate()).toBe(28);
    expect(dueDateOf('2026-10')?.getDate()).toBe(31);
  });
  it('classifies overdue, soon, this month and future', () => {
    expect(getDueStatus(pending('2026-09'), today)).toMatchObject({ kind: 'vencido', label: 'Vencido hace 9 días' });
    expect(getDueStatus(pending('2026-10'), today)).toMatchObject({ kind: 'mes', days: 22 });
    expect(getDueStatus(pending('2026-10'), new Date(2026, 9, 30))).toMatchObject({ kind: 'pronto', label: 'Vence en 1 día' });
    expect(getDueStatus(pending('2026-10'), new Date(2026, 9, 31))).toMatchObject({ kind: 'hoy' });
    expect(getDueStatus(pending('2026-12'), today)).toMatchObject({ kind: 'futuro', label: 'Para Dic 2026' });
  });
  it('settled and missing month', () => {
    expect(getDueStatus({ estado: 'saldado', saldo: 0, mesPago: '2026-01' }, today).kind).toBe('saldado');
    expect(getDueStatus(pending(''), today).kind).toBe('sin-fecha');
  });
  it('computes age in days', () => {
    expect(ageInDays('2026-10-01', today)).toBe(8);
    expect(ageInDays('', today)).toBe(0);
  });
});

describe('tags', () => {
  it('normalizes and keeps stable colors', () => {
    expect(normalizeTag('  Familia  ')).toBe('familia');
    expect(tagSlot('Favor')).toBe(1);
    expect(tagSlot('negocio')).toBe(2);
    expect(tagSlot('viaje')).toBe(tagSlot(' VIAJE '));
  });
  it('lists used tags first by frequency', () => {
    expect(tagOptions(['negocio', 'viaje', 'negocio']).slice(0, 3)).toEqual(['negocio', 'viaje', 'favor']);
  });
});
