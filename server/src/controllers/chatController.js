// server/src/controllers/chatController.js
import { queryRAG } from "../services/ragService.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

/**
 * Main chat handler - supports multi-step conversational flow
 * 
 * Flow stages:
 * 1. GATHERING_INFO - Collecting missing details about the injury/condition
 * 2. DIAGNOSIS_LIST - Present possible diagnoses with confidence levels
 * 3. DIAGNOSIS_DETAIL - Show detailed info for a specific diagnosis (triggered by diagnosisId)
 * 4. DIAGNOSTIC_TEST - Interactive guided diagnostic testing (triggered by startDiagnosticTest)
 * 5. GENERAL - Handle off-topic queries
 */
export async function handleChat(req, res) {
  try {
    const { 
   message, chatHistory = [], currentContext = {},  diagnosisId = null,
  startDiagnosticTest = false,
  testResponse = null,
  exitDiagnosticTest = false,
  selectedSymptoms = null
    } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: "Message is required" });
    }

    console.log("🗣️ Received:", message);
    console.log("📋 Current Context:", currentContext);
    console.log("🔍 Diagnosis ID:", diagnosisId);
    console.log("🧪 Start Diagnostic Test:", startDiagnosticTest);
    console.log("📝 Test Response:", testResponse);
    console.log("🚪 Exit Diagnostic Test:", exitDiagnosticTest);
    console.log("✅ Selected Symptoms:", selectedSymptoms);
    
    let response;
    
    // If user wants to exit diagnostic testing and return to diagnosis detail
    if (exitDiagnosticTest) {
      const exitDiagnosisId = currentContext.testSession?.diagnosisId || diagnosisId;
      response = await handleDiagnosisDetail(exitDiagnosisId, currentContext, "Return to diagnosis details");
      response.returnedFromTest = true;
      response.message = "You've exited the diagnostic tests and returned to the diagnosis details.";
    }
    // If user submitted symptom checklist, process it and move forward
    else if (selectedSymptoms !== null) {
      response = await handleSymptomSubmission(selectedSymptoms, currentContext, message, chatHistory);
    }
    // If user is in the middle of diagnostic testing
    else if (testResponse !== null) {
      response = await handleDiagnosticTestResponse(testResponse, currentContext);
    }
    // If user wants to start diagnostic tests
    else if (startDiagnosticTest) {
      response = await initiateDiagnosticTests(diagnosisId, currentContext);
    }
    // If diagnosisId is provided, user clicked on a diagnosis - show detailed info
    else if (diagnosisId) {
      response = await handleDiagnosisDetail(diagnosisId, currentContext, message);
    } else {
      // Step 1: Classify the input type (injury vs general health)
      const classification = await classifyInput(message, chatHistory);
      console.log("📊 Classification:", classification.type);
      
      if (classification.type === "injury") {
        // Handle musculoskeletal injury query with flow-based approach
        response = await handleInjuryFlow(message, classification.details, chatHistory, currentContext);
      } else if (classification.type === "general_health") {
        // Handle general health/illness query
        response = await handleGeneralHealthQuery(message, classification.details, chatHistory);
      } else {
        // Handle off-topic or unclear queries
        response = await handleGeneralQuery(message, chatHistory);
      }
    }
    
    // Log interaction for analysis
    logInteraction(message, response);
    
    // Console log the full response for testing
    console.log("🤖 AI Response:", JSON.stringify(response, null, 2));
    
    res.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error("❌ Error in handleChat:", err);
    res.status(500).json({ 
      success: false,
      error: "Failed to process your message. Please try again." 
    });
  }
}

/**
 * Classify whether input is about musculoskeletal injuries or general health
 */
