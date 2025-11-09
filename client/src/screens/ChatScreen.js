import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';
import SymptomChecklist from '../components/SymptomChecklist';
import DiagnosisList from '../components/DiagnosisList';
import DiagnosisDetail from '../components/DiagnosisDetail';
import { sendChatMessage } from '../api/chatApi';
import { getChatMessages } from '../api/chatHistoryApi';

export default function ChatScreen() {
  const route = useRoute();
  const chatId = route.params?.chatId || null;
  const isNewChat = route.params?.isNewChat || false;
  
  // Only show welcome message for new chats, not when loading existing chat
  const [messages, setMessages] = useState(chatId ? [] : [
    {
      role: 'assistant',
      text: "Hello! I'm your health assistant. Please describe your symptoms, and I'll help you understand what might be happening.",
      time: '06:43 PM',
    },
  ]);
  const [input, setInput] = useState('');
  const [context, setContext] = useState({});
  const [currentChatId, setCurrentChatId] = useState(chatId);
  const [isNewConsultation, setIsNewConsultation] = useState(isNewChat);
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
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingChat, setLoadingChat] = useState(!!chatId);

  // Load existing chat messages if chatId is provided
  useEffect(() => {
    if (chatId) {
      loadChatMessages(chatId);
      setIsNewConsultation(false);
    } else if (isNewChat) {
      // Reset state for new chat
      setMessages([{
        role: 'assistant',
        text: "Hello! I'm your health assistant. Please describe your symptoms, and I'll help you understand what might be happening.",
        time: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      }]);
      setContext({});
      setCurrentChatId(null);
      setIsNewConsultation(true);
      setShowSymptomChecklist(false);
      setShowDiagnosisList(false);
      setShowDiagnosisDetail(false);
      setShowDiagnosticTest(false);
      setShowTestResults(false);
    }
  }, [chatId, isNewChat]);

  const loadChatMessages = async (id) => {
    try {
      setLoadingChat(true);
      const res = await getChatMessages(id);
      if (res.success && res.data && res.data.length > 0) {
        // Convert database messages to chat format
        const chatMessages = res.data.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          text: msg.text,
          time: new Date(msg.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          provenance: msg.metadata?.provenance || null,
          sources: msg.source_docs 
            ? (Array.isArray(msg.source_docs) 
                ? msg.source_docs.map(s => {
                    if (typeof s === 'string') return s;
                    if (s && typeof s === 'object' && s.text) return s.text;
                    if (s && typeof s === 'object') return JSON.stringify(s);
                    return String(s);
                  })
                : typeof msg.source_docs === 'string'
                ? [msg.source_docs]
                : [JSON.stringify(msg.source_docs)])
            : [],
          ragUsed: msg.metadata?.ragUsed || false,
        }));
        
        setMessages(chatMessages);
        
        // Restore context from the last AI message's metadata if available
        const lastAiMsg = res.data.slice().reverse().find(msg => msg.sender === 'ai');
        if (lastAiMsg && lastAiMsg.metadata) {
          // Reconstruct context from metadata
          const restoredContext = {
            stage: lastAiMsg.metadata.stage || 'CONVERSATIONAL',
            diagnosisId: lastAiMsg.metadata.diagnosisId || null,
            diagnosisName: lastAiMsg.metadata.diagnosisName || null,
            currentDetails: lastAiMsg.metadata.currentDetails || {},
            diagnosisDetail: lastAiMsg.metadata.diagnosisDetail || null,
            testSession: lastAiMsg.metadata.testSession || null,
            analysis: lastAiMsg.metadata.analysis || null,
            testResults: lastAiMsg.metadata.testResults || null,
            refinedTreatmentPlan: lastAiMsg.metadata.refinedTreatmentPlan || null,
            // Preserve other metadata fields
            ragUsed: lastAiMsg.metadata.ragUsed || false,
            provenance: lastAiMsg.metadata.provenance || null,
          };
          setContext(restoredContext);
          console.log('✅ Restored context from chat:', restoredContext);
        }
        setCurrentChatId(id);
      } else if (res.success && res.data && res.data.length === 0) {
        // Chat exists but has no messages - show welcome message
        setMessages([{
          role: 'assistant',
          text: "Hello! I'm your health assistant. Please describe your symptoms, and I'll help you understand what might be happening.",
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        }]);
        setCurrentChatId(id);
      }
    } catch (err) {
      console.error('❌ Error loading chat messages:', err);
      // On error, still set the chatId so new messages can be saved
      setCurrentChatId(id);
    } finally {
      setLoadingChat(false);
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
    
    const userMessage = input; // Store before clearing
    setInput('');
    
    // Set loading state with contextual message
    setIsLoading(true);
    setLoadingMessage('Analyzing your symptoms...');

    try {
      console.log('📤 Sending message:', userMessage);
      console.log('📋 Current context:', context);
      
      const res = await sendChatMessage({
        message: userMessage,
        chatHistory: messages,
        currentContext: context,
        chatId: currentChatId, // Include chatId to continue existing chat
        startNewChat: isNewConsultation && !currentChatId, // Start new chat if this is a new consultation
      });
      
      // After first message, this is no longer a new consultation
      if (isNewConsultation) {
        setIsNewConsultation(false);
      }
      
      console.log('📥 Full response:', JSON.stringify(res, null, 2));
      console.log('📥 res.data:', res.data);
      console.log('📥 res.data.data:', res.data?.data);
      
      // Try to access the response data - handle both possible structures
      const responseData = res.data?.data || res.data;
      console.log('📊 Response data:', responseData);
      
      const aiResponse = responseData.response || 'No response';
      
      // Update chatId if it's returned from the server (new chat created)
      if (responseData.chatId) {
        setCurrentChatId(responseData.chatId);
      }
      
      // Update context: use currentContext from response if available, otherwise build from response
      const newContext = responseData.currentContext || {
        stage: responseData.stage,
        currentDetails: responseData.currentDetails || context.currentDetails,
        missingInfo: responseData.missingInfo,
        testSession: responseData.testSession || context.testSession,
        diagnosisId: responseData.diagnosisId || context.diagnosisId,
        diagnosisName: responseData.diagnosisName || context.diagnosisName,
        testResults: responseData.testResults || context.testResults,
        analysis: responseData.analysis || context.analysis,
        refinedTreatmentPlan: responseData.refinedTreatmentPlan || context.refinedTreatmentPlan
      };
      setContext(newContext);
      
      console.log('✅ Updated Context:', newContext);
      console.log('🔍 Checking for symptom checklist:', responseData.symptomChecklist);
      console.log('🔍 Stage:', responseData.stage, 'Substage:', responseData.substage);
      
      // Check if we should show symptom checklist (check both symptomChecklist and substage)
      if (responseData.symptomChecklist || responseData.substage === 'SYMPTOM_CHECKLIST') {
        console.log('✅ Showing symptom checklist');
        setShowSymptomChecklist(true);
        setSymptomChecklistData({
          message: aiResponse,
          symptomCategories: responseData.symptomChecklist || {},
          context: newContext
        });
        // Don't add message to chat when showing symptom checklist - the checklist UI will show the message
        return;
      }
      
      // Only add message to chat if we're not showing symptom checklist
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
      setIsLoading(false);
      setLoadingMessage('');
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
    
    // Set loading state
    setIsLoading(true);
    setLoadingMessage('Generating possible diagnoses...');

    try {
      console.log('📤 Sending selected symptoms:', selectedSymptoms);
      console.log('📋 Current context:', context);
      
      const res = await sendChatMessage({
        message: symptomText,
        chatHistory: messages,
        currentContext: context,
        selectedSymptoms: selectedSymptoms, // Pass the selected symptoms array
        chatId: currentChatId,
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
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleSelectDiagnosis = async (diagnosisId) => {
    console.log('🔍 Selected diagnosis:', diagnosisId);
    
    // Set loading state
    setIsLoading(true);
    setLoadingMessage('Loading diagnosis details...');
    
    try {
      const res = await sendChatMessage({
        message: `Tell me more about ${diagnosisId}`,
        chatHistory: messages,
        currentContext: context,
        diagnosisId: diagnosisId,
        chatId: currentChatId,
      });
      
      const responseData = res.data?.data || res.data;
      console.log('📊 Diagnosis detail response:', responseData);
      
      if (responseData.diagnosisDetail) {
        setShowDiagnosisList(false);
        setShowDiagnosisDetail(true);
        
        // Update context to include diagnosis detail for later use
        const updatedContext = {
          ...context,
          ...responseData.currentContext,
          diagnosisId: diagnosisId,
          diagnosisName: responseData.diagnosisDetail.diagnosisName || diagnosisId,
          diagnosisDetail: responseData.diagnosisDetail
        };
        
        setDiagnosisDetailData({
          diagnosisDetail: responseData.diagnosisDetail,
          diagnosisId: diagnosisId,
          context: updatedContext
        });
        setContext(updatedContext);
      }
    } catch (err) {
      console.error('❌ Error fetching diagnosis detail:', err);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleStartDiagnosticTest = async () => {
    console.log('🧪 Starting diagnostic test');
    
    // Set loading state
    setIsLoading(true);
    setLoadingMessage('Preparing diagnostic tests...');
    
    try {
      const res = await sendChatMessage({
        message: 'Start diagnostic tests',
        chatHistory: messages,
        currentContext: context,
        startDiagnosticTest: true,
        chatId: currentChatId,
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
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
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
    
    // Only show loading for test result submissions and start_test, not for next_step
    const shouldShowLoading = testResponse.action === 'submit_result' || testResponse.action === 'start_test' || testResponse.action === 'stop_test';
    
    if (shouldShowLoading) {
      setIsLoading(true);
      setLoadingMessage(testResponse.action === 'start_test' ? 'Loading test...' : 'Processing test result...');
    }
    
    try {
      const res = await sendChatMessage({
        message: `Test action: ${testResponse.action}`,
        chatHistory: messages,
        currentContext: context,
        testResponse: testResponse,
        chatId: currentChatId,
      });
      
      const responseData = res.data?.data || res.data;
      console.log('📊 Test action response:', responseData);
      
      // Update context with new test session data
      const newContext = responseData.currentContext || {
        ...context,
        testSession: responseData.testSession || context.testSession,
        diagnosisId: responseData.diagnosisId || context.diagnosisId,
        analysis: responseData.analysis || context.analysis,
        testResults: responseData.testResults || context.testResults
      };
      setContext(newContext);
      
      // Handle different response stages
      if (responseData.stage === 'DIAGNOSTIC_TEST_COMPLETE') {
        // Tests are complete, show results
        // Update both diagnosticTestData and testResultsData for consistency
        setDiagnosticTestData(responseData);
        setTestResultsData(responseData);
        setShowDiagnosticTest(true);
        setShowTestResults(true);
        // Update context with complete test data
        setContext({
          ...newContext,
          testSession: {
            ...newContext.testSession,
            diagnosisId: responseData.diagnosisId,
            testResults: responseData.testResults,
            analysis: responseData.analysis
          }
        });
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
      if (shouldShowLoading) {
        setIsLoading(false);
        setLoadingMessage('');
      }
    }
  };

  const handleStartTreatmentChat = async () => {
    console.log('💬 Starting treatment chat');
    setIsLoading(true);
    setLoadingMessage('Starting treatment chat...');
    
    try {
      // Get diagnostic test data from whichever source has it
      const testData = diagnosticTestData || testResultsData || {};
      const testAnalysis = testData.analysis || {};
      const testResults = testData.testResults || [];
      const testDiagnosisId = testData.diagnosisId || context.diagnosisId;
      
      // Store the current diagnostic test data in context before transitioning
      const enhancedContext = {
        ...context,
        diagnosisId: testDiagnosisId,
        testResults: testResults,
        analysis: testAnalysis,
        refinedTreatmentPlan: testAnalysis.refinedTreatmentPlan || {},
        testSession: {
          ...context.testSession,
          diagnosisId: testDiagnosisId,
          testResults: testResults,
          analysis: testAnalysis
        }
      };
      
      console.log('📋 Enhanced context for treatment chat:', enhancedContext);
      
      const res = await sendChatMessage({
        message: 'Tell me more about my treatment plan',
        chatHistory: messages,
        currentContext: enhancedContext,
        startTreatmentChat: true,
        chatId: currentChatId,
      });
      
      const responseData = res.data?.data || res.data;
      console.log('📊 Treatment chat response:', responseData);
      
      // Hide diagnostic test UI and show chat
      setShowDiagnosticTest(false);
      setShowTestResults(false);
      setShowDiagnosisList(false);
      setShowDiagnosisDetail(false);
      
      // Add the treatment plan as the first message in chat
      const treatmentPlanMessage = {
        role: 'assistant',
        text: responseData.response || 'Here is your treatment plan...',
        time: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        provenance: responseData.provenance || null,
        sources: responseData.sources ? (typeof responseData.sources === 'string' ? responseData.sources.split('\n').filter(s => s.trim()) : responseData.sources) : [],
        ragUsed: responseData.ragUsed || false,
      };
      
      // Update messages with treatment plan
      setMessages((prev) => [...prev, treatmentPlanMessage]);
      
      // Update context for follow-up questions - preserve all treatment chat context
      const newContext = responseData.currentContext || {
        ...enhancedContext,
        stage: responseData.stage || 'TREATMENT_CHAT',
        diagnosisName: responseData.diagnosisName || enhancedContext.diagnosisName,
        currentDetails: responseData.currentDetails || enhancedContext.currentDetails
      };
      setContext(newContext);
      
      console.log('✅ Updated context for treatment chat:', newContext);
    } catch (err) {
      console.error('❌ Error starting treatment chat:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Sorry, I encountered an error. Please try again.',
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleBackToDiagnosisList = () => {
    setShowDiagnosisDetail(false);
    setShowDiagnosisList(true);
  };

  const handleConfirmInjury = async () => {
    console.log('✅ Confirming injury');
    setIsLoading(true);
    setLoadingMessage('Confirming diagnosis...');
    
    try {
      // Get diagnosis ID and details from the diagnosis detail data
      const diagnosisId = diagnosisDetailData?.diagnosisId || context.diagnosisId;
      const diagnosisDetail = diagnosisDetailData?.diagnosisDetail || {};
      const diagnosisName = diagnosisDetail.diagnosisName || diagnosisId;
      
      // Build enhanced context with confirmed diagnosis
      const enhancedContext = {
        ...context,
        diagnosisId: diagnosisId,
        diagnosisName: diagnosisName,
        confirmedDiagnosis: true,
        diagnosisDetail: diagnosisDetail,
        currentDetails: {
          ...context.currentDetails,
          diagnosisId: diagnosisId,
          diagnosisName: diagnosisName,
          confirmedDiagnosis: true
        }
      };
      
      console.log('📋 Enhanced context for confirmed injury:', enhancedContext);
      
      const res = await sendChatMessage({
        message: `I confirm I have ${diagnosisName}`,
        chatHistory: messages,
        currentContext: enhancedContext,
        confirmInjury: true,
        diagnosisId: diagnosisId,
        chatId: currentChatId,
      });
      
      const responseData = res.data?.data || res.data;
      console.log('📊 Confirm injury response:', responseData);
      
      // Hide diagnosis detail UI and show chat
      setShowDiagnosisDetail(false);
      setShowDiagnosisList(false);
      setShowSymptomChecklist(false);
      
      // Add a user message confirming the injury
      const confirmMessage = {
        role: 'user',
        text: `I confirm I have ${diagnosisName}`,
        time: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setMessages((prev) => [...prev, confirmMessage]);
      
      // Add the assistant's response
      const assistantResponse = {
        role: 'assistant',
        text: responseData.response || `Got it! I've noted that you have ${diagnosisName}. How can I help you with your treatment and recovery?`,
        time: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        provenance: responseData.provenance || null,
        sources: responseData.sources ? (typeof responseData.sources === 'string' ? responseData.sources.split('\n') : responseData.sources) : [],
        ragUsed: responseData.ragUsed || false,
      };
      setMessages((prev) => [...prev, assistantResponse]);
      
      // Update context for follow-up questions
      const newContext = responseData.currentContext || {
        ...enhancedContext,
        stage: responseData.stage || 'CONFIRMED_INJURY_CHAT',
        diagnosisName: responseData.diagnosisName || diagnosisName,
        currentDetails: responseData.currentDetails || enhancedContext.currentDetails
      };
      setContext(newContext);
      
      console.log('✅ Updated context for confirmed injury chat:', newContext);
    } catch (err) {
      console.error('❌ Error confirming injury:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Sorry, I encountered an error. Please try again.',
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
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
          <Text style={styles.loadingText}>{loadingMessage || 'Loading...'}</Text>
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
          {/* Test Progress Header */}
          {progress && (
            <View style={styles.testProgressHeader}>
              <View style={styles.progressTextContainer}>
                <Text style={styles.progressMainText}>
                  Test {progress.currentTest} of {progress.totalTests}
                </Text>
                <Text style={styles.progressSubText}>
                  Step {progress.currentStep} of {progress.totalSteps}
                </Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { width: `${(progress.currentStep / progress.totalSteps) * 100}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.progressPercentText}>
                  {Math.round((progress.currentStep / progress.totalSteps) * 100)}%
                </Text>
              </View>
            </View>
          )}
          
          {/* Test Name Badge */}
          <View style={styles.testNameBadge}>
            <Text style={styles.testNameBadgeIcon}>🔬</Text>
            <Text style={styles.testNameBadgeText}>{currentTest?.name || 'Diagnostic Test'}</Text>
          </View>

          {/* Step Instructions Card */}
          <View style={styles.stepInstructionsCard}>
            <View style={styles.stepIconContainer}>
              <Text style={styles.stepIcon}>📋</Text>
            </View>
            <Text style={styles.stepInstructionsTitle}>Instructions</Text>
            <Text style={styles.stepInstructionsText}>{response}</Text>
          </View>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerIcon}>💡</Text>
            <Text style={styles.infoBannerText}>
              Take your time with each step. Stop immediately if you experience sharp or severe pain.
            </Text>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => handleTestAction({ action: 'next_step' })}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Continue to Next Step →</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.dangerButton}
            onPress={() => handleTestAction({ action: 'stop_test', reason: 'severe_pain' })}
            activeOpacity={0.8}
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
      const completedTest = testSession?.testResults?.[testSession.testResults.length - 1];
      const completedTestNumber = progress?.currentTest - 1 || 1;
      const allCompletedTests = testSession?.testResults || [];
      
      return (
        <ScrollView style={styles.testContainer} contentContainerStyle={styles.testContent}>
          {/* Header with checkmark */}
          <View style={styles.completionHeaderContainer}>
            <View style={styles.checkmarkIcon}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
            <Text style={styles.completionTitle}>Test {completedTestNumber} Completed</Text>
          </View>
          
          {/* Completed Test Details Card */}
          {completedTest && (
            <View style={styles.testResultDetailCard}>
              <Text style={styles.testResultCardTitle}>{completedTest.testName || 'Test'}</Text>
              
              <View style={styles.resultBadgeContainer}>
                <View style={[
                  styles.resultBadgeLarge,
                  { backgroundColor: completedTest.result === 'positive' ? '#4CAF50' : 
                                    completedTest.result === 'negative' ? '#9E9E9E' : '#FF9800' }
                ]}>
                  <Text style={styles.resultBadgeLargeText}>
                    Result: {completedTest.result ? completedTest.result.toUpperCase() : 'N/A'}
                  </Text>
                </View>
              </View>

              {completedTest.painLevel && (
                <View style={styles.painLevelContainer}>
                  <Text style={styles.painLevelLabel}>Pain Level During Test:</Text>
                  <View style={styles.painLevelBar}>
                    <View style={[
                      styles.painLevelFill,
                      { 
                        width: `${(completedTest.painLevel / 10) * 100}%`,
                        backgroundColor: completedTest.painLevel > 7 ? '#f44336' : 
                                       completedTest.painLevel > 4 ? '#FF9800' : '#4CAF50'
                      }
                    ]} />
                  </View>
                  <Text style={styles.painLevelValue}>{completedTest.painLevel}/10</Text>
                </View>
              )}
            </View>
          )}

          {/* Progress Summary */}
          {progress && (
            <View style={styles.progressSummaryCard}>
              <Text style={styles.progressSummaryTitle}>Testing Progress</Text>
              <View style={styles.progressSummaryRow}>
                <View style={styles.progressSummaryItem}>
                  <Text style={styles.progressSummaryNumber}>{completedTestNumber}</Text>
                  <Text style={styles.progressSummaryLabel}>Completed</Text>
                </View>
                <View style={styles.progressSummaryDivider} />
                <View style={styles.progressSummaryItem}>
                  <Text style={styles.progressSummaryNumber}>{progress.totalTests - completedTestNumber}</Text>
                  <Text style={styles.progressSummaryLabel}>Remaining</Text>
                </View>
                <View style={styles.progressSummaryDivider} />
                <View style={styles.progressSummaryItem}>
                  <Text style={styles.progressSummaryNumber}>{progress.totalTests}</Text>
                  <Text style={styles.progressSummaryLabel}>Total Tests</Text>
                </View>
              </View>
            </View>
          )}

          {/* AI Response/Interpretation */}
          {response && (
            <View style={styles.aiInterpretationCard}>
              <Text style={styles.aiInterpretationTitle}>� What This Means</Text>
              <Text style={styles.aiInterpretationText}>{response}</Text>
            </View>
          )}

          {/* Next Test Preview */}
          {progress && progress.currentTest <= progress.totalTests && (
            <View style={styles.nextTestPreviewCard}>
              <Text style={styles.nextTestPreviewTitle}>📋 Coming Up Next</Text>
              <Text style={styles.nextTestPreviewName}>{nextAction?.nextTest || 'Loading next test...'}</Text>
              <Text style={styles.nextTestPreviewSubtext}>Test {progress.currentTest} of {progress.totalTests}</Text>
            </View>
          )}

          {/* Action Buttons */}
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => handleTestAction({ action: 'start_test' })}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>
              {progress && progress.currentTest <= progress.totalTests ? '▶ Continue to Next Test' : '✓ View Results'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => handleTestAction({ action: 'exit_test' })}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Exit Testing</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    // DIAGNOSTIC_TEST_STOPPED - User stopped due to pain
    if (stage === 'DIAGNOSTIC_TEST_STOPPED') {
      const stoppedTest = testSession?.testResults?.[testSession.testResults.length - 1];
      const completedTests = testSession?.testResults?.filter(t => t.result !== 'stopped') || [];
      
      return (
        <ScrollView style={styles.testContainer} contentContainerStyle={styles.testContent}>
          {/* Warning Header */}
          <View style={styles.stoppedHeaderContainer}>
            <View style={styles.warningIconContainer}>
              <Text style={styles.warningIcon}>⚠️</Text>
            </View>
            <Text style={styles.stoppedTitle}>Test Stopped</Text>
          </View>

          {/* Stopped Test Info */}
          {stoppedTest && (
            <View style={styles.stoppedTestInfoCard}>
              <Text style={styles.stoppedTestName}>{stoppedTest.testName || 'Current Test'}</Text>
              <View style={styles.stoppedReasonBadge}>
                <Text style={styles.stoppedReasonText}>Stopped: Severe Pain</Text>
              </View>
              {stoppedTest.painLevel && (
                <View style={styles.stoppedPainInfo}>
                  <Text style={styles.stoppedPainLabel}>Pain Level:</Text>
                  <Text style={styles.stoppedPainValue}>{stoppedTest.painLevel}/10</Text>
                </View>
              )}
            </View>
          )}
          
          {/* AI Response with Safety Message */}
          <View style={styles.stoppedMessageCard}>
            <Text style={styles.stoppedMessageTitle}>What Happened</Text>
            <Text style={styles.stoppedMessageText}>
              {response || "You stopped the test due to severe pain. This is important information that helps us understand your injury better."}
            </Text>
          </View>

          {/* Safety Information */}
          <View style={styles.stoppedSafetyCard}>
            <Text style={styles.stoppedSafetyTitle}>⚕️ Important Safety Information</Text>
            <View style={styles.stoppedSafetyItem}>
              <Text style={styles.stoppedSafetyBullet}>•</Text>
              <Text style={styles.stoppedSafetyText}>
                Stopping due to pain was the right decision
              </Text>
            </View>
            <View style={styles.stoppedSafetyItem}>
              <Text style={styles.stoppedSafetyBullet}>•</Text>
              <Text style={styles.stoppedSafetyText}>
                This reaction indicates your injury may need professional evaluation
              </Text>
            </View>
            <View style={styles.stoppedSafetyItem}>
              <Text style={styles.stoppedSafetyBullet}>•</Text>
              <Text style={styles.stoppedSafetyText}>
                We'll use the completed tests to provide guidance
              </Text>
            </View>
          </View>

          {/* Summary of Completed Tests */}
          {completedTests.length > 0 && (
            <View style={styles.completedTestsSummaryCard}>
              <Text style={styles.completedTestsSummaryTitle}>Tests Completed: {completedTests.length}</Text>
              {completedTests.map((test, idx) => (
                <View key={idx} style={styles.completedTestSummaryItem}>
                  <Text style={styles.completedTestSummaryName}>✓ {test.testName}</Text>
                  <Text style={styles.completedTestSummaryResult}>{test.result?.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => {
              setShowDiagnosticTest(false);
              setShowDiagnosisDetail(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>← Back to Diagnosis Details</Text>
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
          <Text style={styles.testTitle}>✅ All Tests Complete!</Text>
          
          <View style={styles.completionCard}>
            <Text style={styles.completionMessage}>
              Great work! You've completed all the diagnostic tests. 
              {'\n\n'}
              Based on your responses, we now have a clearer understanding of your condition.
            </Text>
          </View>
          
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

          <View style={styles.actionPromptCard}>
            <Text style={styles.actionPromptText}>What would you like to do next?</Text>
          </View>

          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={handleStartTreatmentChat}
          >
            <Text style={styles.primaryButtonText}>✅ Continue - Learn About Treatment</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => {
              setShowDiagnosticTest(false);
              setShowTestResults(false);
              setShowDiagnosisDetail(true);
            }}
          >
            <Text style={styles.secondaryButtonText}>← Go Back to Diagnosis Details</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.dangerButton}
            onPress={() => {
              // Exit tests and go back to diagnosis detail
              setShowDiagnosticTest(false);
              setShowTestResults(false);
              setShowDiagnosisDetail(true);
            }}
          >
            <Text style={styles.dangerButtonText}>⚠️ Pain Too Severe - Stop Here</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    return null;
  };

  // Show loading state while loading chat history
  if (loadingChat) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading conversation...</Text>
        </View>
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
        <>
          <DiagnosisList
            diagnoses={diagnosisListData.diagnoses}
            summary={diagnosisListData.summary}
            immediateAdvice={diagnosisListData.immediateAdvice}
            onSelectDiagnosis={handleSelectDiagnosis}
          />
          {isLoading && (
            <View style={styles.fullScreenLoadingOverlay}>
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>{loadingMessage || 'Loading...'}</Text>
              </View>
            </View>
          )}
        </>
      ) : showDiagnosisDetail && diagnosisDetailData ? (
        <>
          <DiagnosisDetail
            diagnosisDetail={diagnosisDetailData.diagnosisDetail}
            onStartDiagnosticTest={handleStartDiagnosticTest}
            onBack={handleBackToDiagnosisList}
            onConfirmInjury={handleConfirmInjury}
          />
          {isLoading && (
            <View style={styles.fullScreenLoadingOverlay}>
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>{loadingMessage || 'Loading...'}</Text>
              </View>
            </View>
          )}
        </>
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
                 provenance={msg.provenance}
                 sources={msg.sources}
                 ragUsed={msg.ragUsed}
               />
             ))}
             {isLoading && (
               <View style={styles.loadingBubble}>
                 <ActivityIndicator size="small" color="#007AFF" />
                 <Text style={styles.loadingBubbleText}>{loadingMessage || 'Processing...'}</Text>
               </View>
             )}
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
  // Loading Bubble
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f4fd',
    padding: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
    maxWidth: '70%',
    marginVertical: 4,
  },
  loadingBubbleText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
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
  fullScreenLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
  // New Test Step Styles
  testProgressHeader: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressTextContainer: {
    marginBottom: 16,
  },
  progressMainText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  progressSubText: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBarBackground: {
    flex: 1,
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 6,
  },
  progressPercentText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    minWidth: 45,
    textAlign: 'right',
  },
  testNameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    alignSelf: 'center',
    marginBottom: 24,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  testNameBadgeIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  testNameBadgeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1565C0',
  },
  stepInstructionsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  stepIconContainer: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  stepIcon: {
    fontSize: 32,
  },
  stepInstructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  stepInstructionsText: {
    fontSize: 16,
    color: '#34495e',
    lineHeight: 24,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  infoBannerIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#2e7d32',
    lineHeight: 20,
    fontWeight: '500',
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
  completedTestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  completedTestName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  completedResultBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  completedResultText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  nextTestCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  nextTestLabel: {
    fontSize: 14,
    color: '#1565C0',
    fontWeight: '600',
    marginBottom: 4,
  },
  nextTestName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0d47a1',
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
  // Enhanced Test Transition Styles
  completionHeaderContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  checkmarkIcon: {
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
    elevation: 6,
  },
  checkmarkText: {
    fontSize: 48,
    color: '#fff',
    fontWeight: 'bold',
  },
  completionTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  testResultDetailCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  testResultCardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  resultBadgeContainer: {
    marginBottom: 16,
  },
  resultBadgeLarge: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  resultBadgeLargeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  painLevelContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  painLevelLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
    fontWeight: '500',
  },
  painLevelBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  painLevelFill: {
    height: '100%',
    borderRadius: 4,
  },
  painLevelValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'right',
  },
  progressSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  progressSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  progressSummaryItem: {
    alignItems: 'center',
  },
  progressSummaryNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  progressSummaryLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  progressSummaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
  },
  aiInterpretationCard: {
    backgroundColor: '#e8f5e9',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  aiInterpretationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 12,
  },
  aiInterpretationText: {
    fontSize: 15,
    color: '#1b5e20',
    lineHeight: 22,
  },
  nextTestPreviewCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  nextTestPreviewTitle: {
    fontSize: 14,
    color: '#1565C0',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  nextTestPreviewName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0d47a1',
    marginBottom: 4,
  },
  nextTestPreviewSubtext: {
    fontSize: 14,
    color: '#1976D2',
  },
  // Enhanced Test Stopped Styles
  stoppedHeaderContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  warningIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFC107',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#FFC107',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  warningIcon: {
    fontSize: 48,
  },
  stoppedTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  stoppedTestInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#FFC107',
  },
  stoppedTestName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  stoppedReasonBadge: {
    backgroundColor: '#f44336',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  stoppedReasonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  stoppedPainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
  },
  stoppedPainLabel: {
    fontSize: 14,
    color: '#c62828',
    marginRight: 8,
    fontWeight: '500',
  },
  stoppedPainValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#c62828',
  },
  stoppedMessageCard: {
    backgroundColor: '#fff3e0',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  stoppedMessageTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e65100',
    marginBottom: 12,
  },
  stoppedMessageText: {
    fontSize: 15,
    color: '#e65100',
    lineHeight: 22,
  },
  stoppedSafetyCard: {
    backgroundColor: '#e8f5e9',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  stoppedSafetyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 16,
  },
  stoppedSafetyItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  stoppedSafetyBullet: {
    fontSize: 16,
    color: '#4CAF50',
    marginRight: 8,
    fontWeight: 'bold',
  },
  stoppedSafetyText: {
    flex: 1,
    fontSize: 14,
    color: '#1b5e20',
    lineHeight: 20,
  },
  completedTestsSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  completedTestsSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  completedTestSummaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  completedTestSummaryName: {
    fontSize: 14,
    color: '#2c3e50',
    flex: 1,
  },
  completedTestSummaryResult: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4CAF50',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completionCard: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  completionMessage: {
    fontSize: 16,
    color: '#2e7d32',
    lineHeight: 24,
    textAlign: 'center',
  },
  actionPromptCard: {
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  actionPromptText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e65100',
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
