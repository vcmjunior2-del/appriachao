
// Notificações push: navegador (Firebase Cloud Messaging + service worker)
// e app nativo Android/iOS (plugin @capacitor-firebase/messaging).
import { Capacitor } from '@capacitor/core';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { app, db } from './firebaseConfig';

// Chave pública "Web Push" (Console do Firebase > Configurações > Cloud Messaging)
const VAPID_KEY = 'BK_nOJx0Rd6fW93o0vZxgDTU2QlT7ZoTzXub6524O_aNeIZP8vtmD8SBOjCYeeuu46xoLtMxx_ZtAv6UGoDMbC4';

export type PushStatus = 'granted' | 'denied' | 'default' | 'unsupported';

const isNative = () => Capacitor.isNativePlatform();

// Salva o token do aparelho no perfil; a Cloud Function usa este campo para enviar o push
const saveToken = (uid: string, token: string) =>
    setDoc(doc(db, 'users', uid), { fcmToken: token }, { merge: true });

export const getPushStatus = async (): Promise<PushStatus> => {
    if (isNative()) {
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
        const { receive } = await FirebaseMessaging.checkPermissions();
        return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'default';
    }
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !(await isSupported())) return 'unsupported';
    return Notification.permission;
};

// Registra o aparelho para receber push.
// askPermission=true mostra o pedido de permissão (no iPhone só funciona a partir de um toque do usuário).
export const registerPush = async (uid: string, askPermission: boolean): Promise<PushStatus> => {
    if (isNative()) {
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
        let { receive } = await FirebaseMessaging.checkPermissions();
        if (receive !== 'granted' && askPermission) ({ receive } = await FirebaseMessaging.requestPermissions());
        if (receive !== 'granted') return receive === 'denied' ? 'denied' : 'default';
        const { token } = await FirebaseMessaging.getToken();
        if (token) await saveToken(uid, token);
        return 'granted';
    }

    const status = await getPushStatus();
    if (status === 'unsupported' || status === 'denied') return status;
    const permission = status === 'default' && askPermission ? await Notification.requestPermission() : status;
    if (permission !== 'granted') return permission;

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (token) await saveToken(uid, token);
    return 'granted';
};

// Mostra uma notificação do sistema com o app aberto (somente navegador).
// Retorna false quando não foi possível, para a tela mostrar um aviso interno.
export const showForegroundNotification = async (title: string, body: string): Promise<boolean> => {
    if (isNative() || !('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return false;
    try {
        // No Android, "new Notification()" não funciona: é preciso usar o service worker
        const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        if (!registration) return false;
        await registration.showNotification(title, { body, icon: '/icon-192.png', tag: 'riachao-app' });
        return true;
    } catch {
        return false;
    }
};