async function classifyInput(message, chatHistory = []) {
  const historyContext = chatHistory.length > 0 
    ? `\n\nChat History:\n${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
    : '';
    
  const prompt = `Analyze this health-related message and classify it:

Message: "${message}"${historyContext}

Determine if this is about:
1. INJURY - Musculoskeletal injuries (sprains, strains, fractures, joint pain, sports injuries, muscle injuries, etc.)
2. GENERAL_HEALTH - General illnesses, infections, allergies, or non-musculoskeletal conditions
3. OTHER - Unrelated to health

Also extract relevant details based on the type.

Respond in JSON format:
{
  "type": "injury" | "general_health" | "other",
  "details": {
    "injury_name": "string (if injury)",
    "body_part": "string",
    "symptoms": ["array of symptoms"],
    "severity": "mild|moderate|severe|unknown",
    "duration": "string (e.g., 'just happened', '2 days', 'chronic')",
    "context": "string (athlete, work-related, daily activity, etc.)",
    "mechanism": "string (how injury occurred, if mentioned)",
    "medical_history": "string (if mentioned)"
  }
}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn("Failed to parse classification JSON");
  }
  
  return { type: "other", details: {} };
}

/**
 * Handle musculoskeletal injury queries with conversational flow
 * Stage 1: Gather missing information
 * Stage 2: Present diagnosis list
 */
async function handleInjuryFlow(message, details, chatHistory, currentContext) {
  const { injury_name, body_part, symptoms, severity, duration, context, mechanism, medical_history } = details;
  
  // Determine what information is missing
  const missingInfo = [];
  if (!body_part || body_part === 'Not specified') missingInfo.push('body_part');
  if (!symptoms || symptoms.length === 0) missingInfo.push('symptoms');
  if (!duration || duration === 'Not specified') missingInfo.push('duration');
  if (!context || context === 'Not specified') missingInfo.push('context');
  if (!mechanism || mechanism === 'Not specified') missingInfo.push('mechanism');
  
  // STAGE 1: GATHERING_INFO - If critical information is missing, ask for it
  if (missingInfo.length > 0 && !currentContext.infoGathered) {
    return await gatherMissingInfo(message, details, missingInfo);
  }
  
  // STAGE 2: DIAGNOSIS_LIST - Present possible diagnoses
  return await generateDiagnosisList(message, details, chatHistory);
}

/**
 * STAGE 1: Gather missing information from the user
 */
async function gatherMissingInfo(message, details, missingInfo) {
  // If symptoms are missing, provide structured symptom checklist
  if (missingInfo.includes('symptoms')) {
    return await getSymptomChecklist(message, details, missingInfo);
  }
  
  // For other missing info, ask conversational questions
  const prompt = `You are HealthBay, an AI rehabilitation assistant. The user has reported an injury, but we need more details.

User's current information:
- Injury: ${details.injury_name || 'Unknown'}
- Body Part: ${details.body_part || 'Not specified'}
- Symptoms: ${details.symptoms?.join(', ') || 'Not specified'}
- Severity: ${details.severity || 'Unknown'}
- Duration: ${details.duration || 'Not specified'}
- Context: ${details.context || 'Not specified'}
- Mechanism: ${details.mechanism || 'Not specified'}

User's message: "${message}"

Missing information: ${missingInfo.join(', ')}

Generate 2-4 specific questions to gather the missing information. Be conversational and empathetic.
Ask about the most critical missing information first (mechanism, duration, severity).

Format your response as a friendly message that:
1. Acknowledges what they've told you
2. Explains you need a bit more detail to provide accurate guidance
3. Asks the specific questions

Keep it concise and natural.`;

  const result = await model.generateContent(prompt);
  const aiResponse = result.response.text();
  
  return {
    stage: "GATHERING_INFO",
    type: "injury",
    response: aiResponse,
    missingInfo: missingInfo,
    currentDetails: details,
    nextAction: "answer_questions",
    uiHint: "Show text input for user to answer questions"
  };
}

/**
 * Generate symptom checklist based on body part
 */
