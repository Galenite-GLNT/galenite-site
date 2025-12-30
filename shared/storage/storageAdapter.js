import { LocalStorageAdapter } from "./localStorageAdapter.js";
import { FirebaseAdapter } from "./firebaseAdapter.js";

let storageAdapter = null;

export function initStorageAdapter(config = {}) {
  const { type = "firebase", firebaseConfig = null } = config;

  if (type === "firebase") {
    storageAdapter = new FirebaseAdapter(firebaseConfig);
  } else {
    storageAdapter = new LocalStorageAdapter();
  }

  return storageAdapter;
}

export function getStorageAdapter() {
  if (!storageAdapter) {
    const globalConfig = window?.GALEN_STORAGE_CONFIG || {};
    initStorageAdapter(globalConfig);
  }

  return storageAdapter;
}
