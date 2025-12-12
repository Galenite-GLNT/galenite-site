// /shared/firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCI1Vp5CSBu0veADOHtuUcFATSaOnXPswc",
  authDomain: "galenite-glnt.firebaseapp.com",
  projectId: "galenite-glnt",
  storageBucket: "galenite-glnt.firebasestorage.app",
  messagingSenderId: "94081808482",
  appId: "1:94081808482:web:2f5f4842c293c18621f93b",
};

export const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);
