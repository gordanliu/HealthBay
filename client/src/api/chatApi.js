// client/src/api/chatApi.js
import api from './apiClient';

export async function sendChatMessage(question) {
  const res = await api.post('/chat', { question });
  return res.data;
}