async function getSymptomChecklist(message, details, missingInfo) {
  const bodyPart = details.body_part?.toLowerCase() || 'general';
  
  // Get AI to generate relevant symptoms for the specific body part
  const prompt = `You are HealthBay. The user has an injury to their ${bodyPart}.

Generate a comprehensive list of common symptoms for ${bodyPart} injuries that a user might experience.
Include both common and less common symptoms to ensure comprehensive diagnosis.

Return ONLY a JSON object with this structure:
{
  "message": "Brief empathetic message (1-2 sentences) asking them to check off their symptoms",
  "symptomCategories": {
    "pain": {
      "label": "Pain Characteristics",
      "symptoms": ["Sharp pain", "Dull ache", "Throbbing pain", "Burning sensation", "Stabbing pain"]
    },
    "mobility": {
      "label": "Movement Issues",
      "symptoms": ["Limited range of motion", "Stiffness", "Unable to bear weight", "Difficulty moving", "Clicking/popping"]
    },
    "appearance": {
      "label": "Visual Changes",
      "symptoms": ["Swelling", "Bruising", "Redness", "Deformity", "Discoloration"]
    },
    "sensation": {
      "label": "Sensory Changes",
      "symptoms": ["Numbness", "Tingling", "Weakness", "Instability", "Loss of sensation"]
    },
    "functional": {
      "label": "Functional Impact",
      "symptoms": ["Difficulty with daily activities", "Cannot perform sport/activity", "Sleep disruption", "Affects work"]
    }
  }
}

Customize the symptoms to be specific and relevant for ${bodyPart} injuries.`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  let symptomData;
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      symptomData = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Fallback to generic symptoms
    symptomData = {
      message: `I'd like to understand your symptoms better. Please check all that apply to your ${bodyPart} injury:`,
      symptomCategories: {
        pain: {
          label: "Pain Characteristics",
          symptoms: ["Sharp pain", "Dull ache", "Throbbing pain", "Burning sensation", "Stabbing pain"]
        },
        mobility: {
          label: "Movement Issues",
          symptoms: ["Limited range of motion", "Stiffness", "Unable to bear weight", "Difficulty moving"]
        },
        appearance: {
          label: "Visual Changes",
          symptoms: ["Swelling", "Bruising", "Redness", "Deformity"]
        },
        sensation: {
          label: "Sensory Changes",
          symptoms: ["Numbness", "Tingling", "Weakness", "Instability"]
        }
      }
    };
  }
  
  return {
    stage: "GATHERING_INFO",
    substage: "SYMPTOM_CHECKLIST",
    type: "injury",
    response: symptomData.message,
    symptomChecklist: symptomData.symptomCategories,
    missingInfo: missingInfo.filter(info => info !== 'symptoms'),
    currentDetails: details,
    nextAction: "select_symptoms",
    uiHint: "Show checkbox list organized by categories with 'Other' text input field at bottom",
    hasOtherOption: true,
    otherLabel: "Other symptoms not listed:"
  };
}

/**
 * Handle symptom checklist submission
 */
async function handleSymptomSubmission(selectedSymptoms, currentContext, message, chatHistory) {
  // Merge selected symptoms with current details
  const updatedDetails = {
    ...currentContext.currentDetails,
    symptoms: selectedSymptoms
  };
  
  // Check if there's still other missing info
  const { body_part, duration, context, mechanism } = updatedDetails;
  const missingInfo = [];
  if (!duration || duration === 'Not specified') missingInfo.push('duration');
  if (!context || context === 'Not specified') missingInfo.push('context');
  if (!mechanism || mechanism === 'Not specified') missingInfo.push('mechanism');
  
  // If other critical info is still missing, ask for it
  if (missingInfo.length > 0) {
    return await gatherMissingInfo(message, updatedDetails, missingInfo);
  }
  
  // All info gathered, proceed to diagnosis list
  return await generateDiagnosisList(message, updatedDetails, chatHistory);
}

/**
 * STAGE 2: Generate list of possible diagnoses with confidence levels
 */
