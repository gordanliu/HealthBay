// client/src/api/chatApi.js
import api from './apiClient';

export async function sendChatMessage({
  message,
  chatHistory,
  currentContext,
  selectedSymptoms,
  diagnosisId,
  startDiagnosticTest,
  testResponse,
  exitDiagnosticTest,
}) {
  const res = await api.post('/chat', {
    message,
    chatHistory,
    currentContext,
    selectedSymptoms,
    diagnosisId,
    startDiagnosticTest,
    testResponse,
    exitDiagnosticTest,
  });
  return res.data;
}
