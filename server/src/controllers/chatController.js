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
      message, 
      chatHistory = [], 
      diagnosisId = null,
      currentContext = {},
      startDiagnosticTest = false,
      testResponse = null,
      exitDiagnosticTest = false,
      selectedSymptoms = null  // New: for symptom checklist submission
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
    }
    // If we have ongoing context, handle as conversational follow-up
    else if (currentContext.currentDetails && Object.keys(currentContext.currentDetails).length > 0) {
      response = await handleConversationalFollowUp(message, currentContext, chatHistory);
    }
    else {
      // Step 1: Classify the input type (injury vs general health)
      const classification = await classifyInput(message, chatHistory);
      console.log("📊 Classification:", classification.type);
      
      if (classification.type === "injury") {
        // Handle musculoskeletal injury query with flow-based approach
        response = await handleInjuryFlow(message, classification.details, chatHistory, currentContext);
      } else if (classification.type === "general_health") {
        // Handle general health/illness query with smart info gathering
        response = await handleGeneralHealthFlow(message, classification.details, chatHistory, currentContext);
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
 * Handle general health queries with smart flow
 * Similar to injury flow but for general health concerns
 */
async function handleGeneralHealthFlow(message, details, chatHistory, currentContext) {
  console.log("🏥 General Health Flow - Checking details:", details);
  
  // Check if symptoms are specific enough
  const hasSpecificSymptoms = details.symptoms && 
                               details.symptoms.length > 0 && 
                               !(details.symptoms.length === 1 && 
                                 (details.symptoms[0].toLowerCase() === 'not feeling well' ||
                                  details.symptoms[0].toLowerCase() === 'sick' ||
                                  details.symptoms[0].toLowerCase() === 'ill'));
  
  console.log("🔍 Has specific symptoms:", hasSpecificSymptoms);
  
  // If we don't have specific symptoms, show symptom checklist
  if (!hasSpecificSymptoms) {
    console.log("📋 Showing general health symptom checklist...");
    return await getGeneralHealthSymptomChecklist(message, details);
  }
  
  // We have symptoms - generate diagnosis list
  console.log("✅ Proceeding to general health diagnosis list");
  return await generateGeneralHealthDiagnosisList(message, details, chatHistory);
}

/**
 * Generate general health symptom checklist
 */
async function getGeneralHealthSymptomChecklist(message, details) {
  const prompt = `You are HealthBay, a health guidance assistant. The user has a general health concern but hasn't specified symptoms clearly.

User's message: "${message}"

Generate a comprehensive symptom checklist for general health concerns (not musculoskeletal injuries).
Include categories like: respiratory, digestive, fever/infection, neurological, skin, etc.

Return ONLY a JSON object:
{
  "message": "Brief empathetic message (2-3 sentences) asking them to check off their symptoms.",
  "symptomCategories": {
    "respiratory": {
      "label": "Respiratory Symptoms",
      "symptoms": ["Cough", "Runny nose", "Congestion", "Sore throat", "Difficulty breathing", "Wheezing"]
    },
    "fever_infection": {
      "label": "Fever & Infection Signs",
      "symptoms": ["Fever", "Chills", "Body aches", "Fatigue", "Sweating"]
    },
    "digestive": {
      "label": "Digestive Symptoms",
      "symptoms": ["Nausea", "Vomiting", "Diarrhea", "Stomach pain", "Loss of appetite", "Bloating"]
    },
    "head_neuro": {
      "label": "Head & Neurological",
      "symptoms": ["Headache", "Dizziness", "Confusion", "Vision changes", "Sensitivity to light"]
    },
    "skin": {
      "label": "Skin Changes",
      "symptoms": ["Rash", "Itching", "Hives", "Discoloration", "Bumps or lesions"]
    },
    "other": {
      "label": "Other Symptoms",
      "symptoms": ["Ear pain", "Sinus pressure", "Swollen glands", "Joint pain", "Chest discomfort"]
    }
  }
}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  let symptomData;
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      symptomData = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Fallback
    symptomData = {
      message: "I want to help! Please check off all the symptoms you're experiencing so I can give you the best guidance.",
      symptomCategories: {
        respiratory: {
          label: "Respiratory Symptoms",
          symptoms: ["Cough", "Runny nose", "Congestion", "Sore throat", "Difficulty breathing"]
        },
        fever_infection: {
          label: "Fever & Infection Signs",
          symptoms: ["Fever", "Chills", "Body aches", "Fatigue"]
        },
        digestive: {
          label: "Digestive Symptoms",
          symptoms: ["Nausea", "Vomiting", "Diarrhea", "Stomach pain"]
        }
      }
    };
  }
  
  return {
    stage: "GATHERING_INFO",
    substage: "SYMPTOM_CHECKLIST",
    type: "general_health",
    response: symptomData.message,
    symptomChecklist: symptomData.symptomCategories,
    currentDetails: details,
    nextAction: "select_symptoms",
    uiHint: "Show checkbox list organized by categories with 'Other' text input field at bottom",
    hasOtherOption: true,
    otherLabel: "Other symptoms not listed:"
  };
}

/**
 * Generate diagnosis list for general health concerns
 */
async function generateGeneralHealthDiagnosisList(message, details, chatHistory) {
  const { symptoms, severity, duration, context } = details;
  
  const prompt = `You are HealthBay, a health guidance assistant. The user has general health symptoms (not a musculoskeletal injury).

User's information:
- Symptoms: ${symptoms?.join(', ') || 'Not specified'}
- Severity: ${severity || 'Unknown'}
- Duration: ${duration || 'Not specified'}
- Context: ${context || 'Not specified'}

User's message: "${message}"

Generate a list of possible diagnoses with confidence levels, similar to how you would for an injury assessment.

Return ONLY a JSON object:
{
  "summary": "2-3 sentence conversational acknowledgment of their symptoms and what you're assessing",
  "diagnoses": [
    {
      "id": "unique-id-1",
      "name": "Diagnosis Name",
      "confidence": "high|medium|low",
      "shortDescription": "One sentence summary",
      "matchedSymptoms": ["symptom1", "symptom2"],
      "typicalCauses": "Brief explanation of what causes this"
    }
  ],
  "immediateAdvice": "Brief practical advice (rest, hydration, OTC remedies)",
  "followUpQuestion": "Engaging question to keep dialogue going"
}

IMPORTANT: Include medical disclaimer. For non-musculoskeletal conditions, strongly encourage seeing healthcare provider.`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  let parsedDiagnoses;
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedDiagnoses = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    parsedDiagnoses = {
      summary: "Based on your symptoms, here are possible conditions that could match what you're experiencing.",
      diagnoses: [],
      immediateAdvice: "Rest, stay hydrated, and monitor your symptoms.",
      followUpQuestion: "Which of these sounds most like what you're experiencing?"
    };
  }
  
  const conversationalResponse = parsedDiagnoses.followUpQuestion 
    ? `${parsedDiagnoses.summary}\n\n${parsedDiagnoses.followUpQuestion}`
    : parsedDiagnoses.summary;
  
  return {
    stage: "DIAGNOSIS_LIST",
    type: "general_health",
    response: conversationalResponse,
    diagnoses: parsedDiagnoses.diagnoses,
    immediateAdvice: parsedDiagnoses.immediateAdvice,
    currentDetails: details,
    nextAction: "select_diagnosis",
    uiHint: "Show list of diagnoses as clickable cards. When user clicks, send diagnosisId in next request",
    disclaimer: "⚠️ This is general health information only. For non-musculoskeletal conditions, please consult your primary care physician or appropriate specialist for proper diagnosis and treatment."
  };
}

/**
 * Handle musculoskeletal injury queries with conversational flow
 * Stage 1: Gather missing information
 * Stage 2: Present diagnosis list
 * ALWAYS uses the flow architecture - no redundant questions
 */
async function handleInjuryFlow(message, details, chatHistory, currentContext) {
  const { injury_name, body_part, symptoms, severity, duration, context, mechanism, medical_history } = details;
  
  // Determine what information is TRULY missing and ESSENTIAL
  // We ONLY need: body_part and symptoms (specific ones)
  // Duration/context/mechanism are nice-to-have but NOT required for diagnosis
  const missingInfo = [];
  
  // Body part is critical
  if (!body_part || body_part === 'Not specified' || body_part === 'unknown') {
    missingInfo.push('body_part');
  }
  
  // Symptoms must be specific (not just "pain" or generic)
  if (!symptoms || symptoms.length === 0 || 
      (symptoms.length === 1 && (symptoms[0].toLowerCase().includes('pain') || symptoms[0].toLowerCase() === 'hurts'))) {
    missingInfo.push('symptoms');
  }
  
  console.log("❓ Missing Essential Info:", missingInfo);
  
  // STAGE 1: GATHERING_INFO - ONLY if CRITICAL information is missing
  // Don't ask about duration, context, or mechanism - those aren't critical
  if (missingInfo.length > 0 && !currentContext.infoGathered) {
    console.log("📋 Showing symptom checklist to gather essential info");
    return await gatherMissingInfo(message, details, missingInfo);
  }
  
  // STAGE 2: DIAGNOSIS_LIST - We have enough! Present possible diagnoses
  console.log("✅ Essential info gathered, proceeding to diagnosis list");
  return await generateDiagnosisList(message, details, chatHistory, currentContext);
}

/**
 * STAGE 1: Gather missing information from the user
 * ALWAYS show symptom checklist when symptoms are missing - NO conversational questions
 */
async function gatherMissingInfo(message, details, missingInfo) {
  // If symptoms are missing, provide structured symptom checklist IMMEDIATELY
  // This is the "flow architecture" - we don't ask conversational questions first
  if (missingInfo.includes('symptoms')) {
    console.log("📋 Showing symptom checklist immediately (flow architecture)");
    return await getSymptomChecklist(message, details, missingInfo);
  }
  
  // If ONLY body_part is missing (symptoms are OK), ask conversationally
  // But this is rare since most vague reports also have vague symptoms
  if (missingInfo.includes('body_part')) {
    const prompt = `You are HealthBay (MedBay), an empathetic AI rehabilitation assistant helping a user with an injury.

User's current information:
- Injury: ${details.injury_name || 'Unknown'}
- Body Part: ${details.body_part || 'Not specified'}
- Symptoms: ${details.symptoms?.join(', ') || 'Not specified'}

User's message: "${message}"

The user hasn't specified which body part is affected. Ask them conversationally which part of their body hurts or is injured.

Create a brief, warm response (2-3 sentences) asking them to clarify which body part is affected.
Use plain text formatting only - no bold (**), asterisks, or other markdown formatting.`;

    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();
    
    return {
      stage: "GATHERING_INFO",
      type: "injury",
      response: aiResponse,
      missingInfo: missingInfo,
      currentDetails: details,
      nextAction: "answer_questions",
      uiHint: "Show text input for user to specify body part",
      currentContext: {
        stage: "GATHERING_INFO",
        currentDetails: details,
        missingInfo: missingInfo
      }
    };
  }
  
  // Fallback: Show symptom checklist anyway (shouldn't happen)
  console.log("⚠️ Unexpected path in gatherMissingInfo - showing symptom checklist as fallback");
  return await getSymptomChecklist(message, details, missingInfo);
}

/**
 * Generate symptom checklist based on body part
 */
async function getSymptomChecklist(message, details, missingInfo) {
  const bodyPart = details.body_part?.toLowerCase() || 'general';
  
  // Get AI to generate relevant symptoms for the specific body part
  const prompt = `You are HealthBay (MedBay), an empathetic AI rehabilitation assistant. The user has an injury to their ${bodyPart}.

Generate a comprehensive list of common symptoms for ${bodyPart} injuries that a user might experience.
Include both common and less common symptoms to ensure comprehensive diagnosis.

Return ONLY a JSON object with this structure:
{
  "message": "Brief empathetic message (2-3 sentences) asking them to check off their symptoms. Make it conversational and encouraging, not clinical. End with a question or prompt for engagement.",
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

Customize the symptoms to be specific and relevant for ${bodyPart} injuries.
Make the message warm and supportive, like talking to a caring professional.`;

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
      message: `I want to make sure I understand exactly what you're experiencing with your ${bodyPart} injury. Could you check off all the symptoms that apply to you? This will help me give you the most accurate guidance possible.`,
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
 * Handle conversational follow-up messages during the assessment
 */
async function handleConversationalFollowUp(message, currentContext, chatHistory) {
  const details = currentContext.currentDetails || {};
  
  // Handle general health symptom checklist submission (same as injury flow)
  if (currentContext.stage === "GATHERING_INFO" && currentContext.type === "general_health") {
    console.log("🏥 User submitted general health symptom checklist");
    // This will be handled by handleSymptomSubmission which works for both injury and general health
    // Just need to route to diagnosis list
    return await generateGeneralHealthDiagnosisList(message, details, chatHistory);
  }
  
  // Handle general health diagnosis list - user asking follow-up questions
  if (currentContext.stage === "DIAGNOSIS_LIST" && currentContext.type === "general_health") {
    console.log("🏥 User in general health diagnosis list stage");
    
    // Re-classify to see if they mentioned new symptoms
    const newClassification = await classifyInput(message, chatHistory);
    
    // If they provided more symptoms, update and regenerate list
    if (newClassification.details.symptoms && newClassification.details.symptoms.length > 0) {
      const mergedDetails = {
        ...details,
        symptoms: [
          ...(details.symptoms || []),
          ...(newClassification.details.symptoms || [])
        ].filter((v, i, a) => a.indexOf(v) === i)
      };
      
      return await generateGeneralHealthDiagnosisList(message, mergedDetails, chatHistory);
    }
    
    // Otherwise, provide conversational response about their general health concern
    return await handleGeneralHealthConversation(message, details, chatHistory);
  }
  
  // If we're in GATHERING_INFO stage (for injuries), the user is answering our questions
  // Re-classify their response to extract new information and merge with existing details
  if (currentContext.stage === "GATHERING_INFO") {
    console.log("🔄 User answering questions in GATHERING_INFO, re-classifying...");
    console.log("📋 Existing Details:", details);
    
    // Check if we've already asked the user for information (interaction count)
    const interactionCount = (currentContext.interactionCount || 0) + 1;
    console.log("🔢 Interaction Count:", interactionCount);
    
    // Re-classify to extract new info from user's answer
    const newClassification = await classifyInput(message, chatHistory);
    console.log("🆕 New Classification:", newClassification.details);
    
    // Merge new details with existing details (only update if new info is better)
    const mergedDetails = {
      injury_name: newClassification.details.injury_name || details.injury_name,
      body_part: newClassification.details.body_part && newClassification.details.body_part !== 'Not specified' 
        ? newClassification.details.body_part 
        : details.body_part,
      symptoms: [
        ...(details.symptoms || []),
        ...(newClassification.details.symptoms || [])
      ].filter((v, i, a) => a.indexOf(v) === i), // Remove duplicates
      severity: newClassification.details.severity && newClassification.details.severity !== 'unknown' 
        ? newClassification.details.severity 
        : details.severity,
      duration: newClassification.details.duration && newClassification.details.duration !== 'Not specified'
        ? newClassification.details.duration
        : details.duration,
      context: newClassification.details.context && newClassification.details.context !== 'Not specified'
        ? newClassification.details.context
        : details.context,
      mechanism: newClassification.details.mechanism && newClassification.details.mechanism !== 'Not specified'
        ? newClassification.details.mechanism
        : details.mechanism,
      medical_history: newClassification.details.medical_history || details.medical_history
    };
    
    console.log("📊 Merged Details:", mergedDetails);
    
    // If we've already asked once (interactionCount >= 2), just move forward with what we have
    if (interactionCount >= 2) {
      console.log("✅ Already asked once, moving to diagnosis list with available info");
      return await generateDiagnosisList(message, mergedDetails, chatHistory, currentContext);

    }
    
    // Check what info is still missing with STRICT validation
    const missingInfo = [];
    
    if (!mergedDetails.body_part || mergedDetails.body_part === 'Not specified' || mergedDetails.body_part === 'unknown') {
      missingInfo.push('body_part');
    }
    
    // Symptoms must be specific (not just "pain")
    if (!mergedDetails.symptoms || mergedDetails.symptoms.length === 0 || 
        (mergedDetails.symptoms.length === 1 && (mergedDetails.symptoms[0].toLowerCase().includes('pain') || mergedDetails.symptoms[0].toLowerCase() === 'hurts'))) {
      missingInfo.push('symptoms');
    }
    
    if (!mergedDetails.duration || mergedDetails.duration === 'Not specified' || mergedDetails.duration === 'unknown' || mergedDetails.duration.toLowerCase().includes('not specified')) {
      missingInfo.push('duration');
    }
    
    // Need either context or mechanism
    if ((!mergedDetails.context || mergedDetails.context === 'Not specified' || mergedDetails.context === 'unknown') && 
        (!mergedDetails.mechanism || mergedDetails.mechanism === 'Not specified' || mergedDetails.mechanism === 'unknown')) {
      missingInfo.push('context_or_mechanism');
    }
    
    console.log("❓ Still Missing:", missingInfo);
    
    // If we still have missing critical info, ask ONE MORE TIME
    if (missingInfo.length > 0) {
      const result = await gatherMissingInfo(message, mergedDetails, missingInfo);
      result.currentContext = {
        ...result.currentContext,
        interactionCount: interactionCount
      };
      return result;
    }
    
    // All info gathered! Move to diagnosis list
    console.log("✅ All info gathered, generating diagnosis list...");
    return await generateDiagnosisList(message, mergedDetails, chatHistory, currentContext);

  }
  
  // Otherwise, handle as a casual conversational follow-up (after diagnosis list/detail)
  // Check for concerning or inappropriate statements
  const lowerMessage = message.toLowerCase();
  const concerningPhrases = [
    'cut', 'amputate', 'remove', 'kill myself', 'end it', 'suicide',
    'don\'t care', 'doesn\'t matter', 'give up', 'hopeless'
  ];
  
  const hasHarmfulIntent = concerningPhrases.some(phrase => lowerMessage.includes(phrase));
  
  // Check if user has a confirmed injury
  const confirmedInjury = currentContext.confirmedInjury;
  const hasConfirmedInjury = confirmedInjury && confirmedInjury.name;
  
  // Get past injuries for context
  const pastInjuries = currentContext?.pastInjuries || [];
  const pastInjuriesContext = pastInjuries.length > 0
    ? `\n\nPast Medical History (from user's previous chats):\n${pastInjuries.map((injury, i) => 
        `${i + 1}. ${injury.date} - ${injury.bodyPart}: ${injury.symptoms.join(', ')}`
      ).join('\n')}\n\nNote: Consider this history when providing recommendations, especially if they have recurring issues.`
    : '';
  
  const prompt = `You are HealthBay (MedBay), a conversational AI rehab assistant. This is an ONGOING conversation about their ${details.body_part || 'injury'}.

${hasConfirmedInjury ? `
✅ CONFIRMED DIAGNOSIS: ${confirmedInjury.name}
- Confirmed at: ${new Date(confirmedInjury.confirmedAt).toLocaleDateString()}
- Confidence: ${confirmedInjury.confidenceLevel || 'N/A'}
${confirmedInjury.testResults ? `- Based on ${confirmedInjury.testResults.length} diagnostic tests` : ''}

The user has CONFIRMED this is their injury. Focus all guidance on this specific diagnosis, treatment plan, and recovery.
` : ''}
${pastInjuriesContext}

They already know:
- Their diagnosis options
- Basic symptoms
- Initial advice

User just said: "${message}"

${hasHarmfulIntent ? `
⚠️ CRITICAL: They mentioned self-harm or extreme measures.
Respond with:
- Immediate empathy and concern (1-2 sentences)
- Clear statement this is NOT appropriate
- Direct recommendation to seek professional help NOW
- Crisis resources if needed
Keep it brief but urgent.
` : `
Guidelines for natural conversation:
- Keep responses SHORT (1-3 sentences max unless they ask for detail)
- Answer their SPECIFIC question directly, don't repeat everything
- Sound like a real person texting, not giving a medical lecture
- If they're just chatting/checking in, match their energy
- Only provide detailed info if they explicitly ask for it
- End with a SHORT question (5-8 words) to keep dialogue going
- Don't repeat advice you've already given
- Be casual but professional - like a knowledgeable friend
${hasConfirmedInjury ? `- Reference their confirmed diagnosis (${confirmedInjury.name}) when relevant` : ''}
`}

Examples of good conversational responses:
- User: "Does it usually swell a lot?" → You: "Yeah, swelling is super common with ${hasConfirmedInjury ? confirmedInjury.name : details.body_part || 'this type of'} injuries, especially in the first few days. Ice will help bring it down. Is the swelling getting worse or staying about the same?"
- User: "How long till I can play again?" → You: "Most people are back to playing in 4-6 weeks if they follow the treatment plan consistently. What sport are you itching to get back to?"
- User: "This sucks" → You: "I know, injuries are frustrating. The good news is you caught it early. How's the pain level today?"

CRITICAL:
- NO bullet points or numbered lists unless they ask for a plan
- NO long paragraphs - be conversational and concise
- Match their communication style
- If they're brief, you be brief
- Only elaborate when asked`;

  const result = await model.generateContent(prompt);
  const aiResponse = result.response.text();
  
  return {
    stage: "CONVERSATIONAL",
    type: "injury",
    response: aiResponse,
    currentContext: {
      ...currentContext,
      currentDetails: details,
    },
    currentDetails: details,
    concernFlagged: hasHarmfulIntent,
    nextAction: "continue_conversation",
    uiHint: "Show response with text input for user to continue conversation"
  };
}

/**
 * Handle symptom checklist submission (works for both injury and general health)
 */
async function handleSymptomSubmission(selectedSymptoms, currentContext, message, chatHistory) {
  // Merge selected symptoms with current details
  const updatedDetails = {
    ...currentContext.currentDetails,
    symptoms: selectedSymptoms
  };
  
  // Check what type of assessment this is
  const isGeneralHealth = currentContext.type === "general_health";
  
  if (isGeneralHealth) {
    // For general health, we have enough - go straight to diagnosis list
    console.log("✅ General health symptoms selected, proceeding to diagnosis list");
    return await generateGeneralHealthDiagnosisList(message, updatedDetails, chatHistory);
  }
  
  // For injuries, check if there's still other missing info
  const { body_part, duration, context, mechanism } = updatedDetails;
  const missingInfo = [];
  if (!duration || duration === 'Not specified') missingInfo.push('duration');
  if (!context || context === 'Not specified') missingInfo.push('context');
  if (!mechanism || mechanism === 'Not specified') missingInfo.push('mechanism');
  
  // If other critical info is still missing AND we haven't asked before, ask ONCE
  const hasAskedBefore = currentContext.substage === 'SYMPTOM_CHECKLIST' || currentContext.interactionCount > 0;
  
  if (missingInfo.length > 0 && !hasAskedBefore) {
    // Ask once for remaining info
    const result = await gatherMissingInfo(message, updatedDetails, missingInfo);
    result.currentContext = {
      ...result.currentContext,
      interactionCount: 1 // Mark that we've asked once
    };
    return result;
  }
  
  // Either we have all info OR we've already asked - proceed to diagnosis list
  console.log("✅ Proceeding to injury diagnosis list after symptom selection");
  return await generateDiagnosisList(message, updatedDetails, chatHistory, currentContext);
}

/**
 * Handle general health conversational responses
 */
async function handleGeneralHealthConversation(message, details, chatHistory) {
  const prompt = `You are HealthBay, a health guidance assistant. The user has a general health concern and you've already provided possible diagnoses.

User's Context:
- Symptoms: ${details.symptoms?.join(', ') || 'Not specified'}
- Previous diagnoses shown: Yes

User just said: "${message}"

Provide a brief, conversational response that:
1. Answers their specific question directly
2. Keeps it SHORT (2-3 sentences max)
3. Reminds them to see a healthcare professional for proper diagnosis
4. Doesn't repeat the full diagnosis list
5. Sounds natural and helpful

Example: "Yes, fever with chills is very common with flu. It usually means your body is fighting the infection. I'd recommend seeing a doctor if the fever goes above 103°F or lasts more than 3 days."`;

  const result = await model.generateContent(prompt);
  const aiResponse = result.response.text();
  
  return {
    stage: "CONVERSATIONAL",
    type: "general_health",
    response: aiResponse,
    currentDetails: details,
    nextAction: "continue_conversation",
    uiHint: "Show response with text input for user to continue conversation"
  };
}

/**
 * STAGE 2: Generate list of possible diagnoses with confidence levels
 */
async function generateDiagnosisList(message, details, chatHistory, currentContext = {}) {

  const { injury_name, body_part, symptoms, severity, duration, context, mechanism } = details;
  
  // Extract past injuries from context if available
  const pastInjuries = currentContext?.pastInjuries || [];
  const pastInjuriesContext = pastInjuries.length > 0
    ? `\n\nPast Medical History (from user's previous chats):\n${pastInjuries.map((injury, i) => 
        `${i + 1}. ${injury.date} - ${injury.bodyPart}: ${injury.symptoms.join(', ')}`
      ).join('\n')}\n\nNote: Consider this history when providing recommendations, especially for recurring injuries or related body parts.`
    : '';
  
  // Get relevant rehab documentation from RAG (gracefully handle DB errors)
  let ragResult = null;
  try {
    ragResult = await queryRAG(message, {
      // Pass contextual hints to bias retrieval
      injuryId: currentContext?.injury_id || null,
      bodyPartId: currentContext?.body_part_id || mapBodyPartToId(details.body_part)
    });
    
    // Check if RAG returned an error in metadata
    if (ragResult?.metadata?.error) {
      console.warn("⚠️ RAG returned error, proceeding without database:", ragResult.metadata.error);
      ragResult = null;
    }
  } catch (err) {
    console.warn("⚠️ RAG service unavailable, proceeding without database:", err.message);
    ragResult = null;
  }

// 🔎 Step 2: Evaluate relevance (coverageScore + content presence)
const coverageScore = ragResult?.coverageScore ?? 0;
// In generateDiagnosisList()
const hasRelevantContext = !!ragResult?.ragUsed && !!ragResult?.context?.trim();


// 🧩 Step 3: Prepare context string if relevant
const ragContext = hasRelevantContext
  ? `The following evidence-based rehabilitation context was retrieved from HealthBay’s database:\n\n${ragResult.context}`
  : null;
  
const prompt = hasRelevantContext
  ? `
You are HealthBay, an AI rehabilitation assistant specializing in musculoskeletal injuries.

User's injury information:
- Injury: ${injury_name || 'Unknown'}
- Body Part: ${body_part || 'Not specified'}
- Symptoms: ${symptoms?.join(', ') || 'Not specified'}
- Severity: ${severity || 'Unknown'}
- Duration: ${duration || 'Not specified'}
- Context: ${context || 'Not specified'}
- Mechanism: ${mechanism || 'Not specified'}${pastInjuriesContext}

Relevant rehabilitation documentation from verified sources:
${ragResult.context}

Instructions:
- Use the provided context to inform diagnoses and explanations.
- Only include findings directly supported by the retrieved text.
- If additional reasoning is needed, label it as "AI-suggested".
- DO NOT include source citations like [Source 1] or [1] in the diagnosis descriptions.
- Keep all text natural and conversational without reference markers.
- Maintain empathy and clarity in your tone.

Return ONLY a JSON object with this exact structure:
{
  "summary": "2-3 sentence conversational acknowledgment. Show empathy for their situation. Explain what you're analyzing. Make it personal and engaging, not clinical. End with something encouraging or a question.",
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
  "immediateAdvice": "Brief immediate care advice (RICE protocol or similar) in 2-3 sentences. Make it conversational and actionable.",
  "followUpQuestion": "A specific engaging question to ask the user (e.g., 'Which of these feels most like what you're experiencing?' or 'Would you like to learn more about any of these diagnoses?')"
}

Make IDs lowercase with hyphens (e.g., "ankle-sprain", "high-ankle-sprain").
Make the tone warm, professional, and conversational - like a knowledgeable friend who cares.`
    : `
You are HealthBay, an AI rehabilitation assistant specializing in musculoskeletal injuries.

User's injury information:
- Injury: ${injury_name || 'Unknown'}
- Body Part: ${body_part || 'Not specified'}
- Symptoms: ${symptoms?.join(', ') || 'Not specified'}
- Severity: ${severity || 'Unknown'}
- Duration: ${duration || 'Not specified'}
- Context: ${context || 'Not specified'}
- Mechanism: ${mechanism || 'Not specified'}${pastInjuriesContext}

Instructions:
- Provide evidence-based diagnosis suggestions
- Maintain empathy and clarity in your tone
- DO NOT include source citations in the descriptions

Return ONLY a JSON object with this exact structure:
{
  "summary": "2-3 sentence conversational acknowledgment. Show empathy for their situation. Explain what you're analyzing. Make it personal and engaging, not clinical. End with something encouraging or a question.",
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
  "immediateAdvice": "Brief immediate care advice (RICE protocol or similar) in 2-3 sentences. Make it conversational and actionable.",
  "followUpQuestion": "A specific engaging question to ask the user (e.g., 'Which of these feels most like what you're experiencing?' or 'Would you like to learn more about any of these diagnoses?')"
}

Make IDs lowercase with hyphens (e.g., "ankle-sprain", "high-ankle-sprain").
Make the tone warm, professional, and conversational - like a knowledgeable friend who cares.`;

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
      summary: "Based on your symptoms, here are the possible conditions I've identified. Let's work together to figure out what's going on.",
      diagnoses: [],
      immediateAdvice: "For now, apply ice and rest the affected area. This will help reduce any inflammation.",
      followUpQuestion: "Which of these diagnoses sounds most like what you're experiencing?"
    };
  }
  
  // Combine summary and follow-up question for conversational response
  const conversationalResponse = parsedDiagnoses.followUpQuestion 
    ? `${parsedDiagnoses.summary}\n\n${parsedDiagnoses.followUpQuestion}`
    : parsedDiagnoses.summary;
  
  return {
    stage: "DIAGNOSIS_LIST",
    type: "injury",
    response: conversationalResponse,
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

CRITICAL TREATMENT GUIDELINES:
- ONLY recommend treatments that can be done by the patient themselves at home
- Self-care treatments include: RICE protocol, over-the-counter pain medication, stretching, strengthening exercises, ice/heat therapy, compression, elevation, rest, bracing/taping
- For treatments requiring medical professionals (injections, surgery, prescription medications, imaging, manual therapy by professionals), clearly state "Consult a doctor for professional medical treatment"
- Never recommend specific prescription medications, injections, or surgical procedures as self-care
- Always emphasize when professional medical evaluation is needed
- DO NOT include source citations like [Source 1] or [1] in any of the text
- Keep all descriptions natural and conversational without reference markers

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
    "immediate": ["ONLY self-care actions like RICE protocol, OTC pain relief"],
    "ongoing": ["ONLY at-home treatments: exercises, stretches, ice/heat, compression"],
    "rehabilitation": ["ONLY self-guided exercises and progressions"],
    "requiresProfessional": ["List treatments requiring doctor: injections, imaging, prescription meds, surgery, physical therapy"]
  },
  "diagnosticTests": [
    {
      "name": "Test name (e.g., 'Anterior Drawer Test')",
      "description": "How to perform this test at home",
      "positiveIndicator": "What indicates a positive test"
    }
  ],
  "redFlags": ["List of symptoms requiring immediate medical attention"],
  "whenToSeeDoctorImmediate": ["Situations requiring immediate medical care"],
  "whenToSeeDoctor24_48hrs": ["Situations to see doctor within 24-48 hours"],
  "selfCareAppropriate": "When self-care is appropriate vs when to see a doctor",
  "estimatedRecoveryTime": "e.g., '4-6 weeks for moderate cases with proper self-care'",
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
    response: `Here's detailed information about ${diagnosisDetail.diagnosisName}. I've included symptoms, causes, recovery timeline, treatment options, and diagnostic tests you can perform. Feel free to ask me any questions!`,
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
    response: testPlan.introduction || "Let's begin the diagnostic tests. I'll guide you through each test step by step.",
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
    
    console.log(`📝 SUBMIT_RESULT - Test ${currentTestIndex + 1} of ${testPlan.tests.length}`);
    console.log(`📦 Result:`, result, `Pain Level:`, painLevel);
    
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
    
    console.log(`🔍 Next test index: ${nextTestIndex}, Total tests: ${testPlan.tests.length}`);
    console.log(`🎯 Is last test? ${nextTestIndex >= testPlan.tests.length}`);
    
    // Check if more tests remain
    if (nextTestIndex < testPlan.tests.length) {
      // Move to next test
      return {
        stage: "DIAGNOSTIC_TEST_TRANSITION",
        type: "injury",
        response: `Great! You've completed the ${currentTest.name}. Result: ${result}. Ready to move on to the next test?`,
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
          currentTest: nextTestIndex,
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
      console.log("✅✅✅ ALL TESTS COMPLETE - Calling analyzeDiagnosticResults...");
      console.log(`📊 Total results collected: ${updatedResults.length}`);
      console.log(`📋 Results:`, JSON.stringify(updatedResults, null, 2));
      
      const completionResponse = await analyzeDiagnosticResults(testSession.diagnosisId, updatedResults, currentContext);
      
      console.log("🎉 Completion response generated:");
      console.log(`  - Stage: ${completionResponse.stage}`);
      console.log(`  - Has analysis: ${!!completionResponse.analysis}`);
      
      return completionResponse;
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

CRITICAL TREATMENT GUIDELINES:
- ONLY recommend treatments that can be done by the patient themselves at home
- Self-care treatments include: RICE protocol, over-the-counter pain medication, stretching, strengthening exercises, ice/heat therapy, compression, elevation, rest, bracing/taping
- For treatments requiring medical professionals (injections, surgery, prescription medications, imaging, manual therapy by professionals), clearly state: "For [treatment name], consult a doctor for professional medical treatment"
- Never recommend specific prescription medications, injections, or surgical procedures as self-care
- Always emphasize when professional medical evaluation is needed based on test results

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
    "immediate": ["ONLY self-care: RICE protocol, OTC pain relief based on test results"],
    "week1": ["ONLY at-home treatments: exercises, ice/heat, compression adjusted for severity"],
    "week2_3": ["ONLY self-guided exercises and progressions"],
    "ongoing": ["ONLY at-home long-term rehabilitation"],
    "requiresProfessional": ["If test results indicate need for: injections, imaging, prescription meds, physical therapy, surgery - list here"]
  },
  "nextSteps": "What the user should do next (continue with treatment plan, see doctor if test results concerning, etc.)",
  "redFlags": ["Any concerning findings from the tests that warrant professional evaluation"],
  "estimatedRecovery": "Updated recovery timeline based on test severity with self-care",
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
    response: `Great job completing all the diagnostic tests! Based on your results, I've refined the diagnosis and created a personalized treatment plan for you. ${analysis.summary}`,
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
  const prompt = `You are HealthBay (MedBay), a friendly and conversational AI assistant specializing in musculoskeletal injury rehabilitation and recovery.

The user said: "${message}"

This doesn't appear to be about musculoskeletal injuries or health conditions. 

Provide a warm, conversational response that:
1. Acknowledges their message with personality
2. Gently redirects them to topics you can help with (injuries, sprains, strains, joint pain, rehabilitation, sports injuries, recovery plans)
3. Give 2-3 specific examples of what you can help with
4. Maintain a friendly, approachable tone - like a helpful friend
5. End with a question asking if they have any injury or pain concerns you can help with

Make it engaging and conversational, not robotic. Show some personality while remaining professional.`;

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