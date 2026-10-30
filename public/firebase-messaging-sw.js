// Service worker do Firebase Cloud Messaging (push com o app fechado no navegador).
// Arquivos da pasta public não passam pelo Vite, então usamos a versão "compat" via importScripts.
importScripts('https://www.gstatic.com/firebasejs/12.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.7.0/firebase-messaging-compat.js');

// Mesma configuração de firebaseConfig.ts
firebase.initializeApp({
  apiKey: "AIzaSyABQIWdQw16ZpP3NSMT7injmOEQzIcPTVM",
  authDomain: "appriachao.firebaseapp.com",
  projectId: "appriachao",
  storageBucket: "appriachao.firebasestorage.app",
  messagingSenderId: "39795669276",
  appId: "1:39795669276:web:e8cd3feb308de6bba322d9",
  measurementId: "G-W6HSJ4BR2H"
});

// As mensagens enviadas pela Cloud Function têm o bloco "notification",
// que o próprio SDK exibe com o app fechado. Não chamar showNotification aqui
// para não aparecer a notificação duplicada.
firebase.messaging();

// Ao tocar na notificação, abre (ou traz para frente) o aplicativo
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