async function generateDiagnosisList(message, details, chatHistory) {
  const { injury_name, body_part, symptoms, severity, duration, context, mechanism } = details;
  
  // Get relevant rehab documentation from RAG (gracefully handle DB errors)
  let ragContext;
  try {
    ragContext = await queryRAG(message);
  } catch (err) {
    console.warn("⚠️ RAG service unavailable:", err.message);
    ragContext = null;
  }
  
  const prompt = `You are HealthBay, an AI rehabilitation assistant specializing in musculoskeletal injuries.

User's injury information:
- Injury: ${injury_name || 'Unknown'}
- Body Part: ${body_part || 'Not specified'}
- Symptoms: ${symptoms?.join(', ') || 'Not specified'}
- Severity: ${severity || 'Unknown'}
- Duration: ${duration || 'Not specified'}
- Context: ${context || 'Not specified'}
- Mechanism: ${mechanism || 'Not specified'}

Rehabilitation documentation context:
${ragContext || 'No specific documentation found for this injury.'}

Generate a list of 2-4 possible diagnoses based on the information provided.

Return ONLY a JSON object with this exact structure:
{
  "summary": "Brief 1-2 sentence acknowledgment of their injury and what you're analyzing",
  "diagnoses": [
    {
      "id": "unique-id-1",
      "name": "Diagnosis Name",
      "confidence": "high|medium|low",
      "shortDescription": "One sentence description",
      "matchedSymptoms": ["symptom1", "symptom2"],
      "typicalCauses": "Brief explanation of typical causes"
    }
  ],
  "immediateAdvice": "Brief immediate care advice (RICE protocol or similar) in 1-2 sentences"
}

Make IDs lowercase with hyphens (e.g., "ankle-sprain", "high-ankle-sprain").`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  let parsedDiagnoses;
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedDiagnoses = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn("Failed to parse diagnoses JSON, using fallback");
    parsedDiagnoses = {
      summary: "Based on your symptoms, here are the possible conditions:",
      diagnoses: [],
      immediateAdvice: "Apply ice and rest the affected area."
    };
  }
  
  return {
    stage: "DIAGNOSIS_LIST",
    type: "injury",
    response: parsedDiagnoses.summary,
    diagnoses: parsedDiagnoses.diagnoses,
    immediateAdvice: parsedDiagnoses.immediateAdvice,
    currentDetails: details,
    ragUsed: !!ragContext,
    nextAction: "select_diagnosis",
    uiHint: "Show list of diagnoses as clickable cards. When user clicks, send diagnosisId in next request"
  };
}

/**
 * STAGE 3: Show detailed information for a specific diagnosis
 * Triggered when user clicks on a diagnosis from the list
 */
