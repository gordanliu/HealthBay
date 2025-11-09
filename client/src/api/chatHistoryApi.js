// client/src/api/chatHistoryApi.js
import api from './apiClient';

/**
 * Get all chats for the user
 */
export async function getChats() {
  const res = await api.get('/chats');
  return res.data;
}

/**
 * Get messages for a specific chat
 */
export async function getChatMessages(chatId) {
  const res = await api.get(`/chats/${chatId}/messages`);
  return res.data;
}

/**
 * Create a new chat
 */
export async function createChat(title) {
  const res = await api.post('/chats', { title });
  return res.data;
}

/**
 * Update a chat
 */
export async function updateChat(chatId, updates) {
  const res = await api.patch(`/chats/${chatId}`, updates);
  return res.data;
}

/**
 * Delete a chat
 */
export async function deleteChat(chatId) {
  const res = await api.delete(`/chats/${chatId}`);
  return res.data;
}

