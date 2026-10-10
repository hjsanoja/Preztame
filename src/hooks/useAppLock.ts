import { useCallback, useEffect, useRef, useState } from 'react';
import { checkPin, hashPin, LockSettings, randomSalt, readLock, registerBiometric, saveLock, verifyBiometric } from '../lib/appLock';

// Locks the app on start and after it has been in the background longer than
// the chosen time; unlocks with the PIN or the phone's biometrics.
export function useAppLock() {
  const [settings, setSettings] = useState<LockSettings>(readLock);
  const [locked, setLocked] = useState<boolean>(() => readLock().enabled);
  const hiddenAt = useRef<number | null>(null);

  const update = useCallback((next: LockSettings) => {
    saveLock(next);
    setSettings(next);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      const s = readLock();
      if (!s.enabled) return;
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        if (s.timeoutMin === 0) setLocked(true);
      } else if (hiddenAt.current !== null && Date.now() - hiddenAt.current >= s.timeoutMin * 60_000) {
        setLocked(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const unlockWithPin = useCallback(async (pin: string) => {
    const ok = await checkPin(pin, readLock());
    if (ok) setLocked(false);
    return ok;
  }, []);

  const unlockWithBiometric = useCallback(async () => {
    const s = readLock();
    if (!s.credentialId) return false;
    const ok = await verifyBiometric(s.credentialId);
    if (ok) setLocked(false);
    return ok;
  }, []);

  const setPin = useCallback(async (pin: string) => {
    const salt = randomSalt();
    update({ ...readLock(), enabled: true, salt, pinHash: await hashPin(pin, salt), pinLength: pin.length });
  }, [update]);

  const disable = useCallback(() => {
    update({ ...readLock(), enabled: false, pinHash: '', salt: '', credentialId: '' });
    setLocked(false);
  }, [update]);

  const enableBiometric = useCallback(async (userName: string) => {
    const id = await registerBiometric(userName);
    update({ ...readLock(), credentialId: id });
  }, [update]);

  const disableBiometric = useCallback(() => update({ ...readLock(), credentialId: '' }), [update]);
  const setTimeoutMin = useCallback((m: number) => update({ ...readLock(), timeoutMin: m }), [update]);
  const lockNow = useCallback(() => { if (readLock().enabled) setLocked(true); }, []);

  return { settings, locked, unlockWithPin, unlockWithBiometric, setPin, disable, enableBiometric, disableBiometric, setTimeoutMin, lockNow };
}
