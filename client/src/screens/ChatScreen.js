import { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';
import SymptomChecklist from '../components/SymptomChecklist';
import DiagnosisList from '../components/DiagnosisList';
import DiagnosisDetail from '../components/DiagnosisDetail';
import DiagnosticTest from '../components/DiagnosticTest';
import { sendChatMessage } from '../api/chatApi';

export default function ChatScreen({ route, navigation }) {
  const { intakeData } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [context, setContext] = useState({});
  const [showSymptomChecklist, setShowSymptomChecklist] = useState(false);
  const [symptomChecklistData, setSymptomChecklistData] = useState(null);
  const [showDiagnosisList, setShowDiagnosisList] = useState(false);
  const [diagnosisListData, setDiagnosisListData] = useState(null);
  const [showDiagnosisDetail, setShowDiagnosisDetail] = useState(false);
  const [diagnosisDetailData, setDiagnosisDetailData] = useState(null);
  const [showDiagnosticTest, setShowDiagnosticTest] = useState(false);
  const [diagnosticTestData, setDiagnosticTestData] = useState(null);
  const [showTestResults, setShowTestResults] = useState(false);
  const [testResultsData, setTestResultsData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // Process intake data on mount
  useEffect(() => {
    if (intakeData) {
      processIntakeData();
    }
  }, []);

  const processIntakeData = async () => {
    setIsLoading(true);

    // Format intake data into a message
    const intakeMessage = `I have ${intakeData.symptomDescription} in my ${intakeData.bodyPart}. Duration: ${intakeData.duration}`;

    try {
      console.log('📤 Processing intake data:', intakeData);

      const res = await sendChatMessage({
        message: intakeMessage,
        chatHistory: [],
        currentContext: {},
      });

      const responseData = res.data?.data || res.data;
      console.log('📊 Response data:', responseData);

      // Update context
      const newContext = responseData.currentContext || {
        stage: responseData.stage,
        currentDetails: responseData.currentDetails,
        missingInfo: responseData.missingInfo,
        testSession: responseData.testSession,
      };
      setContext(newContext);

      // Check if we should show symptom checklist
      if (responseData.symptomChecklist) {
        setShowSymptomChecklist(true);
        setSymptomChecklistData({
          message: responseData.response,
          symptomCategories: responseData.symptomChecklist,
          context: newContext,
        });
      }
      // Check if we should show diagnosis list
      else if (responseData.diagnoses && responseData.diagnoses.length > 0) {
        setShowDiagnosisList(true);
        setDiagnosisListData({
          diagnoses: responseData.diagnoses,
          summary: responseData.response,
          immediateAdvice: responseData.immediateAdvice,
          context: newContext,
        });
      }
    } catch (err) {
      console.error('❌ Error processing intake:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const newUserMsg = {
      role: 'user',
      text: input,
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setMessages((prev) => [...prev, newUserMsg]);

    const userMessage = input;
    setInput('');

    try {
      const res = await sendChatMessage({
        message: userMessage,
        chatHistory: messages,
        currentContext: context,
      });

      const responseData = res.data?.data || res.data;
      const aiResponse = responseData.response || 'No response';

      const newAiMsg = {
        role: 'assistant',
        text: aiResponse,
        time: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setMessages((prev) => [...prev, newAiMsg]);

      const newContext = responseData.currentContext || {
        stage: responseData.stage,
        currentDetails: responseData.currentDetails,
        missingInfo: responseData.missingInfo,
        testSession: responseData.testSession,
      };
      setContext(newContext);
    } catch (err) {
      console.error('❌ Error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Error: could not connect to the server.',
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    }
  };

  const handleSymptomSubmit = async (selectedSymptoms) => {
    setShowSymptomChecklist(false);
    setIsLoading(true);

    const symptomText =
      selectedSymptoms.length > 0
        ? `Selected symptoms: ${selectedSymptoms.join(', ')}`
        : 'No specific symptoms selected';

    try {
      const res = await sendChatMessage({
        message: symptomText,
        chatHistory: messages,
        currentContext: context,
        selectedSymptoms: selectedSymptoms,
      });

      const responseData = res.data?.data || res.data;

      const newContext = responseData.currentContext || {
        stage: responseData.stage,
        currentDetails: responseData.currentDetails,
        missingInfo: responseData.missingInfo,
        testSession: responseData.testSession,
      };
      setContext(newContext);

      // Check if we should show diagnosis list
      if (responseData.diagnoses && responseData.diagnoses.length > 0) {
        setShowDiagnosisList(true);
        setDiagnosisListData({
          diagnoses: responseData.diagnoses,
          summary: responseData.response,
          immediateAdvice: responseData.immediateAdvice,
          context: newContext,
        });
      }
    } catch (err) {
      console.error('❌ Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDiagnosis = async (diagnosisId) => {
    setIsLoading(true);

    try {
      const res = await sendChatMessage({
        message: `Tell me more about ${diagnosisId}`,
        chatHistory: messages,
        currentContext: context,
        diagnosisId: diagnosisId,
      });

      const responseData = res.data?.data || res.data;

      if (responseData.diagnosisDetail) {
        setShowDiagnosisList(false);
        setShowDiagnosisDetail(true);
        setDiagnosisDetailData({
          diagnosisDetail: responseData.diagnosisDetail,
          diagnosisId: diagnosisId,
          context: responseData.currentContext || context,
        });
        setContext(responseData.currentContext || context);
      }
    } catch (err) {
      console.error('❌ Error fetching diagnosis detail:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartDiagnosticTest = async () => {
    setIsLoading(true);

    try {
      const res = await sendChatMessage({
        message: 'Start diagnostic tests',
        chatHistory: messages,
        currentContext: context,
        startDiagnosticTest: true,
      });

      const responseData = res.data?.data || res.data;

      setShowDiagnosisDetail(false);

      if (
        responseData.stage &&
        responseData.stage.includes('DIAGNOSTIC_TEST')
      ) {
        setShowDiagnosticTest(true);
        setDiagnosticTestData(responseData);
        setContext(
          responseData.testSession
            ? { ...context, testSession: responseData.testSession }
            : context,
        );
      }
    } catch (err) {
      console.error('❌ Error starting diagnostic test:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestAction = async (testResponse) => {
    if (testResponse.action === 'exit_test') {
      setShowDiagnosticTest(false);
      setShowTestResults(false);
      setShowDiagnosisDetail(true);
      return;
    }

    setIsLoading(true);

    try {
      const res = await sendChatMessage({
        message: `Test action: ${testResponse.action}`,
        chatHistory: messages,
        currentContext: context,
        testResponse: testResponse,
      });

      const responseData = res.data?.data || res.data;

      if (responseData.testSession) {
        setContext({ ...context, testSession: responseData.testSession });
      }

      if (responseData.stage === 'DIAGNOSTIC_TEST_COMPLETE') {
        setShowDiagnosticTest(false);
        setShowTestResults(true);
        setTestResultsData(responseData);
      } else if (
        responseData.stage &&
        responseData.stage.includes('DIAGNOSTIC_TEST')
      ) {
        setDiagnosticTestData(responseData);
      }
    } catch (err) {
      console.error('❌ Error handling test action:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToDiagnosisList = () => {
    setShowDiagnosisDetail(false);
    setShowDiagnosisList(true);
  };

  const handleOpenChat = () => {
    // Transition from test results to open chat
    setShowTestResults(false);
    setShowChat(true);

    // Add a welcome message
    const welcomeMsg = {
      role: 'assistant',
      text: `Great! You've completed the assessment. I have all the context from your ${context.currentDetails?.body_part} injury diagnosis. Feel free to ask me any questions about your treatment, recovery timeline, exercises, or anything else!`,
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setMessages([welcomeMsg]);
  };

  // Render diagnostic test UI
  const renderDiagnosticTestUI = () => {
    if (!diagnosticTestData) return null;

    return (
      <DiagnosticTest
        testData={diagnosticTestData}
        onTestAction={handleTestAction}
      />
    );
  };

  // Loading screen
  if (isLoading && !showDiagnosticTest) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Analyzing your symptoms...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showSymptomChecklist && symptomChecklistData ? (
        <SymptomChecklist
          symptomCategories={symptomChecklistData.symptomCategories}
          onSubmit={handleSymptomSubmit}
          message={symptomChecklistData.message}
        />
      ) : showDiagnosisList && diagnosisListData ? (
        <DiagnosisList
          diagnoses={diagnosisListData.diagnoses}
          summary={diagnosisListData.summary}
          immediateAdvice={diagnosisListData.immediateAdvice}
          onSelectDiagnosis={handleSelectDiagnosis}
        />
      ) : showDiagnosisDetail && diagnosisDetailData ? (
        <DiagnosisDetail
          diagnosisDetail={diagnosisDetailData.diagnosisDetail}
          onStartDiagnosticTest={handleStartDiagnosticTest}
          onBack={handleBackToDiagnosisList}
        />
      ) : showDiagnosticTest && diagnosticTestData ? (
        renderDiagnosticTestUI()
      ) : showTestResults && testResultsData ? (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.resultsContent}
        >
          <Text style={styles.resultsTitle}>🔬 Assessment Complete</Text>

          {testResultsData.analysis && (
            <>
              <View style={styles.resultsCard}>
                <Text style={styles.resultsLabel}>Refined Diagnosis</Text>
                <Text style={styles.resultsName}>
                  {testResultsData.analysis.refinedDiagnosis?.name || 'Unknown'}
                </Text>
                {testResultsData.analysis.confidenceLevel && (
                  <View
                    style={[
                      styles.confidenceBadge,
                      {
                        backgroundColor:
                          testResultsData.analysis.confidenceLevel === 'high'
                            ? '#4CAF50'
                            : testResultsData.analysis.confidenceLevel ===
                                'medium'
                              ? '#FF9800'
                              : '#f44336',
                      },
                    ]}
                  >
                    <Text style={styles.confidenceText}>
                      {testResultsData.analysis.confidenceLevel === 'high'
                        ? 'High Confidence'
                        : testResultsData.analysis.confidenceLevel === 'medium'
                          ? 'Moderate Confidence'
                          : 'Lower Confidence'}
                    </Text>
                  </View>
                )}
              </View>

              {testResultsData.analysis.assessment && (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>📊 Assessment</Text>
                  <Text style={styles.sectionText}>
                    {testResultsData.analysis.assessment}
                  </Text>
                </View>
              )}

              {testResultsData.analysis.refinedRecommendations &&
                testResultsData.analysis.refinedRecommendations.length > 0 && (
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>
                      💡 Key Recommendations
                    </Text>
                    {testResultsData.analysis.refinedRecommendations.map(
                      (rec, idx) => (
                        <Text key={idx} style={styles.bulletText}>
                          • {rec}
                        </Text>
                      ),
                    )}
                  </View>
                )}
            </>
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleOpenChat}
          >
            <Text style={styles.primaryButtonText}>💬 Continue to Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setShowTestResults(false);
              setShowDiagnosisDetail(true);
            }}
          >
            <Text style={styles.secondaryButtonText}>
              ← Back to Diagnosis Details
            </Text>
          </TouchableOpacity>
        </ScrollView>
      ) : showChat || messages.length > 0 ? (
        <>
          <ScrollView contentContainerStyle={styles.chatArea}>
            {messages.map((msg, index) => (
              <ChatBubble
                key={index}
                role={msg.role}
                text={msg.text}
                time={msg.time}
              />
            ))}
          </ScrollView>
          <ChatInput input={input} setInput={setInput} onSend={handleSend} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafbfc' },
  chatArea: { padding: 16 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  resultsContent: {
    padding: 16,
    paddingBottom: 40,
  },
  resultsTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  resultsCard: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  resultsLabel: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '600',
    marginBottom: 4,
  },
  resultsName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1b5e20',
    marginBottom: 12,
  },
  confidenceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 15,
    color: '#2c3e50',
    lineHeight: 22,
  },
  bulletText: {
    fontSize: 15,
    color: '#2c3e50',
    lineHeight: 24,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
  },
});