async function handleDiagnosisDetail(diagnosisId, currentContext, userMessage) {
  const details = currentContext.currentDetails || {};
  
  const prompt = `You are HealthBay, an AI rehabilitation assistant. The user has selected a specific diagnosis to learn more about.

Diagnosis ID: ${diagnosisId}
User's Context:
- Body Part: ${details.body_part || 'Not specified'}
- Symptoms: ${details.symptoms?.join(', ') || 'Not specified'}
- Duration: ${details.duration || 'Not specified'}
- Context: ${details.context || 'Not specified'}

User's message: "${userMessage}"

Provide comprehensive information about this diagnosis. Return ONLY a JSON object:

{
  "diagnosisName": "Full name of the diagnosis",
  "overview": "2-3 sentence overview of this condition",
  "detailedSymptoms": ["List of typical symptoms"],
  "causes": "Detailed explanation of what causes this injury",
  "recoveryTimeline": {
    "acute": "Days 1-7: Description of acute phase and care",
    "subacute": "Weeks 1-3: Description of subacute phase",
    "chronic": "Weeks 3+: Description of return to activity"
  },
  "treatmentPlan": {
    "immediate": ["List of immediate actions - RICE protocol"],
    "ongoing": ["List of ongoing treatments and exercises"],
    "rehabilitation": ["List of rehab exercises and progressions"]
  },
  "diagnosticTests": [
    {
      "name": "Test name (e.g., 'Anterior Drawer Test')",
      "description": "How to perform this test",
      "positiveIndicator": "What indicates a positive test"
    }
  ],
  "redFlags": ["List of symptoms requiring immediate medical attention"],
  "whenToSeeDoctorImmediate": ["Situations requiring immediate medical care"],
  "whenToSeeDoctor24_48hrs": ["Situations to see doctor within 24-48 hours"],
  "selfCareAppropriate": "When self-care is appropriate",
  "estimatedRecoveryTime": "e.g., '4-6 weeks for moderate cases'",
  "returnToActivityGuidelines": "Guidelines for when to return to sports/activities"
}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  let diagnosisDetail;
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      diagnosisDetail = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn("Failed to parse diagnosis detail JSON");
    diagnosisDetail = {
      diagnosisName: diagnosisId,
      overview: "Detailed information about this diagnosis.",
      error: "Failed to load complete details"
    };
  }
  
  return {
    stage: "DIAGNOSIS_DETAIL",
    type: "injury",
    diagnosisId: diagnosisId,
    diagnosisDetail: diagnosisDetail,
    disclaimer: "⚠️ This is AI-generated guidance based on general information. Always consult a healthcare professional for accurate diagnosis and personalized treatment.",
    nextAction: "conversation_or_test",
    uiHint: "Show detailed diagnosis page with sections. User can ask follow-up questions or start diagnostic tests.",
    actions: [
      {
        id: "start_diagnostic_test",
        label: "Start Diagnostic Tests",
        description: "I'll guide you through tests to help confirm this diagnosis"
      },
      {
        id: "view_treatment",
        label: "View Treatment Plan",
        description: "Skip to treatment and recovery information"
      }
    ]
  };
}

/**
 * STAGE 4: Initiate interactive diagnostic testing
 */
async function initiateDiagnosticTests(diagnosisId, currentContext) {
  const details = currentContext.currentDetails || {};
  
  const prompt = `You are HealthBay, an AI rehabilitation assistant. Generate a series of 3-5 diagnostic tests for this injury.

Diagnosis ID: ${diagnosisId}
Body Part: ${details.body_part || 'Not specified'}

Return ONLY a JSON object:
{
  "introduction": "Brief 1-2 sentence explanation of why these tests help",
  "safetyWarning": "Safety instructions (stop if severe pain, etc.)",
  "tests": [
    {
      "id": "test-1",
      "name": "Test Name",
      "purpose": "What this test checks for",
      "steps": [
        "Step 1 instruction",
        "Step 2 instruction",
        "Step 3 instruction"
      ],
      "estimatedTime": "30 seconds",
      "whatToLookFor": "Description of what indicates a positive test",
      "safetyNote": "Any specific safety warnings for this test"
    }
  ]
}

Make test IDs lowercase with hyphens. Keep steps clear and concise.`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  let testPlan;
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      testPlan = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn("Failed to parse test plan JSON");
    testPlan = {
      introduction: "Let's perform some diagnostic tests.",
      safetyWarning: "Stop immediately if you experience severe pain.",
      tests: []
    };
  }
  
  // Initialize test session
  return {
    stage: "DIAGNOSTIC_TEST_INTRO",
    type: "injury",
    diagnosisId: diagnosisId,
    testSession: {
      testPlan: testPlan,
      currentTestIndex: 0,
      totalTests: testPlan.tests?.length || 0,
      currentStepIndex: 0,
      testResults: [],
      startTime: new Date().toISOString(),
      diagnosisId: diagnosisId  // Store diagnosisId in session for easy access
    },
    introduction: testPlan.introduction,
    safetyWarning: testPlan.safetyWarning,
    nextAction: "begin_first_test",
    uiHint: "Show introduction and safety warning. Button to start first test.",
    navigation: {
      canGoBack: true,
      backAction: "exit_to_diagnosis",
      backLabel: "← Back to Diagnosis"
    }
  };
}

/**
 * Handle diagnostic test responses and guide through steps
 */
async function handleDiagnosticTestResponse(testResponse, currentContext) {
  const testSession = currentContext.testSession || {};
  const { testPlan, currentTestIndex, currentStepIndex, testResults } = testSession;
  
  if (!testPlan || !testPlan.tests) {
    return {
      stage: "ERROR",
      response: "Test session not found. Please restart diagnostic tests.",
      nextAction: "restart"
    };
  }
  
  const currentTest = testPlan.tests[currentTestIndex];
  const totalSteps = currentTest.steps.length;
  
  // Handle different response types
  if (testResponse.action === "start_test") {
    // User is starting the current test - show first step
    return {
      stage: "DIAGNOSTIC_TEST_STEP",
      type: "injury",
      testSession: {
        ...testSession,
        currentStepIndex: 0
      },
      currentTest: {
        id: currentTest.id,
        name: currentTest.name,
        purpose: currentTest.purpose,
        stepNumber: 1,
        totalSteps: totalSteps,
        stepInstruction: currentTest.steps[0],
        estimatedTime: currentTest.estimatedTime,
        safetyNote: currentTest.safetyNote
      },
      progress: {
        testNumber: currentTestIndex + 1,
        totalTests: testPlan.tests.length,
        percentage: Math.round(((currentTestIndex) / testPlan.tests.length) * 100)
      },
      nextAction: "complete_step",
      uiHint: "Show step instruction with timer. Button for 'I've completed this step' or 'Stop - this causes pain'",
      navigation: {
        canGoBack: true,
        backAction: "exit_to_diagnosis",
        backLabel: "← Exit Test"
      }
    };
  }
  
  else if (testResponse.action === "next_step") {
    // User completed current step, move to next step
    const nextStepIndex = currentStepIndex + 1;
    
    if (nextStepIndex < totalSteps) {
      // More steps in current test
      return {
        stage: "DIAGNOSTIC_TEST_STEP",
        type: "injury",
        testSession: {
          ...testSession,
          currentStepIndex: nextStepIndex
        },
        currentTest: {
          id: currentTest.id,
          name: currentTest.name,
          purpose: currentTest.purpose,
          stepNumber: nextStepIndex + 1,
          totalSteps: totalSteps,
          stepInstruction: currentTest.steps[nextStepIndex],
          estimatedTime: currentTest.estimatedTime,
          safetyNote: currentTest.safetyNote
        },
        progress: {
          testNumber: currentTestIndex + 1,
          totalTests: testPlan.tests.length,
          percentage: Math.round(((currentTestIndex + (nextStepIndex / totalSteps)) / testPlan.tests.length) * 100)
        },
        nextAction: "complete_step",
        uiHint: "Show next step instruction. Button for 'I've completed this step' or 'Stop - this causes pain'",
        navigation: {
          canGoBack: true,
          backAction: "exit_to_diagnosis",
          backLabel: "← Exit Test"
        }
      };
    } else {
      // All steps completed, ask for test result
      return {
        stage: "DIAGNOSTIC_TEST_RESULT",
        type: "injury",
        testSession: testSession,
        currentTest: {
          id: currentTest.id,
          name: currentTest.name,
          whatToLookFor: currentTest.whatToLookFor
        },
        question: `You've completed the ${currentTest.name}. ${currentTest.whatToLookFor}\n\nDid you experience this during the test?`,
        progress: {
          testNumber: currentTestIndex + 1,
          totalTests: testPlan.tests.length,
          percentage: Math.round(((currentTestIndex + 1) / testPlan.tests.length) * 100)
        },
        nextAction: "submit_result",
        uiHint: "Show question with options: 'Yes (Positive)', 'No (Negative)', 'Unsure', 'Severe pain - stopped test'",
        navigation: {
          canGoBack: true,
          backAction: "exit_to_diagnosis",
          backLabel: "← Exit Test"
        }
      };
    }
  }
  
  else if (testResponse.action === "submit_result") {
    // User submitted test result
    const result = testResponse.result; // 'positive', 'negative', 'unsure', 'stopped'
    const painLevel = testResponse.painLevel || null; // 0-10 scale
    
    // Record result
    const updatedResults = [
      ...testResults,
      {
        testId: currentTest.id,
        testName: currentTest.name,
        result: result,
        painLevel: painLevel,
        timestamp: new Date().toISOString()
      }
    ];
    
    const nextTestIndex = currentTestIndex + 1;
    
    // Check if more tests remain
    if (nextTestIndex < testPlan.tests.length) {
      // Move to next test
      return {
        stage: "DIAGNOSTIC_TEST_TRANSITION",
        type: "injury",
        testSession: {
          ...testSession,
          currentTestIndex: nextTestIndex,
          currentStepIndex: 0,
          testResults: updatedResults
        },
        completedTest: {
          name: currentTest.name,
          result: result
        },
        nextTest: {
          name: testPlan.tests[nextTestIndex].name,
          purpose: testPlan.tests[nextTestIndex].purpose
        },
        progress: {
          testNumber: nextTestIndex,
          totalTests: testPlan.tests.length,
          percentage: Math.round((nextTestIndex / testPlan.tests.length) * 100)
        },
        nextAction: "start_next_test",
        uiHint: "Show transition screen. Button to 'Start Next Test' or 'Stop Testing'",
        navigation: {
          canGoBack: true,
          backAction: "exit_to_diagnosis",
          backLabel: "← Exit Tests"
        }
      };
    } else {
      // All tests completed - analyze results
      return await analyzeDiagnosticResults(testSession.diagnosisId, updatedResults, currentContext);
    }
  }
  
  else if (testResponse.action === "stop_test") {
    // User stopped due to pain or other reason
    return {
      stage: "DIAGNOSTIC_TEST_STOPPED",
      type: "injury",
      testSession: {
        ...testSession,
        stopped: true,
        stopReason: testResponse.reason || "User stopped test"
      },
      message: "You've stopped the diagnostic tests. This is important information.",
      recommendation: "Severe pain during tests may indicate a more serious injury. Consider seeing a healthcare professional for proper evaluation.",
      partialResults: testResults,
      nextAction: "view_recommendations",
      uiHint: "Show stop message and recommendations. Option to return to diagnosis detail."
    };
  }
  
  return {
    stage: "ERROR",
    response: "Unknown test action",
    nextAction: "restart"
  };
}

