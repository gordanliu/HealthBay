import { useState } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';
import SymptomChecklist from '../components/SymptomChecklist';
import DiagnosisList from '../components/DiagnosisList';
import DiagnosisDetail from '../components/DiagnosisDetail';
import { sendChatMessage } from '../api/chatApi';

export default function ChatScreen() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hello! I'm your health assistant. Please describe your symptoms, and I'll help you understand what might be happening.",
      time: '06:43 PM',
    },
  ]);
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
    
    const userMessage = input; // Store before clearing
    setInput('');

    try {
      console.log('📤 Sending message:', userMessage);
      console.log('📋 Current context:', context);
      
      const res = await sendChatMessage({
        message: userMessage,
        chatHistory: messages,
        currentContext: context,
      });
      
      console.log('📥 Full response:', JSON.stringify(res, null, 2));
      console.log('📥 res.data:', res.data);
      console.log('📥 res.data.data:', res.data?.data);
      
      // Try to access the response data - handle both possible structures
      const responseData = res.data?.data || res.data;
      console.log('📊 Response data:', responseData);
      
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
      
      // Update context: use currentContext from response if available, otherwise build from response
      const newContext = responseData.currentContext || {
        stage: responseData.stage,
        currentDetails: responseData.currentDetails,
        missingInfo: responseData.missingInfo,
        testSession: responseData.testSession
      };
      setContext(newContext);
      
      console.log('✅ Updated Context:', newContext);
      
      // Check if we should show symptom checklist
      if (responseData.symptomChecklist) {
        setShowSymptomChecklist(true);
        setSymptomChecklistData({
          message: aiResponse,
          symptomCategories: responseData.symptomChecklist,
          context: newContext
        });
      }
      
      // Check if we should show diagnosis list
      if (responseData.diagnoses && responseData.diagnoses.length > 0) {
        setShowDiagnosisList(true);
        setDiagnosisListData({
          diagnoses: responseData.diagnoses,
          summary: responseData.response,
          immediateAdvice: responseData.immediateAdvice,
          context: newContext
        });
      }
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
    
    // Add a user message showing what they selected
    const symptomText = selectedSymptoms.length > 0 
      ? `Selected symptoms: ${selectedSymptoms.join(', ')}`
      : 'No specific symptoms selected';
    
    const newUserMsg = {
      role: 'user',
      text: symptomText,
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setMessages((prev) => [...prev, newUserMsg]);

    try {
      console.log('📤 Sending selected symptoms:', selectedSymptoms);
      console.log('📋 Current context:', context);
      
      const res = await sendChatMessage({
        message: symptomText,
        chatHistory: messages,
        currentContext: context,
        selectedSymptoms: selectedSymptoms, // Pass the selected symptoms array
      });
      
      console.log('📥 Full response:', JSON.stringify(res, null, 2));
      
      // Try to access the response data - handle both possible structures
      const responseData = res.data?.data || res.data;
      console.log('📊 Response data:', responseData);
      
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
      
      // Update context
      const newContext = responseData.currentContext || {
        stage: responseData.stage,
        currentDetails: responseData.currentDetails,
        missingInfo: responseData.missingInfo,
        testSession: responseData.testSession
      };
      setContext(newContext);
      
      console.log('✅ Updated Context:', newContext);
      
      // Check if we should show diagnosis list
      if (responseData.diagnoses && responseData.diagnoses.length > 0) {
        setShowDiagnosisList(true);
        setDiagnosisListData({
          diagnoses: responseData.diagnoses,
          summary: responseData.response,
          immediateAdvice: responseData.immediateAdvice,
          context: newContext
        });
      }
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

  const handleSelectDiagnosis = async (diagnosisId) => {
    console.log('🔍 Selected diagnosis:', diagnosisId);
    
    try {
      const res = await sendChatMessage({
        message: `Tell me more about ${diagnosisId}`,
        chatHistory: messages,
        currentContext: context,
        diagnosisId: diagnosisId,
      });
      
      const responseData = res.data?.data || res.data;
      console.log('📊 Diagnosis detail response:', responseData);
      
      if (responseData.diagnosisDetail) {
        setShowDiagnosisList(false);
        setShowDiagnosisDetail(true);
        setDiagnosisDetailData({
          diagnosisDetail: responseData.diagnosisDetail,
          diagnosisId: diagnosisId,
          context: responseData.currentContext || context
        });
        setContext(responseData.currentContext || context);
      }
    } catch (err) {
      console.error('❌ Error fetching diagnosis detail:', err);
    }
  };

  const handleStartDiagnosticTest = async () => {
    console.log('🧪 Starting diagnostic test');
    
    try {
      const res = await sendChatMessage({
        message: 'Start diagnostic tests',
        chatHistory: messages,
        currentContext: context,
        startDiagnosticTest: true,
      });
      
      const responseData = res.data?.data || res.data;
      console.log('📊 Diagnostic test response:', responseData);
      
      // Hide diagnosis detail and show diagnostic test UI
      setShowDiagnosisDetail(false);
      
      // Check if we got test intro data
      if (responseData.stage && responseData.stage.includes('DIAGNOSTIC_TEST')) {
        setShowDiagnosticTest(true);
        setDiagnosticTestData(responseData);
        setContext(responseData.testSession ? { ...context, testSession: responseData.testSession } : context);
      } else {
        // Fallback to chat if something went wrong
        const aiResponse = responseData.response || 'Starting diagnostic tests...';
        const newAiMsg = {
          role: 'assistant',
          text: aiResponse,
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        setMessages((prev) => [...prev, newAiMsg]);
        setContext(responseData.currentContext || context);
      }
    } catch (err) {
      console.error('❌ Error starting diagnostic test:', err);
    }
  };

  const handleTestAction = async (testResponse) => {
    console.log('🧪 Test action:', testResponse);
    
    // Handle exit test action
    if (testResponse.action === 'exit_test') {
      setShowDiagnosticTest(false);
      setShowTestResults(false);
      setShowDiagnosisDetail(true);
      return;
    }
    
    setIsLoading(true); // Show loading indicator
    
    try {
      const res = await sendChatMessage({
        message: `Test action: ${testResponse.action}`,
        chatHistory: messages,
        currentContext: context,
        testResponse: testResponse,
      });
      
      const responseData = res.data?.data || res.data;
      console.log('📊 Test action response:', responseData);
      
      // Update context with new test session data
      if (responseData.testSession) {
        setContext({ ...context, testSession: responseData.testSession });
      }
      
      // Handle different response stages
      if (responseData.stage === 'DIAGNOSTIC_TEST_COMPLETE') {
        // Tests are complete, show results
        setShowDiagnosticTest(false);
        setShowTestResults(true);
        setTestResultsData(responseData);
      } else if (responseData.stage && responseData.stage.includes('DIAGNOSTIC_TEST')) {
        // Still in testing, update the test UI
        setDiagnosticTestData(responseData);
      } else {
        // Something unexpected, return to chat
        setShowDiagnosticTest(false);
        const aiResponse = responseData.response || 'Test completed';
        const newAiMsg = {
          role: 'assistant',
          text: aiResponse,
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        setMessages((prev) => [...prev, newAiMsg]);
      }
    } catch (err) {
      console.error('❌ Error handling test action:', err);
    } finally {
      setIsLoading(false); // Hide loading indicator
    }
  };

  const handleBackToDiagnosisList = () => {
    setShowDiagnosisDetail(false);
    setShowDiagnosisList(true);
  };

  // Render diagnostic test UI inline based on server response
  const renderDiagnosticTestUI = () => {
    if (!diagnosticTestData) return null;

    const { stage, testSession, currentTest, progress, nextAction, response, analysis } = diagnosticTestData;

    // Show loading overlay when waiting for server response
    if (isLoading) {
      return (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      );
    }

    // DIAGNOSTIC_TEST_INTRO - Show introduction and safety warning
    if (stage === 'DIAGNOSTIC_TEST_INTRO') {
      return (
        <ScrollView style={styles.testContainer} contentContainerStyle={styles.testContent}>
          <Text style={styles.testTitle}>🔬 Diagnostic Tests</Text>
          <Text style={styles.testIntroText}>{response}</Text>
          
          <View style={styles.safetyWarning}>
            <Text style={styles.safetyTitle}>⚠️ Safety First</Text>
            <Text style={styles.safetyText}>
              Stop immediately if you experience:
              {'\n'}• Sharp or severe pain
              {'\n'}• Numbness or tingling
              {'\n'}• Instability or inability to bear weight
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => handleTestAction({ action: 'start_test' })}
          >
            <Text style={styles.primaryButtonText}>Begin Testing</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => {
              setShowDiagnosticTest(false);
              setShowDiagnosisDetail(true);
            }}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    // DIAGNOSTIC_TEST_STEP - Show current step instructions
    if (stage === 'DIAGNOSTIC_TEST_STEP') {
      return (
        <ScrollView style={styles.testContainer} contentContainerStyle={styles.testContent}>
          <Text style={styles.testTitle}>{currentTest?.name || 'Diagnostic Test'}</Text>
          
          {progress && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                Test {progress.currentTest} of {progress.totalTests} • Step {progress.currentStep} of {progress.totalSteps}
              </Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${(progress.currentStep / progress.totalSteps) * 100}%` }
                  ]} 
                />
              </View>
            </View>
          )}

          <View style={styles.stepCard}>
            <Text style={styles.stepInstructions}>{response}</Text>
          </View>

          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => handleTestAction({ action: 'next_step' })}
          >
            <Text style={styles.primaryButtonText}>Next Step</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.dangerButton}
            onPress={() => handleTestAction({ action: 'stop_test', reason: 'severe_pain' })}
          >
            <Text style={styles.dangerButtonText}>⚠️ Stop - Severe Pain</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    // DIAGNOSTIC_TEST_RESULT - Ask for result
    if (stage === 'DIAGNOSTIC_TEST_RESULT') {
      return (
        <ScrollView style={styles.testContainer} contentContainerStyle={styles.testContent}>
          <Text style={styles.testTitle}>{currentTest?.name || 'Test Complete'}</Text>
          
          {progress && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                Test {progress.currentTest} of {progress.totalTests}
              </Text>
            </View>
          )}

          <View style={styles.questionCard}>
            <Text style={styles.questionText}>{response}</Text>
          </View>

          <TouchableOpacity 
            style={styles.resultButton}
            onPress={() => handleTestAction({ action: 'submit_result', result: 'positive' })}
          >
            <Text style={styles.resultButtonText}>✓ Yes / Positive</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.resultButton}
            onPress={() => handleTestAction({ action: 'submit_result', result: 'negative' })}
          >
            <Text style={styles.resultButtonText}>✗ No / Negative</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.resultButton}
            onPress={() => handleTestAction({ action: 'submit_result', result: 'unsure' })}
          >
            <Text style={styles.resultButtonText}>? Unsure</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.dangerButton}
            onPress={() => handleTestAction({ action: 'submit_result', result: 'stopped', reason: 'severe_pain' })}
          >
            <Text style={styles.dangerButtonText}>⚠️ Stopped Due to Pain</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    // DIAGNOSTIC_TEST_TRANSITION - Between tests
    if (stage === 'DIAGNOSTIC_TEST_TRANSITION') {
      return (
        <ScrollView style={styles.testContainer} contentContainerStyle={styles.testContent}>
          <Text style={styles.testTitle}>Test Completed ✓</Text>
          
          <View style={styles.transitionCard}>
            <Text style={styles.transitionText}>{response}</Text>
          </View>

          {progress && progress.currentTest < progress.totalTests && (
            <>
              <Text style={styles.nextTestLabel}>Next Test:</Text>
              <Text style={styles.nextTestName}>{nextAction?.nextTest || 'Loading...'}</Text>
            </>
          )}

          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => handleTestAction({ action: 'start_test' })}
          >
            <Text style={styles.primaryButtonText}>
              {progress && progress.currentTest < progress.totalTests ? 'Start Next Test' : 'Continue'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => handleTestAction({ action: 'exit_test' })}
          >
            <Text style={styles.secondaryButtonText}>Exit Tests</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    // DIAGNOSTIC_TEST_STOPPED - User stopped due to pain
    if (stage === 'DIAGNOSTIC_TEST_STOPPED') {
      return (
        <ScrollView style={styles.testContainer} contentContainerStyle={styles.testContent}>
          <Text style={styles.testTitle}>⚠️ Test Stopped</Text>
          
          <View style={styles.stoppedCard}>
            <Text style={styles.stoppedText}>{response}</Text>
          </View>

          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => {
              setShowDiagnosticTest(false);
              setShowDiagnosisDetail(true);
            }}
          >
            <Text style={styles.primaryButtonText}>Back to Diagnosis</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    // DIAGNOSTIC_TEST_COMPLETE - Show final analysis
    if (stage === 'DIAGNOSTIC_TEST_COMPLETE') {
      // If still loading analysis, show loading
      if (!analysis) {
        return (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Analyzing your test results...</Text>
          </View>
        );
      }
      
      return (
        <ScrollView style={styles.testContainer} contentContainerStyle={styles.testContent}>
          <Text style={styles.testTitle}>🔬 Test Results Complete</Text>
          
          <View style={styles.resultsCard}>
            <Text style={styles.resultsLabel}>Refined Diagnosis</Text>
            <Text style={styles.resultsName}>{analysis.refinedDiagnosis?.name || 'Unknown'}</Text>
            {analysis.confidenceLevel && (
              <View style={[styles.confidenceBadge, { 
                backgroundColor: analysis.confidenceLevel === 'high' ? '#4CAF50' : 
                                analysis.confidenceLevel === 'medium' ? '#FF9800' : '#f44336' 
              }]}>
                <Text style={styles.confidenceText}>
                  {analysis.confidenceLevel === 'high' ? 'High Confidence' : 
                   analysis.confidenceLevel === 'medium' ? 'Moderate Confidence' : 
                   'Lower Confidence'}
                </Text>
              </View>
            )}
          </View>

          {analysis.assessment && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>📊 Assessment</Text>
              <Text style={styles.sectionText}>{analysis.assessment}</Text>
            </View>
          )}

          {analysis.refinedRecommendations && analysis.refinedRecommendations.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>💡 Key Recommendations</Text>
              {analysis.refinedRecommendations.map((rec, idx) => (
                <Text key={idx} style={styles.bulletText}>• {rec}</Text>
              ))}
            </View>
          )}

          {analysis.nextSteps && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>🎯 Next Steps</Text>
              <Text style={styles.sectionText}>{analysis.nextSteps}</Text>
            </View>
          )}

          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => {
              setShowDiagnosticTest(false);
              setShowTestResults(false);
              setShowDiagnosisDetail(true);
            }}
          >
            <Text style={styles.primaryButtonText}>← Back to Diagnosis Details</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    return null;
  };

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
      ) : (showDiagnosticTest || showTestResults) && diagnosticTestData ? (
        renderDiagnosticTestUI()
      ) : (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafbfc' },
  chatArea: { padding: 16 },
  // Loading Overlay
  loadingOverlay: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  // Diagnostic Test Styles
  testContainer: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  testContent: {
    padding: 16,
    paddingBottom: 40,
  },
  testTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
  },
  testIntroText: {
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 24,
    marginBottom: 20,
  },
  safetyWarning: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  safetyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  safetyText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 22,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  stepCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stepInstructions: {
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 24,
  },
  questionCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1565C0',
    lineHeight: 26,
  },
  transitionCard: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  transitionText: {
    fontSize: 16,
    color: '#2e7d32',
    lineHeight: 24,
  },
  nextTestLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  nextTestName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 24,
  },
  stoppedCard: {
    backgroundColor: '#ffebee',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  stoppedText: {
    fontSize: 16,
    color: '#c62828',
    lineHeight: 24,
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
    marginBottom: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
  },
  dangerButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f44336',
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f44336',
  },
  resultButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  resultButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
});
