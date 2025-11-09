// client/src/api/chatApi.js
import api from './apiClient';

export async function sendChatMessage({ message, chatHistory, currentContext }) {
  const res = await api.post('/chat', {
    message,
    chatHistory,
    currentContext,
  });
  return res.data;
}

