import { getStorageAdapter } from "../storage/storageAdapter.js";

function now() {
  return Date.now();
}

export async function getUserProfile(uid) {
  if (!uid) return null;
  const adapter = getStorageAdapter();
  return adapter.getUserProfile(uid);
}

export async function upsertUserProfile(profile) {
  if (!profile?.uid) return null;
  const adapter = getStorageAdapter();
  return adapter.upsertUserProfile({
    ...profile,
    updatedAt: profile.updatedAt || now(),
  });
}

export async function ensureUserProfile(user) {
  if (!user?.uid) return null;
  const existing = await getUserProfile(user.uid);
  if (existing) return existing;

  return upsertUserProfile({
    uid: user.uid,
    displayName: user.displayName || "User",
    avatarUrl: user.photoURL || "",
    bio: "",
    updatedAt: now(),
  });
}
