// Montos se guardan como dólares con 2 decimales, pero toda la aritmética
// se hace en centavos enteros para evitar errores de coma flotante.
export const toCents = (n: number): number => Math.round((Number(n) || 0) * 100);

export const fromCents = (cents: number): number => cents / 100;

export const roundMoney = (n: number): number => fromCents(toCents(n));

export const addMoney = (a: number, b: number): number => fromCents(toCents(a) + toCents(b));

export const subMoney = (a: number, b: number): number => fromCents(toCents(a) - toCents(b));
