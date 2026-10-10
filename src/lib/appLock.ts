// App lock: a PIN (stored only as a salted SHA-256 hash) and, optionally,
// the phone's fingerprint / Face ID through WebAuthn (platform authenticator).
// It is a privacy screen for this device; the data in Google Sheets is
// protected separately by the access key.

const KEY = 'df_lock';

export interface LockSettings {
  enabled: boolean;
  pinHash: string;
  salt: string;
  credentialId: string; // base64url, empty when biometrics are off
  pinLength: number;
  timeoutMin: number; // lock again after being in the background this long
}

export const DEFAULT_LOCK: LockSettings = { enabled: false, pinHash: '', salt: '', credentialId: '', pinLength: 4, timeoutMin: 1 };

export function readLock(): LockSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_LOCK, ...JSON.parse(raw) } : DEFAULT_LOCK;
  } catch {
    return DEFAULT_LOCK;
  }
}

export function saveLock(s: LockSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');

export const randomSalt = () => toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);

export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  return toHex(await crypto.subtle.digest('SHA-256', data));
}

export async function checkPin(pin: string, s: LockSettings): Promise<boolean> {
  return !!s.pinHash && (await hashPin(pin, s.salt)) === s.pinHash;
}

export const isValidPin = (pin: string) => /^\d{4,6}$/.test(pin);

// ---------------- Biometrics (WebAuthn) ----------------

const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

export async function biometricAvailable(): Promise<boolean> {
  try {
    const PKC: any = (window as any).PublicKeyCredential;
    return !!PKC && (await PKC.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

// Creates a key in the phone's secure hardware that only unlocks with the
// user's fingerprint / face. Returns its id.
export async function registerBiometric(userName: string): Promise<string> {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Preztame' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: userName || 'Preztame', displayName: userName || 'Preztame' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
      attestation: 'none'
    }
  }) as PublicKeyCredential | null;
  if (!cred) throw new Error('cancelled');
  return b64url(cred.rawId);
}

export async function verifyBiometric(credentialId: string): Promise<boolean> {
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: fromB64url(credentialId) }],
        userVerification: 'required',
        timeout: 60000
      }
    });
    return !!res;
  } catch {
    return false;
  }
}
