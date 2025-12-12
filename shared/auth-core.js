import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { auth, db } from "/shared/firebase.js";

const provider = new GoogleAuthProvider();

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function loginEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerEmail(email, password, displayName = "") {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) await updateProfile(cred.user, { displayName });

  await setDoc(
    doc(db, "users", cred.user.uid),
    {
      displayName: displayName || cred.user.displayName || "User",
      photoURL: cred.user.photoURL || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return cred;
}

export async function loginGoogle() {
  const cred = await signInWithPopup(auth, provider);

  await setDoc(
    doc(db, "users", cred.user.uid),
    {
      displayName: cred.user.displayName || "User",
      photoURL: cred.user.photoURL || "",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return cred;
}

export async function logout() {
  return signOut(auth);
}
