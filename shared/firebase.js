import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const app = initializeApp({
  apiKey: "AIzaSyCP4G9o0g0pqPwoIYBJ3UEZyrPFt1PEDbE",
  authDomain: "galenite-f1b8e.firebaseapp.com",
  projectId: "galenite-f1b8e",
  storageBucket: "galenite-f1b8e.appspot.com",
  messagingSenderId: "97488613838",
  appId: "1:97488613838:web:24bbacd61a69e3fe8ffb9f"
});

export const auth = getAuth(app);
export const db = getFirestore(app);