/**
 * Analyze diagnostic test results and provide final assessment
 */
async function analyzeDiagnosticResults(diagnosisId, testResults, currentContext) {
  const details = currentContext.currentDetails || {};
  
  const resultsString = testResults.map(r => 
    `${r.testName}: ${r.result}${r.painLevel ? ` (Pain: ${r.painLevel}/10)` : ''}`
  ).join('\n');
  
  const prompt = `You are HealthBay, an AI rehabilitation assistant. Analyze diagnostic test results and provide a REFINED diagnosis with improved treatment recommendations.

Original Diagnosis ID: ${diagnosisId}
User Context:
- Body Part: ${details.body_part}
- Symptoms: ${details.symptoms?.join(', ')}
- Context: ${details.context}

Test Results:
${resultsString}

Based on these test results, provide a comprehensive refined assessment. Return ONLY a JSON object:
{
  "confidenceLevel": "high|medium|low",
  "refinedDiagnosis": {
    "name": "Updated diagnosis name if changed, or same as original",
    "severity": "mild|moderate|severe",
    "explanation": "Why this diagnosis is confirmed/updated based on test results"
  },
  "assessment": "2-3 sentence interpretation of the test results and what they indicate",
  "diagnosisConfirmation": "Does this confirm, partially confirm, or contradict the suspected diagnosis?",
  "painAnalysis": "Analysis of pain levels reported during tests and what they indicate",
  "refinedRecommendations": [
    "Specific recommendation based on test results and pain levels",
    "Another specific recommendation",
    "Modified recommendation due to test findings"
  ],
  "refinedTreatmentPlan": {
    "immediate": ["Immediate actions based on test results"],
    "week1": ["Week 1 treatments adjusted for severity"],
    "week2_3": ["Week 2-3 treatments"],
    "ongoing": ["Long-term rehabilitation"]
  },
  "nextSteps": "What the user should do next (continue with treatment plan, see doctor, etc.)",
  "redFlags": ["Any concerning findings from the tests"],
  "estimatedRecovery": "Updated recovery timeline based on test severity",
  "confidenceImprovement": "How the tests improved diagnostic confidence (e.g., '85% confident vs 70% before')"
}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  let analysis;
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn("Failed to parse analysis JSON");
    analysis = {
      confidenceLevel: "medium",
      refinedDiagnosis: {
        name: diagnosisId,
        severity: "moderate",
        explanation: "Tests provide moderate confirmation"
      },
      assessment: "Tests completed. Results indicate moderate concern.",
      diagnosisConfirmation: "Results provide some confirmation.",
      painAnalysis: "Pain levels suggest moderate injury.",
      refinedRecommendations: ["Follow treatment plan", "Monitor symptoms"],
      refinedTreatmentPlan: {
        immediate: ["RICE protocol"],
        week1: ["Rest and ice"],
        week2_3: ["Gentle exercises"],
        ongoing: ["Progressive strengthening"]
      },
      nextSteps: "Continue with recommended treatment",
      redFlags: [],
      estimatedRecovery: "4-6 weeks",
      confidenceImprovement: "Confidence increased with test results"
    };
  }
  
  return {
    stage: "DIAGNOSTIC_TEST_COMPLETE",
    type: "injury",
    diagnosisId: diagnosisId,
    testResults: testResults,
    analysis: analysis,
    disclaimer: "⚠️ These diagnostic tests are for educational purposes. A healthcare professional should perform a proper physical examination for accurate diagnosis.",
    nextAction: "view_refined_treatment",
    uiHint: "Show complete analysis with refined diagnosis and treatment plan. Options to view detailed treatment or return to diagnosis list.",
    actions: [
      {
        id: "view_refined_treatment",
        label: "View Personalized Treatment Plan",
        description: "See your customized treatment based on test results",
        primary: true
      },
      {
        id: "back_to_diagnosis",
        label: "Back to Diagnosis Details",
        description: "Return to original diagnosis information"
      },
      {
        id: "back_to_list",
        label: "View Other Diagnoses",
        description: "Return to diagnosis list"
      }
    ],
    navigation: {
      canGoBack: true,
      backAction: "exit_to_diagnosis",
      backLabel: "← Back to Diagnosis"
    }
  };
}

/**
 * Handle general health/illness queries
 */
async function handleGeneralHealthQuery(message, details, chatHistory) {
  const { symptoms, severity, duration, context } = details;
  
  const prompt = `You are HealthBay, a health guidance assistant. The user has a general health concern (not a musculoskeletal injury).

User's information:
- Symptoms: ${symptoms?.join(', ') || 'Not specified'}
- Severity: ${severity || 'Unknown'}
- Duration: ${duration || 'Not specified'}
- Context: ${context || 'Not specified'}

User's message: "${message}"

Provide:

1. **Possible Conditions** (list of all possible diagnoses with confidence levels):
   - List potential conditions with likelihood
   - Brief explanation

2. **Symptom Management**:
   - Home care recommendations
   - Over-the-counter remedies (if appropriate)
   - Comfort measures

3. **When to Seek Medical Care**:
   - Signs that require immediate attention
   - When to see a doctor within 24-48 hours
   - When self-care is appropriate

4. **General Advice**:
   - Rest, hydration, nutrition
   - What to avoid
   - Expected recovery timeline (if applicable)

5. **Note About HealthBay**:
   - Mention that HealthBay specializes in musculoskeletal injuries
   - Suggest seeing appropriate healthcare provider for this type of concern

**Important**: Include medical disclaimer and strongly encourage consulting healthcare provider for non-injury conditions.`;

  const result = await model.generateContent(prompt);
  const aiResponse = result.response.text();
  
  return {
    type: "general_health",
    response: aiResponse,
    classification: details,
    disclaimer: "⚠️ This is general health information only. For non-musculoskeletal conditions, please consult your primary care physician or appropriate specialist for proper diagnosis and treatment."
  };
}

/**
 * Handle general/off-topic queries
 */
async function handleGeneralQuery(message, chatHistory) {
  const prompt = `You are HealthBay, an AI assistant specializing in musculoskeletal injury rehabilitation and recovery.

The user said: "${message}"

This doesn't appear to be about musculoskeletal injuries or health conditions. 

Provide a brief, helpful response that:
1. Acknowledges their message
2. Politely redirects them to ask about injuries, sprains, strains, joint pain, or rehabilitation
3. Give examples of what you can help with
4. Maintain a friendly, supportive tone

Keep it concise (2-3 sentences).`;

  const result = await model.generateContent(prompt);
  const aiResponse = result.response.text();
  
  return {
    type: "general",
    response: aiResponse,
    classification: { type: "other" }
  };
}

/**
 * Log interaction for future analysis
 */
function logInteraction(message, response) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    message: message.substring(0, 200), // Truncate for privacy
    stage: response.stage || 'unknown',
    responseType: response.type,
    ragUsed: response.ragUsed || false
  };
  
  console.log("📝 Interaction Log:", JSON.stringify(logEntry));
  
  // TODO: Your database teammate can implement persistent logging
  // Example: await db.query('INSERT INTO chat_logs ...', logEntry);
}