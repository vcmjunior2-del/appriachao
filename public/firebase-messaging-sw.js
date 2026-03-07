import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

// Initialize Firebase in the service worker
const firebaseConfig = {
  // You need to copy the same config from firebaseConfig.ts here
  apiKey: "AIzaSyABQIWdQw16ZpP3NSMT7injmOEQzIcPTVM",
  authDomain: "appriachao.firebaseapp.com",
  projectId: "appriachao",
  storageBucket: "appriachao.firebasestorage.app",
  messagingSenderId: "39795669276",
  appId: "1:39795669276:web:e8cd3feb308de6bba322d9",
  measurementId: "G-W6HSJ4BR2H"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

onBackgroundMessage(messaging, (payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'Notificação';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/icon-192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
