import { useCallback, useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandaloneDisplay = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;

// iPhone/iPad Safari has no install prompt: the user must use Share > Add to Home Screen.
const isIosDevice = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Service worker registration, "new version" prompt and install prompt.
export function usePwa({ onOfflineReady }: { onOfflineReady?: () => void } = {}) {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(isStandaloneDisplay);
  const updateRef = useRef<((reload?: boolean) => Promise<void>) | null>(null);
  const offlineReadyRef = useRef(onOfflineReady);
  offlineReadyRef.current = onOfflineReady;

  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
    updateRef.current = registerSW({
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => offlineReadyRef.current?.(),
      onRegisteredSW: (_url, registration) => {
        // Look for a new version every hour while the app stays open.
        if (registration) setInterval(() => { registration.update().catch(() => {}); }, 60 * 60 * 1000);
      }
    });
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setIsStandalone(true);
    };
    const media = window.matchMedia?.('(display-mode: standalone)');
    const onDisplayChange = () => setIsStandalone(isStandaloneDisplay());
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    media?.addEventListener?.('change', onDisplayChange);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      media?.removeEventListener?.('change', onDisplayChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installEvent) return false;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    setInstallEvent(null);
    return outcome === 'accepted';
  }, [installEvent]);

  const updateApp = useCallback(() => {
    void updateRef.current?.(true);
  }, []);

  return {
    isStandalone,
    isIos: isIosDevice(),
    canInstall: !!installEvent,
    promptInstall,
    needRefresh,
    updateApp,
    dismissUpdate: () => setNeedRefresh(false)
  };
}
