
// Import the functions you need from the SDKs you need
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/analytics";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore"; // Import Firestore
import { getStorage } from "firebase/storage"; // Import Storage

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyABQIWdQw16ZpP3NSMT7injmOEQzIcPTVM",
  authDomain: "appriachao.firebaseapp.com",
  projectId: "appriachao",
  storageBucket: "appriachao.firebasestorage.app",
  messagingSenderId: "39795669276",
  appId: "1:39795669276:web:e8cd3feb308de6bba322d9",
  measurementId: "G-W6HSJ4BR2H"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
// Initialize Firestore with auto-detect long polling and persistent local cache for offline reliability
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
const storage = getStorage(app); // Initialize Storage
// Analytics só onde é suportado: dentro do app instalado (iPhone/Android) ele não funciona e travaria a abertura
firebase.analytics.isSupported().then((supported) => { if (supported) firebase.analytics(); }).catch(() => {});
// Messaging (push) é iniciado em pushNotifications.ts, só quando o navegador suporta.
// Iniciar aqui travava o app em navegadores sem suporte (ex.: Safari do iPhone fora da tela inicial).
const googleProvider = new firebase.auth.GoogleAuthProvider();

// E-mails com acesso ao painel administrativo.
// Mantenha esta lista igual à de isAdmin() em firestore.rules e storage.rules.
const ADMIN_EMAILS = ['administracao@riachaodojacuipe.ba.gov.br'];

// Admin = e-mail da lista E verificado. Convidado (anônimo) nunca é admin.
const isAdminUser = (user: firebase.User | null | undefined): boolean =>
  !!user && !user.isAnonymous && user.emailVerified && ADMIN_EMAILS.includes(user.email || '');

export { app, auth, db, googleProvider, storage, ADMIN_EMAILS, isAdminUser }; // Export app, db, googleProvider and storage
