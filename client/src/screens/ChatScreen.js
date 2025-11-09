import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';
import SymptomChecklist from '../components/SymptomChecklist';
import DiagnosisList from '../components/DiagnosisList';
import DiagnosisDetail from '../components/DiagnosisDetail';
import { sendChatMessage } from '../api/chatApi';
import { saveChatSession, getRelevantPastInjuries, formatPastInjuriesForAI } from '../utils/chatStorage';

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
    setIsLoading(true); // Show loading indicator

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
  provenance: responseData.provenance || null,
  sources: responseData.sources || [],
  ragUsed: responseData.ragUsed || false,
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
     if (responseData.stage === 'DIAGNOSIS_LIST') {
  setShowDiagnosisList(true);
  setDiagnosisListData({
    diagnoses: responseData.diagnoses || [],
    summary: responseData.response || responseData.summary || "Let's go over what might be happening.",
    immediateAdvice: responseData.immediateAdvice || "Try to rest and avoid painful movements for now.",
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
    } finally {
      setIsLoading(false); // Hide loading indicator
    }
  };

  const handleSymptomSubmit = async (selectedSymptoms) => {
    setShowSymptomChecklist(false);
    setIsLoading(true); // Show loading while processing
    
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
    } finally {
      setIsLoading(false); // Hide loading
    }
  };

  const handleSelectDiagnosis = async (diagnosisId) => {
    console.log('🔍 Selected diagnosis:', diagnosisId);
    setIsLoading(true); // Show loading
    
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
    } finally {
      setIsLoading(false); // Hide loading
    }
  };

  const handleStartDiagnosticTest = async () => {
    console.log('🧪 Starting diagnostic test');
    setIsLoading(true); // Show loading
    
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
      setShowDiagnosticTest(true);
      
      // Check if we got test intro data
      if (responseData.testSession) {
        setDiagnosticTestData(responseData);
        setContext({ ...context, testSession: responseData.testSession });
      } else {
        // Fallback to chat if test data not available
        const aiResponse = responseData.response || 'Starting tests...';
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
      Alert.alert('Error', 'Failed to start diagnostic tests. Please try again.');
    } finally {
      setIsLoading(false); // Hide loading
    }
  };

  const handleTestAction = async (testResponse) => {
    console.log('🧪 Test action:', testResponse);
    console.log('📦 Current context being sent:', JSON.stringify(context, null, 2));
    
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
      console.log('🎯 Response stage:', responseData.stage);
      
      // Update context with new test session data FIRST
      if (responseData.testSession) {
        const updatedContext = { ...context, testSession: responseData.testSession };
        setContext(updatedContext);
        console.log('✅ Updated test session context:', updatedContext);
      }
      
      // Handle different response stages
      if (responseData.stage === 'DIAGNOSTIC_TEST_COMPLETE') {
        // Tests are complete, show results
        console.log('✅ ALL TESTS COMPLETE - Showing results');
        setShowDiagnosticTest(false);
        setShowTestResults(true);
        setTestResultsData(responseData);
        setDiagnosticTestData(null); // Clear test data
      } else if (responseData.stage === 'DIAGNOSTIC_TEST_STOPPED') {
        // Test stopped due to severe pain or other reason
        console.log('⚠️ TEST STOPPED - Showing stop message');
        setShowDiagnosticTest(false);
        setShowTestResults(true);
        setTestResultsData(responseData);
        setDiagnosticTestData(null); // Clear test data
        // Update context with stopped test session
        if (responseData.testSession) {
          setContext({ ...context, testSession: responseData.testSession });
        }
      } else if (responseData.stage && responseData.stage.includes('DIAGNOSTIC_TEST')) {
        // Still in testing, update the test UI
        console.log('📝 Test stage:', responseData.stage);
        setDiagnosticTestData(responseData);
      } else {
        // Something unexpected, return to chat
        console.log('⚠️ Unexpected stage:', responseData.stage);
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

  // Handle continuing to chat from diagnosis list
  const handleContinueChat = () => {
    console.log('📝 Continuing to chat...');
    setShowDiagnosisList(false);
    setShowSymptomChecklist(false);
    
    // Add a message to the chat
    const newAiMsg = {
      role: 'assistant',
      text: "I'm here to answer any questions you have about your diagnosis or symptoms. What would you like to know more about?",
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setMessages((prev) => [...prev, newAiMsg]);
  };

  // Handle saving and closing chat
  const handleSaveAndClose = async () => {
    try {
      console.log('💾 Saving chat...');
      
      // Save the chat session
      const chatId = await saveChatSession({
        messages,
        context,
      });
      
      // Show success message
      Alert.alert(
        '✅ Chat Saved',
        'Your chat history has been saved successfully. You can access it later to review your diagnosis and treatment plan.',
        [
          {
            text: 'Start New Chat',
            onPress: () => {
              // Reset to initial state
              setMessages([
                {
                  role: 'assistant',
                  text: "Hello! I'm your health assistant. Please describe your symptoms, and I'll help you understand what might be happening.",
                  time: new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                },
              ]);
              setContext({});
              setShowSymptomChecklist(false);
              setSymptomChecklistData(null);
              setShowDiagnosisList(false);
              setDiagnosisListData(null);
              setShowDiagnosisDetail(false);
              setDiagnosisDetailData(null);
              setShowDiagnosticTest(false);
              setDiagnosticTestData(null);
              setShowTestResults(false);
              setTestResultsData(null);
            },
          },
          {
            text: 'Keep Current Chat',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('❌ Error saving chat:', error);
      Alert.alert('Error', 'Failed to save chat. Please try again.');
    }
  };

  // Handle confirming injury and continuing to chat
  const handleConfirmInjury = async (diagnosisData) => {
    try {
      console.log('✅ Confirming injury:', diagnosisData);
      
      // Show confirmation dialog with options
      Alert.alert(
        '✅ Confirm Injury',
        `Are you sure you want to confirm "${diagnosisData.diagnosisName || diagnosisData.refinedDiagnosis?.name}" as your injury? You'll be able to chat about your treatment and recovery.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Confirm & Chat',
            onPress: async () => {
              // Update context with confirmed injury
              const confirmedContext = {
                ...context,
                confirmedInjury: {
                  name: diagnosisData.diagnosisName || diagnosisData.refinedDiagnosis?.name,
                  confirmedAt: new Date().toISOString(),
                  diagnosis: diagnosisData,
                  testResults: diagnosisData.testResults || null,
                  confidenceLevel: diagnosisData.confidenceLevel || null,
                },
              };
              
              setContext(confirmedContext);
              
              // Hide all diagnosis views and return to chat
              setShowDiagnosisDetail(false);
              setShowDiagnosticTest(false);
              setShowTestResults(false);
              setShowDiagnosisList(false);
              
              // Add confirmation message to chat
              const confirmationMsg = {
                role: 'assistant',
                text: `Great! I've confirmed your diagnosis: **${diagnosisData.diagnosisName || diagnosisData.refinedDiagnosis?.name}**. 

I'm here to answer any questions you have about:
• Your injury and recovery process
• Treatment recommendations and exercises
• Pain management strategies
• When to seek additional medical care
• Anything else related to your injury

What would you like to know more about?`,
                time: new Date().toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              };
              
              setMessages((prev) => [...prev, confirmationMsg]);
              
              Alert.alert(
                '✅ Injury Confirmed',
                `You can now chat about your ${diagnosisData.diagnosisName || diagnosisData.refinedDiagnosis?.name}. I'll help guide your recovery!`,
                [{ text: 'OK' }]
              );
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ Error confirming injury:', error);
      Alert.alert('Error', 'Failed to confirm injury. Please try again.');
    }
  };

  // Load relevant past injuries when starting a new conversation
  useEffect(() => {
    const loadPastContext = async () => {
      if (context?.currentDetails?.body_part) {
        const pastInjuries = await getRelevantPastInjuries(context.currentDetails.body_part);
        if (pastInjuries.length > 0) {
          console.log('📚 Found relevant past injuries:', pastInjuries);
          // Store in context for AI to use
          setContext(prev => ({
            ...prev,
            pastInjuries,
          }));
        }
      }
    };
    
    loadPastContext();
  }, [context?.currentDetails?.body_part]);

  // Render diagnostic test UI inline based on server response
  const renderDiagnosticTestUI = () => {
    // Use testResultsData if showing results, otherwise use diagnosticTestData
    const data = showTestResults ? testResultsData : diagnosticTestData;
    if (!data) return null;

    const { stage, testSession, currentTest, progress, nextAction, response, analysis } = data;

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
          <Text style={styles.testIntroText}>{diagnosticTestData.introduction ||response}</Text>
          
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
      const nextTestInfo = diagnosticTestData.nextTest;
      
      return (
        <ScrollView style={styles.testContainer} contentContainerStyle={styles.testContent}>
          <View style={styles.completionHeader}>
            <View style={styles.completionIcon}>
              <Text style={styles.completionCheckmark}>✓</Text>
            </View>
            <Text style={styles.completionTitle}>Test Completed!</Text>
          </View>
          
          <View style={styles.transitionCard}>
            <Text style={styles.transitionText}>{response}</Text>
          </View>

          {progress && (
            <View style={styles.progressBar}>
              <View style={[styles.progressBarFill, {
                width: `${(progress.currentTest / progress.totalTests) * 100}%`,
              }]} />
              <Text style={styles.progressLabel}>
                {progress.currentTest} of {progress.totalTests} tests complete
              </Text>
            </View>
          )}

          {nextTestInfo && (
            <View style={styles.nextTestCard}>
              <Text style={styles.nextTestLabel}>🔬 Up Next:</Text>
              <Text style={styles.nextTestName}>{nextTestInfo.name}</Text>
              {nextTestInfo.purpose && (
                <Text style={styles.nextTestPurpose}>{nextTestInfo.purpose}</Text>
              )}
            </View>
          )}

          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => handleTestAction({ action: 'start_test' })}
          >
            <Text style={styles.primaryButtonText}>
              {progress && progress.currentTest < progress.totalTests ? '▶ Start Next Test' : '▶ Continue'}
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

    // DIAGNOSTIC_TEST_STOPPED - Test stopped due to severe pain
    if (stage === 'DIAGNOSTIC_TEST_STOPPED') {
      return (
        <ScrollView style={styles.testContainer} contentContainerStyle={styles.testContent}>
          <View style={styles.completionHeader}>
            <View style={[styles.completionIcon, { backgroundColor: '#FF9800' }]}>
              <Text style={styles.completionCheckmark}>⚠️</Text>
            </View>
            <Text style={styles.completionTitle}>Test Stopped</Text>
          </View>

          <View style={[styles.resultsCard, { borderLeftColor: '#FF9800', borderLeftWidth: 4 }]}>
            <Text style={styles.resultsName}>Safety First</Text>
            <Text style={styles.sectionText}>{data.message || "You've stopped the diagnostic tests."}</Text>
          </View>

          {data.recommendation && (
            <View style={[styles.sectionCard, { backgroundColor: '#FFF3E0' }]}>
              <Text style={[styles.sectionTitle, { color: '#E65100' }]}>⚕️ Important Recommendation</Text>
              <Text style={styles.sectionText}>{data.recommendation}</Text>
            </View>
          )}

          {data.partialResults && data.partialResults.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>📊 Partial Test Results</Text>
              <Text style={styles.sectionText}>Tests completed before stopping: {data.partialResults.length}</Text>
              {data.partialResults.map((result, idx) => (
                <View key={idx} style={{ marginTop: 8 }}>
                  <Text style={styles.bulletText}>• {result.testName}: {result.result}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.decisionSection}>
            <Text style={styles.decisionTitle}>What would you like to do?</Text>
            
            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: '#FF5722', marginBottom: 12 }]}
              onPress={() => {
                // Return to diagnosis detail
                setShowDiagnosticTest(false);
                setShowTestResults(false);
                setShowDiagnosisDetail(true);
              }}
            >
              <Text style={styles.primaryButtonText}>📋 Return to Diagnosis Details</Text>
              <Text style={styles.primaryButtonSubtext}>Review full diagnosis information</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.secondaryButton, { backgroundColor: '#fff', borderWidth: 2, borderColor: '#007AFF' }]}
              onPress={() => {
                // Go back to diagnosis list
                setShowDiagnosticTest(false);
                setShowTestResults(false);
                setShowDiagnosisList(true);
              }}
            >
              <Text style={[styles.secondaryButtonText, { color: '#007AFF' }]}>🔍 Explore Other Diagnoses</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.secondaryButton, { marginTop: 12, backgroundColor: '#4CAF50' }]}
              onPress={() => {
                // Save and start chat
                const diagnosisData = {
                  diagnosisName: context?.currentDetails?.injury_name,
                  partialTestResults: data.partialResults,
                  testStopped: true,
                  stopReason: data.testSession?.stopReason,
                };
                handleConfirmInjury(diagnosisData);
              }}
            >
              <Text style={styles.secondaryButtonText}>💬 Discuss With AI Assistant</Text>
            </TouchableOpacity>
          </View>
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
      
      const handleSaveRefinedDiagnosis = async () => {
        try {
          // Create enriched chat session with test results
          const enrichedContext = {
            ...context,
            refinedDiagnosis: analysis.refinedDiagnosis,
            testResults: data.testResults,
            confidenceLevel: analysis.confidenceLevel,
            completedTests: true,
          };
          
          await saveChatSession({
            messages: [
              ...messages,
              {
                role: 'assistant',
                text: `Test Results: ${analysis.refinedDiagnosis?.name || 'Complete'} - ${analysis.confidenceLevel || 'N/A'} confidence`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ],
            context: enrichedContext,
          });
          
          Alert.alert(
            '✅ Results Saved',
            'Your refined diagnosis and test results have been saved to your history.',
            [{ text: 'OK' }]
          );
        } catch (error) {
          console.error('Error saving refined diagnosis:', error);
          Alert.alert('Error', 'Failed to save results. Please try again.');
        }
      };
      
      return (
        <ScrollView style={styles.testContainer} contentContainerStyle={styles.testContent}>
          <View style={styles.completionHeader}>
            <View style={[styles.completionIcon, { backgroundColor: '#4CAF50' }]}>
              <Text style={styles.completionCheckmark}>🎉</Text>
            </View>
            <Text style={styles.completionTitle}>All Tests Complete!</Text>
          </View>
          
          <View style={styles.resultsCard}>
            <Text style={styles.resultsLabel}>Refined Diagnosis</Text>
            <Text style={styles.resultsName}>{analysis.refinedDiagnosis?.name || analysis.summary || 'Analysis Complete'}</Text>
            {analysis.confidenceLevel && (
              <View style={[styles.confidenceBadge, { 
                backgroundColor: analysis.confidenceLevel === 'high' ? '#4CAF50' : 
                                analysis.confidenceLevel === 'medium' ? '#FF9800' : '#f44336' 
              }]}>
                <Text style={styles.confidenceText}>
                  {analysis.confidenceLevel === 'high' ? '🎯 High Confidence' : 
                   analysis.confidenceLevel === 'medium' ? '⚠️ Moderate Confidence' : 
                   '💭 Lower Confidence'}
                </Text>
              </View>
            )}
          </View>

          {analysis.summary && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>📋 Summary</Text>
              <Text style={styles.sectionText}>{analysis.summary}</Text>
            </View>
          )}

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

          {/* Decision Section */}
          <View style={styles.decisionSection}>
            <Text style={styles.decisionTitle}>What would you like to do?</Text>
            
            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: '#4CAF50', marginBottom: 12 }]}
              onPress={() => {
                // Start chat about this diagnosis
                const diagnosisData = {
                  diagnosisName: analysis.refinedDiagnosis?.name,
                  refinedDiagnosis: analysis.refinedDiagnosis,
                  testResults: data.testResults,
                  confidenceLevel: analysis.confidenceLevel,
                  analysis: analysis,
                };
                handleConfirmInjury(diagnosisData);
              }}
            >
              <Text style={styles.primaryButtonText}>💬 Tell Me About This Diagnosis</Text>
              <Text style={styles.primaryButtonSubtext}>Start a conversation about your injury</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.secondaryButton, { backgroundColor: '#fff', borderWidth: 2, borderColor: '#007AFF' }]}
              onPress={() => {
                // Go back to diagnosis list to explore others
                setShowDiagnosticTest(false);
                setShowTestResults(false);
                setShowDiagnosisList(true);
              }}
            >
              <Text style={[styles.secondaryButtonText, { color: '#007AFF' }]}>� Explore Other Diagnoses</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.secondaryButton, { marginTop: 8 }]}
            onPress={handleSaveRefinedDiagnosis}
          >
            <Text style={styles.secondaryButtonText}>💾 Save Results to History</Text>
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
          isLoading={isLoading}
          onContinueChat={handleContinueChat}
          onSaveAndClose={handleSaveAndClose}
        />
      ) : showDiagnosisDetail && diagnosisDetailData ? (
        <DiagnosisDetail
          diagnosisDetail={diagnosisDetailData.diagnosisDetail}
          onStartDiagnosticTest={handleStartDiagnosticTest}
          onBack={handleBackToDiagnosisList}
          isLoadingTest={isLoading}
          onConfirmInjury={() => {
            const diagnosisWithTests = {
              ...diagnosisDetailData.diagnosisDetail,
              testResults: context.testResultsData?.testResults,
              confidenceLevel: context.testResultsData?.confidenceLevel,
              analysis: context.testResultsData?.analysis,
            };
            handleConfirmInjury(diagnosisWithTests);
          }}
          testResultsData={context.testResultsData}
        />
      ) : showTestResults && testResultsData ? (
        renderDiagnosticTestUI()
      ) : showDiagnosticTest && diagnosticTestData ? (
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
            {isLoading && (
              <View style={styles.loadingMessage}>
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.loadingText}>Thinking...</Text>
                </View>
              </View>
            )}
          </ScrollView>
          <ChatInput input={input} setInput={setInput} onSend={handleSend} disabled={isLoading} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafbfc' },
  chatArea: { padding: 16 },
  // Loading in chat - improved design
  loadingMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 20,
    alignSelf: 'center',
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 150,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
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
    marginBottom: 4,
  },
  nextTestPurpose: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 20,
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
  decisionSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  decisionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
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
  primaryButtonSubtext: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
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
  // New styles for improved UI
  completionHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  completionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  completionCheckmark: {
    fontSize: 48,
    color: '#fff',
  },
  completionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  progressBar: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    height: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    backgroundColor: '#4CAF50',
    height: 8,
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 20,
  },
  nextTestCard: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  nextTestLabel: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '600',
    marginBottom: 4,
  },
  nextTestName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#856404',
  },
});
