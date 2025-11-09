// client/src/api/chatApi.js
import api from './apiClient';

export async function sendChatMessage({ message, chatHistory, currentContext, selectedSymptoms, diagnosisId, startDiagnosticTest, testResponse }) {
  const res = await api.post('/chat', {
    message,
    chatHistory,
    currentContext,
    selectedSymptoms,
    diagnosisId,
    startDiagnosticTest,
    testResponse,
  });
  return res.data;
}

