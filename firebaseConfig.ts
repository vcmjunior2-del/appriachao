
// Import the functions you need from the SDKs you need
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/analytics";
import "firebase/compat/messaging"; // Import Messaging
import { getFirestore } from "firebase/firestore"; // Import Firestore
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
const db = getFirestore(app); // Initialize Firestore
const storage = getStorage(app); // Initialize Storage
const analytics = firebase.analytics();
const messaging = firebase.messaging(); // Initialize Messaging
const googleProvider = new firebase.auth.GoogleAuthProvider();

export { auth, db, googleProvider, storage, messaging }; // Export db, googleProvider, storage and messaging
