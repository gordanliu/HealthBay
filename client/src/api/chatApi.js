// client/src/api/chatApi.js
import api from './apiClient';

export async function sendChatMessage({ message, chatHistory, currentContext, selectedSymptoms, diagnosisId, startDiagnosticTest, testResponse, startTreatmentChat, confirmInjury, chatId, startNewChat }) {
  const res = await api.post('/chat', {
    message,
    chatHistory,
    currentContext,
    selectedSymptoms,
    diagnosisId,
    startDiagnosticTest,
    testResponse,
    startTreatmentChat,
    confirmInjury,
    chatId,
    startNewChat,
  });
  return res.data;
}

