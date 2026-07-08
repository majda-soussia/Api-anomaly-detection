import { useCallback, useEffect, useState } from 'react';
export function useOneSignal() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];

    const initCheck = setTimeout(() => {
      if (!ready) {
        console.warn(
          '[OneSignal] Le SDK ne s’est pas initialisé après 5s. ' +
          'Vérifie dans index.html : (1) le <script src="https://cdn.onesignal.com/sdks/OneSignalSDK.page.js">, ' +
          '(2) l’appel OneSignal.init({ appId }) avec un appId valide, ' +
          '(3) qu’aucune extension/adblocker ne bloque cdn.onesignal.com.'
        );
      }
    }, 5000);

    window.OneSignalDeferred.push(async (OneSignal) => {
      clearTimeout(initCheck);
      // Initial state
      setIsSubscribed(Boolean(OneSignal.User?.PushSubscription?.optedIn));
      setPermission(OneSignal.Notifications.permission ? 'granted' : Notification.permission);
      setReady(true);

      // Keep state in sync if the user changes permission from the browser UI
      const onChange = (event) => setIsSubscribed(Boolean(event.current.optedIn));
      OneSignal.User.PushSubscription.addEventListener('change', onChange);

      const onPermChange = (granted) => setPermission(granted ? 'granted' : 'denied');
      OneSignal.Notifications.addEventListener('permissionChange', onPermChange);
    });
  }, []);

  const subscribeToAlerts = useCallback(() => {
    return new Promise((resolve, reject) => {
      let settled = false;

      // Safety net: if the OneSignal SDK never loads/inits (blocked script,
      // wrong appId, adblocker, etc.), OneSignalDeferred callbacks are queued
      // forever and this promise would otherwise hang indefinitely.
      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        console.error(
          '[OneSignal] Timeout: le SDK ne semble pas initialisé. ' +
          'Vérifie que le script OneSignalSDK.page.js est bien chargé dans index.html ' +
          'et que OneSignal.init() a été appelé avec le bon appId.'
        );
        reject(new Error('Le service de notifications ne répond pas (SDK non initialisé).'));
      }, 8000);

      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal) => {
        if (settled) return; // timeout already fired, ignore late execution
        try {
          await OneSignal.Notifications.requestPermission();
          const optedIn = Boolean(OneSignal.User?.PushSubscription?.optedIn);
          setIsSubscribed(optedIn);
          setPermission(OneSignal.Notifications.permission ? 'granted' : 'denied');

          clearTimeout(timeoutId);
          settled = true;

          if (!optedIn) {
            reject(new Error('Permission refusée par l’utilisateur.'));
            return;
          }
          resolve(true);
        } catch (err) {
          clearTimeout(timeoutId);
          settled = true;
          console.error('[OneSignal] subscribeToAlerts error:', err);
          reject(err);
        }
      });
    });
  }, []);

  return { subscribeToAlerts, isSubscribed, permission, ready };
}