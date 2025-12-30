import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
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

  await upsertUserProfileDoc(cred.user, {
    displayName: displayName || cred.user.displayName || "User",
    createdAt: serverTimestamp(),
  });

  return cred;
}

export async function loginGoogle() {
  const cred = await signInWithPopup(auth, provider);

  await upsertUserProfileDoc(cred.user);

  return cred;
}

export async function logout() {
  return signOut(auth);
}

async function upsertUserProfileDoc(user, profileOverrides = {}) {
  if (!user?.uid) return;

  const profileRef = doc(db, "users", user.uid, "profile");

  await setDoc(
    profileRef,
    {
      uid: user.uid,
      displayName: profileOverrides.displayName || user.displayName || "User",
      avatarUrl: profileOverrides.avatarUrl || user.photoURL || "",
      avatarDataUrl: profileOverrides.avatarDataUrl || "",
      bio: profileOverrides.bio || "",
      email: user.email || "",
      updatedAt: serverTimestamp(),
      createdAt: profileOverrides.createdAt || serverTimestamp(),
    },
    { merge: true }
  );
}
