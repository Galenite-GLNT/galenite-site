export class FirebaseAdapter {
  constructor(firebaseConfig) {
    this.firebaseConfig = firebaseConfig;
    this.isReady = false;
  }

  async getUserProfile() {
    console.warn("FirebaseAdapter.getUserProfile: TODO");
    return null;
  }

  async upsertUserProfile(profile) {
    console.warn("FirebaseAdapter.upsertUserProfile: TODO", profile);
    return profile || null;
  }

  async listChats() {
    console.warn("FirebaseAdapter.listChats: TODO");
    return [];
  }

  async createChat(uid, chatPayload = {}) {
    console.warn("FirebaseAdapter.createChat: TODO", uid, chatPayload);
    return {
      chatId: "chat_todo",
      uid,
      title: chatPayload.title || "New chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  async getChat() {
    console.warn("FirebaseAdapter.getChat: TODO");
    return null;
  }

  async deleteChat() {
    console.warn("FirebaseAdapter.deleteChat: TODO");
  }

  async listMessages() {
    console.warn("FirebaseAdapter.listMessages: TODO");
    return [];
  }

  async addMessage(chatId, message) {
    console.warn("FirebaseAdapter.addMessage: TODO", chatId, message);
    return message;
  }

  async updateChat(chatId, partial) {
    console.warn("FirebaseAdapter.updateChat: TODO", chatId, partial);
    return partial;
  }
}

/*
Expected Firebase structure (draft):

users/{uid}
  profile (document):
    uid, displayName, avatarUrl, bio, updatedAt
  chats (collection)
    {chatId}:
      chatId, uid, title, createdAt, updatedAt
      messages (subcollection)
        {messageId}:
          messageId, chatId, role, content, createdAt, attachments[]
*/
