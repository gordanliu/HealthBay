// server/src/controllers/chatController.js
import { queryRAG } from "../services/ragService.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "../config/db.js";
import { DEFAULT_USER_ID } from "../config/constants.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

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

// 🧠 Map common body part names to UUIDs in the database
function mapBodyPartToId(bodyPart) {
  if (!bodyPart) return null;
  const map = {
    shoulder: "0b45b8a5-7b57-4801-a08d-15833dc18031",
    hand: "1050c110-3f82-475e-9062-d100ccf6a6c9",
    foot: "11073780-db6c-4e02-a66d-2279ef4d04c2",
    neck: "181809e1-1992-4574-915d-cb72413f6cba",
    back: "19e77db8-54ff-40a6-94df-dca97533e81d",
    wrist: "38cdf282-0a70-44a3-a126-6ee79133fcb1",
    torso: "46459f39-ddc6-427f-b840-cf22f97d3ff3",
    calf: "477a2c34-467e-43b9-85c5-761cd6119118",
    forearm: "643017eb-9af1-4a10-a34c-0d7e1645d18c",
    knee: "75b9c1bc-f117-414e-b29b-74b3b484e843",
    thigh: "773fd2e4-10b6-4010-b3fe-0f2c0e503c9c",
    leg: "a29d235c-8b2b-4f48-ba62-83e9799166c6",
    hip: "c4c3bb5e-cbda-49ed-928e-8fbc9151bac0",
    ankle: "ce023d78-654c-422e-85b7-030725fc4601",
    pelvis: "e096ad7a-68c0-4b7c-b359-da209dc303aa",
    elbow: "e128ddfa-0238-4aab-8efa-16a04d365a23",
  };

  const normalized = bodyPart.trim().toLowerCase();

  // Handle basic plural / synonym cases
  const normalizedKey = normalized
    .replace(/\s+/g, "")
    .replace(/s$/, ""); // e.g. "knees" -> "knee"

  return map[normalizedKey] || null;
}


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
      selectedSymptoms = null,  // New: for symptom checklist submission
      startTreatmentChat = false,  // New: for transitioning from diagnostic tests to treatment chat
      confirmInjury = false  // New: for confirming injury and starting open chat
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
    console.log("💬 Start Treatment Chat:", startTreatmentChat);
    console.log("✅ Confirm Injury:", confirmInjury);
    
    let response;
    
    // If user wants to confirm injury and start open chat
    if (confirmInjury) {
      response = await handleConfirmInjury(diagnosisId, currentContext, chatHistory);
    }
    // If user wants to start treatment chat from diagnostic tests
    else if (startTreatmentChat) {
      response = await handleTreatmentChat(currentContext, chatHistory);
    }
    // If user wants to exit diagnostic testing and return to diagnosis detail
    else if (exitDiagnosticTest) {
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
    // If we have ongoing context from GATHERING_INFO stage, handle as conversational follow-up
    else if (currentContext.stage === "GATHERING_INFO" && currentContext.currentDetails) {
      response = await handleConversationalFollowUp(message, currentContext, chatHistory);
    }
    // If we have diagnosis context (after diagnosis list), handle conversational follow-up
    else if (currentContext.stage === "DIAGNOSIS_LIST" && currentContext.currentDetails) {
      response = await handleConversationalFollowUp(message, currentContext, chatHistory);
    }
    // If we're in TREATMENT_CHAT stage, handle as conversational follow-up with full context
    else if (currentContext.stage === "TREATMENT_CHAT" && currentContext.currentDetails) {
      response = await handleTreatmentChatFollowUp(message, currentContext, chatHistory);
    }
    // If we're in CONFIRMED_INJURY_CHAT stage, handle as conversational follow-up with diagnosis context
    else if (currentContext.stage === "CONFIRMED_INJURY_CHAT" && currentContext.currentDetails) {
      response = await handleConfirmedInjuryFollowUp(message, currentContext, chatHistory);
    }
    // If we have other ongoing context (DIAGNOSIS_DETAIL, CONVERSATIONAL, etc.), handle follow-up
    else if (currentContext.currentDetails && Object.keys(currentContext.currentDetails).length > 0 && currentContext.stage) {
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
    

    // --- 💾 Persist chat + messages ---
try {
  const userId = DEFAULT_USER_ID;
  const aiText = response?.response || response?.diagnosisDetail?.overview || "No AI response";
  
  // Get chatId from request if provided (for continuing an existing chat)
  // If startNewChat is true, ignore chatId and always create a new chat
  const startNewChat = req.body.startNewChat || false;
  const chatId = startNewChat ? null : (req.body.chatId || null);
  
  // Build comprehensive metadata for context restoration
  const responseContext = response?.currentContext || {};
  const mergedContext = { ...currentContext, ...responseContext };
  
  const aiMetadata = {
    stage: response?.stage || mergedContext.stage || "unknown",
    type: response?.type || mergedContext.type || "unknown",
    ragUsed: response?.ragUsed || mergedContext.ragUsed || false,
    coverageScore: response?.coverageScore || mergedContext.coverageScore || 0,
    provenance: response?.provenance || mergedContext.provenance || "unknown",
    diagnosisId: response?.diagnosisId || mergedContext.diagnosisId || null,
    diagnosisName: response?.diagnosisName || mergedContext.diagnosisName || null,
    // Store essential context for restoration
    currentDetails: response?.currentDetails || mergedContext.currentDetails || {},
    // Store diagnosis detail reference (not full object to avoid size issues)
    diagnosisDetail: response?.diagnosisDetail ? {
      diagnosisName: response.diagnosisDetail.diagnosisName,
      overview: response.diagnosisDetail.overview,
      treatmentPlan: response.diagnosisDetail.treatmentPlan,
      recoveryTimeline: response.diagnosisDetail.recoveryTimeline,
    } : (mergedContext.diagnosisDetail ? {
      diagnosisName: mergedContext.diagnosisDetail.diagnosisName,
      overview: mergedContext.diagnosisDetail.overview,
      treatmentPlan: mergedContext.diagnosisDetail.treatmentPlan,
      recoveryTimeline: mergedContext.diagnosisDetail.recoveryTimeline,
    } : null),
    // Store test session summary
    testSession: mergedContext.testSession ? {
      diagnosisId: mergedContext.testSession.diagnosisId,
      testResults: mergedContext.testSession.testResults,
      analysis: mergedContext.testSession.analysis,
    } : null,
    // Store test results and analysis
    testResults: response?.testResults || mergedContext.testResults || null,
    analysis: response?.analysis || mergedContext.analysis || null,
    refinedTreatmentPlan: response?.refinedTreatmentPlan || mergedContext.refinedTreatmentPlan || null,
  };

  let activeChat;
  
  if (chatId) {
    // Load existing chat
    const { data: chat, error: chatErr } = await supabase
      .from("chats")
      .select("*")
      .eq("id", chatId)
      .eq("user_id", userId)
      .single();

    if (chatErr) {
      console.error("⚠️ Chat lookup error:", chatErr);
    } else {
      activeChat = chat;
    }
  }

  // If no active chat specified, create a new one (don't reuse existing active chats)
  // This ensures each "new consultation" creates a separate chat
  if (!activeChat) {
    // Always create a new chat when chatId is not provided
    // This prevents overwriting old chats
    const chatTitle = response?.diagnosisName || 
                     response?.currentDetails?.injury_name || 
                     response?.currentDetails?.body_part + " injury" ||
                     "New Consultation";
    
    const { data: newChat, error: newChatErr } = await supabase
      .from("chats")
      .insert({
        user_id: userId,
        title: chatTitle,
        context_summary: message.slice(0, 120),
        status: "active",
      })
      .select()
      .single();

    if (newChatErr) {
      console.error("❌ Chat creation failed:", newChatErr);
    } else {
      activeChat = newChat;
      console.log("✅ Created new chat:", newChat.id);
    }
  }

  if (activeChat) {
    // Insert user message
    const { error: userMsgError } = await supabase
      .from("messages")
      .insert({
        chat_id: activeChat.id,
        sender: "user",
        text: message,
      });

    if (userMsgError) console.error("❌ User message insert error:", userMsgError);

    // Insert AI message with metadata
    // Format sources for JSONB storage
    let sourceDocs = null;
    if (response?.sources) {
      if (typeof response.sources === 'string') {
        // If it's a string with newlines, split it
        sourceDocs = response.sources.split('\n')
          .filter(s => s.trim())
          .map(s => ({ text: s.trim() }));
      } else if (Array.isArray(response.sources)) {
        // If it's an array, format each item
        sourceDocs = response.sources.map(s => {
          if (typeof s === 'string') {
            return { text: s };
          } else if (s && typeof s === 'object') {
            return s;
          }
          return { text: String(s) };
        }).filter(s => s.text);
      }
    }

    const { error: aiMsgError } = await supabase
      .from("messages")
      .insert({
        chat_id: activeChat.id,
        sender: "ai",
        text: aiText,
        metadata: aiMetadata,
        source_docs: sourceDocs && sourceDocs.length > 0 ? sourceDocs : null,
      });

    if (aiMsgError) console.error("❌ AI message insert error:", aiMsgError);

    // Update chat summary + last activity
    const updateTitle = response?.diagnosisName || 
                       response?.currentDetails?.injury_name || 
                       activeChat.title;
    
    // Get current message count from database
    const { count: messageCount } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("chat_id", activeChat.id);
    
    await supabase
      .from("chats")
      .update({
        last_activity: new Date().toISOString(),
        context_summary: message.slice(0, 120),
        title: updateTitle,
        messages_count: messageCount || 0,
      })
      .eq("id", activeChat.id);

    console.log(`💾 Saved messages for chat ${activeChat.id}`);
    
    // Include chatId in response so frontend can continue using it
    response.chatId = activeChat.id;
  }
} catch (persistErr) {
  console.error("💥 Chat persistence failed:", persistErr);
}


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
  
  console.log("🔍 Injury Flow - Checking details:", details);
  
  // Determine what information is missing
  // We need at least: body_part, symptoms (specific ones), duration, and either context or mechanism
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
  
  // Duration is critical
  if (!duration || duration === 'Not specified' || duration === 'unknown' || duration.toLowerCase().includes('not specified')) {
    missingInfo.push('duration');
  }
  
  // Need either context or mechanism (how it happened)
  if ((!context || context === 'Not specified' || context === 'unknown') && 
      (!mechanism || mechanism === 'Not specified' || mechanism === 'unknown')) {
    missingInfo.push('context_or_mechanism');
  }
  
  console.log("❓ Missing Info:", missingInfo);
  
  // STAGE 1: GATHERING_INFO - If critical information is missing, ask for it
  if (missingInfo.length > 0 && !currentContext.infoGathered) {
    return await gatherMissingInfo(message, details, missingInfo);
  }
  
  // STAGE 2: DIAGNOSIS_LIST - Present possible diagnoses
  console.log("✅ All info gathered, proceeding to diagnosis list");
return await generateDiagnosisList(message, details, chatHistory, currentContext);


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
  const prompt = `You are HealthBay (MedBay), an empathetic and conversational AI rehabilitation assistant. The user has reported an injury, but we need more details to help them properly.

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

Create a dynamic, conversational response that:
1. Acknowledges what they've shared with empathy
2. Explains why you need more details (to give them the best guidance)
3. Asks 2-3 specific questions about the missing information
4. Uses a warm, professional tone - like talking to a friend who's also a healthcare professional
5. Ends with an engaging question that prompts them to respond

Make it feel like a natural conversation, NOT a form to fill out.
Be encouraging and supportive about their recovery journey.

Use plain text formatting only - no bold (**), asterisks, or other markdown formatting in numbered lists or questions.`;

  const result = await model.generateContent(prompt);
  const aiResponse = result.response.text();
  
  return {
    stage: "GATHERING_INFO",
    type: "injury",
    response: aiResponse,
    missingInfo: missingInfo,
    currentDetails: details,
    nextAction: "answer_questions",
    uiHint: "Show text input for user to answer questions",
    // Include the stage in currentContext for frontend to send back
    currentContext: {
      stage: "GATHERING_INFO",
      currentDetails: details,
      missingInfo: missingInfo
    }
  };
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
  
  // If we're in GATHERING_INFO stage, the user is answering our questions
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
  
  const prompt = `You are HealthBay (MedBay), a conversational AI rehab assistant. This is an ONGOING conversation about their ${details.body_part || 'injury'}.

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
`}

Examples of good conversational responses:
- User: "Does it usually swell a lot?" → You: "Yeah, swelling is super common with ${details.body_part || 'this type of'} injuries, especially in the first few days. Ice will help bring it down. Is the swelling getting worse or staying about the same?"
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
    currentDetails: details,
    concernFlagged: hasHarmfulIntent,
    nextAction: "continue_conversation",
    uiHint: "Show response with text input for user to continue conversation"
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
  
  // If other critical info is still missing AND we haven't asked before, ask ONCE
  // Check if we've already asked (indicated by substage being SYMPTOM_CHECKLIST or interactionCount)
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
  console.log("✅ Proceeding to diagnosis list after symptom selection");
  return await generateDiagnosisList(message, updatedDetails, chatHistory, currentContext);

}

/**
 * STAGE 2: Generate list of possible diagnoses with confidence levels
 */
async function generateDiagnosisList(message, details, chatHistory, currentContext = {}) {

  const { injury_name, body_part, symptoms, severity, duration, context, mechanism } = details;
  
  // Get relevant rehab documentation from RAG (gracefully handle DB errors)
let ragResult = null;
try {
  ragResult = await queryRAG(message, {
    // Pass contextual hints to bias retrieval
    injuryId: currentContext?.injury_id || null,
    bodyPartId: currentContext?.body_part_id || mapBodyPartToId(details.body_part)
  });
} catch (err) {
  console.warn("⚠️ RAG service unavailable:", err.message);
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
- Mechanism: ${mechanism || 'Not specified'}

Relevant rehabilitation documentation from verified sources:
${ragResult.context}

Instructions:
- Use the provided context to inform diagnoses and explanations.
- Only include findings directly supported by the retrieved text.
- If additional reasoning is needed, label it as "AI-suggested".
- Always mention when a source (e.g. [Source 1]) supports your statement.
- Maintain empathy and clarity in your tone.

Return ONLY a JSON object with this structure:
{
  "summary": "2-3 sentence conversational acknowledgment explaining what you found and your thought process.",
  "diagnoses": [
    {
      "id": "unique-id-1",
      "name": "Diagnosis Name",
      "confidence": "high|medium|low",
      "shortDescription": "One sentence summary",
      "matchedSymptoms": ["symptom1", "symptom2"],
      "typicalCauses": "Brief explanation"
    }
  ],
  "immediateAdvice": "Short practical advice (e.g., RICE or gentle movement)",
  "followUpQuestion": "Ask an engaging question (e.g., 'Which of these feels most accurate to you?')"
}`
  : `
You are HealthBay, an AI rehabilitation assistant specializing in musculoskeletal injuries.

User's injury information:
- Injury: ${injury_name || 'Unknown'}
- Body Part: ${body_part || 'Not specified'}
- Symptoms: ${symptoms?.join(', ') || 'Not specified'}
- Severity: ${severity || 'Unknown'}
- Duration: ${duration || 'Not specified'}
- Context: ${context || 'Not specified'}
- Mechanism: ${mechanism || 'Not specified'}

No relevant context was found in HealthBay’s knowledge base. Use your own reasoning based on general medical knowledge to suggest possible diagnoses.

Instructions:
- Clearly mark the response as "AI-generated (no source match)".
- Stay evidence-based and safe.
- Be conversational, empathetic, and concise.

Return ONLY a JSON object with the same structure as above.
`;


  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  console.log("📚 RAG context used:", hasRelevantContext, "Coverage:", coverageScore.toFixed(2));

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
  
  const provenanceLabel = hasRelevantContext
  ? "Based on verified clinical sources from HealthBay’s database."
  : "⚠️ AI-generated (no source match).";

// 🧩 Build source summary list if RAG was used
  const sourceSummary = hasRelevantContext
  ? ragResult.sources?.map((s, i) => `[${i + 1}] ${s.title} - ${s.source_url || "No link available"}`).join("\n")
  : null;  

return {
  stage: "DIAGNOSIS_LIST",
  type: "injury",
  response: conversationalResponse,
  diagnoses: parsedDiagnoses.diagnoses,
  immediateAdvice: parsedDiagnoses.immediateAdvice,
  currentDetails: details,
  ragUsed: hasRelevantContext,
  provenance: provenanceLabel,
  sources: sourceSummary, // 🔹 add source links if available
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
  
  // Build enhanced context that includes diagnosis detail
  const enhancedContext = {
    ...currentContext,
    stage: "DIAGNOSIS_DETAIL",
    diagnosisId: diagnosisId,
    diagnosisName: diagnosisDetail.diagnosisName || diagnosisId,
    diagnosisDetail: diagnosisDetail,
    currentDetails: {
      ...details,
      diagnosisId: diagnosisId,
      diagnosisName: diagnosisDetail.diagnosisName || diagnosisId
    }
  };
  
  return {
    stage: "DIAGNOSIS_DETAIL",
    type: "injury",
    diagnosisId: diagnosisId,
    diagnosisDetail: diagnosisDetail,
    currentContext: enhancedContext,
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
      response: currentTest.steps[0], // Add response field for client
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
        currentTest: currentTestIndex + 1,
        totalTests: testPlan.tests.length,
        currentStep: 1,
        totalSteps: totalSteps,
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
        response: currentTest.steps[nextStepIndex], // Add response field for client
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
          currentTest: currentTestIndex + 1,
          totalTests: testPlan.tests.length,
          currentStep: nextStepIndex + 1,
          totalSteps: totalSteps,
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
        response: `You've completed the ${currentTest.name}. ${currentTest.whatToLookFor}\n\nDid you experience this during the test?`,
        testSession: testSession,
        currentTest: {
          id: currentTest.id,
          name: currentTest.name,
          whatToLookFor: currentTest.whatToLookFor
        },
        question: `You've completed the ${currentTest.name}. ${currentTest.whatToLookFor}\n\nDid you experience this during the test?`,
        progress: {
          currentTest: currentTestIndex + 1,
          totalTests: testPlan.tests.length,
          currentStep: totalSteps,
          totalSteps: totalSteps,
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
 * Handle transition from diagnostic tests to treatment chat
 * Generates a comprehensive treatment plan and sets up context for follow-up questions
 */
async function handleTreatmentChat(currentContext, chatHistory) {
  const details = currentContext.currentDetails || {};
  // Check multiple locations for diagnosis and test data
  const diagnosisId = currentContext.testSession?.diagnosisId || currentContext.diagnosisId;
  const testResults = currentContext.testResults || currentContext.testSession?.testResults || [];
  const analysis = currentContext.analysis || currentContext.testSession?.analysis || {};
  
  // Build context string for treatment plan generation
  const testResultsString = testResults.length > 0
    ? testResults.map(r => `${r.testName}: ${r.result}${r.painLevel ? ` (Pain: ${r.painLevel}/10)` : ''}`).join('\n')
    : 'No test results available';
  
  const refinedTreatmentPlan = analysis.refinedTreatmentPlan || {};
  const diagnosisName = analysis.refinedDiagnosis?.name || diagnosisId || 'your injury';
  
  const prompt = `You are HealthBay, an AI rehabilitation assistant. The user has just completed diagnostic tests and wants to discuss their treatment plan.

User's Context:
- Diagnosis: ${diagnosisName}
- Body Part: ${details.body_part || 'Not specified'}
- Symptoms: ${details.symptoms?.join(', ') || 'Not specified'}
- Duration: ${details.duration || 'Not specified'}
- Context: ${details.context || 'Not specified'}

Test Results:
${testResultsString}

Refined Treatment Plan Available:
- Immediate Care: ${refinedTreatmentPlan.immediate?.join(', ') || 'RICE protocol, rest'}
- Week 1: ${refinedTreatmentPlan.week1?.join(', ') || 'Continuing care'}
- Weeks 2-3: ${refinedTreatmentPlan.week2_3?.join(', ') || 'Progressive rehabilitation'}
- Ongoing: ${refinedTreatmentPlan.ongoing?.join(', ') || 'Long-term care'}
${refinedTreatmentPlan.requiresProfessional?.length > 0 ? `- Professional Care Needed: ${refinedTreatmentPlan.requiresProfessional.join(', ')}` : ''}

Analysis Summary:
- Confidence: ${analysis.confidenceLevel || 'moderate'}
- Assessment: ${analysis.assessment || 'Tests completed successfully'}
- Recovery Timeline: ${analysis.estimatedRecovery || '4-6 weeks'}

Generate a comprehensive, conversational treatment plan message that:
1. Acknowledges their completion of the diagnostic tests
2. Provides a clear, organized treatment plan based on the refined treatment plan data
3. Explains what they should do immediately, in the coming weeks, and long-term
4. Mentions any professional care recommendations if applicable
5. Sets expectations for recovery timeline
6. Encourages them to ask follow-up questions
7. Uses a warm, supportive, and conversational tone (not robotic or clinical)
8. Organize it clearly but keep it conversational - use natural language, not bullet points unless necessary

The message should feel like a helpful conversation starter about their treatment plan. After this message, the user will be able to ask any follow-up questions about their injury, treatment, recovery, etc.`;

  const result = await model.generateContent(prompt);
  const treatmentPlanMessage = result.response.text();
  
  // Build enhanced context that includes all the necessary information for follow-up questions
  const enhancedContext = {
    ...currentContext,
    stage: "TREATMENT_CHAT",
    diagnosisId: diagnosisId,
    diagnosisName: diagnosisName,
    testResults: testResults,
    analysis: analysis,
    refinedTreatmentPlan: refinedTreatmentPlan,
    currentDetails: {
      ...details,
      diagnosisId: diagnosisId,
      diagnosisName: diagnosisName
    }
  };
  
  return {
    stage: "TREATMENT_CHAT",
    type: "injury",
    response: treatmentPlanMessage,
    diagnosisId: diagnosisId,
    diagnosisName: diagnosisName,
    currentContext: enhancedContext,
    currentDetails: enhancedContext.currentDetails,
    testResults: testResults,
    analysis: analysis,
    nextAction: "continue_conversation",
    uiHint: "Show treatment plan message in chat. User can now ask follow-up questions about their injury, treatment, recovery, etc."
  };
}

/**
 * Handle injury confirmation and start open chat
 * User confirms they have the selected diagnosis and wants to discuss it
 */
async function handleConfirmInjury(diagnosisId, currentContext, chatHistory) {
  const details = currentContext.currentDetails || {};
  const diagnosisDetail = currentContext.diagnosisDetail || {};
  const diagnosisName = diagnosisDetail.diagnosisName || diagnosisId || 'your injury';
  
  // Build context for the welcome message
  const bodyPart = details.body_part || 'the affected area';
  const symptoms = details.symptoms?.join(', ') || 'your symptoms';
  const treatmentPlan = diagnosisDetail.treatmentPlan || {};
  const recoveryTimeline = diagnosisDetail.recoveryTimeline || {};
  const whenToSeeDoctor = diagnosisDetail.whenToSeeDoctorImmediate || [];
  const whenToSeeDoctor24_48 = diagnosisDetail.whenToSeeDoctor24_48hrs || [];
  const redFlags = diagnosisDetail.redFlags || [];
  const overview = diagnosisDetail.overview || '';
  const estimatedRecoveryTime = diagnosisDetail.estimatedRecoveryTime || '';
  
  // Query RAG for relevant sources about this diagnosis
  let ragResult = null;
  try {
    const ragQuery = `${diagnosisName} treatment plan rehabilitation recovery`;
    ragResult = await queryRAG(ragQuery, {
      injuryId: currentContext?.injury_id || null,
      bodyPartId: currentContext?.body_part_id || mapBodyPartToId(details.body_part)
    });
  } catch (err) {
    console.warn("⚠️ RAG service unavailable for injury confirmation:", err.message);
    ragResult = null;
  }
  
  const hasRelevantContext = !!ragResult?.ragUsed && !!ragResult?.context?.trim();
  const coverageScore = ragResult?.coverageScore ?? 0;
  
  // Build treatment plan summary
  const immediateCare = treatmentPlan.immediate?.join(', ') || 'RICE protocol (Rest, Ice, Compression, Elevation)';
  const ongoingTreatment = treatmentPlan.ongoing?.join(', ') || 'Continuing care and monitoring';
  const rehabilitation = treatmentPlan.rehabilitation?.join(', ') || 'Progressive rehabilitation exercises';
  const requiresProfessional = treatmentPlan.requiresProfessional?.join(', ') || '';
  
  // Build recovery timeline summary
  const recoveryTimelineSummary = recoveryTimeline.acute || recoveryTimeline.subacute || recoveryTimeline.chronic
    ? `${recoveryTimeline.acute ? 'Acute phase: ' + recoveryTimeline.acute + '\\n' : ''}${recoveryTimeline.subacute ? 'Subacute phase: ' + recoveryTimeline.subacute + '\\n' : ''}${recoveryTimeline.chronic ? 'Return to activity: ' + recoveryTimeline.chronic : ''}`
    : '';
  
  // Build RAG context section if available
  const ragContextSection = hasRelevantContext
    ? `\n\nRelevant evidence-based rehabilitation information from verified sources:\n${ragResult.context}\n\nSources available:\n${ragResult.sources?.map((s, i) => `[Source ${i + 1}] ${s.title}${s.source_url ? ` - ${s.source_url}` : ''}`).join('\n')}`
    : '';
  
  const prompt = `You are HealthBay, an AI rehabilitation assistant. The user has just confirmed they have ${diagnosisName}.

User's Context:
- Confirmed Diagnosis: ${diagnosisName}
- Body Part: ${bodyPart}
- Symptoms: ${symptoms}
- Duration: ${details.duration || 'Not specified'}
- Context: ${details.context || 'Not specified'}

Diagnosis Overview:
${overview || `${diagnosisName} is a condition affecting ${bodyPart}.`}

Treatment Plan Available:
- Immediate Care (First 48 hours): ${immediateCare}
- Ongoing Treatment: ${ongoingTreatment}
- Rehabilitation: ${rehabilitation}
${requiresProfessional ? `- Professional Care: ${requiresProfessional}` : ''}

${recoveryTimelineSummary ? `Recovery Timeline:\\n${recoveryTimelineSummary}` : ''}
${estimatedRecoveryTime ? `Estimated Recovery Time: ${estimatedRecoveryTime}` : ''}

When to See a Doctor:
${whenToSeeDoctor.length > 0 ? `- Immediate Care: ${whenToSeeDoctor.join(', ')}` : ''}
${whenToSeeDoctor24_48.length > 0 ? `- Within 24-48 hours: ${whenToSeeDoctor24_48.join(', ')}` : ''}
${redFlags.length > 0 ? `- Red Flags: ${redFlags.join(', ')}` : ''}${ragContextSection}

Generate a comprehensive, warm, and helpful message that includes:

1. **Opening Acknowledgment** (1-2 sentences):
   - Acknowledge their confirmation of the diagnosis
   - Show empathy and understanding
   - Use a warm, supportive tone

2. **General Overview of the Injury** (2-3 sentences):
   - Provide a clear, concise overview of ${diagnosisName}
   - Explain what it means in simple terms
   - Mention how it typically affects people
   - Reference the overview provided if available

3. **Treatment Plan and Action Steps** (4-6 sentences):
   - Start with immediate care recommendations (what to do now)
   - Explain ongoing treatment steps
   - Describe rehabilitation approach and exercises
   - Mention when to seek professional medical care (doctor, physical therapist, etc.)
   - Include recovery timeline expectations if available
   - Be specific but conversational

4. **When to See a Doctor** (2-3 sentences):
   - Clearly state when they should seek immediate medical attention
   - Mention when to see a doctor within 24-48 hours
   - Highlight any red flags to watch for
   - Emphasize the importance of professional evaluation when needed

5. **Closing** (1-2 sentences):
   - Offer ongoing support and answer questions
   - Encourage them to ask about any aspect of their injury, treatment, or recovery
   - Use an inviting, friendly tone

Guidelines:
- Use natural, conversational language (not clinical or robotic)
- Be empathetic and supportive
- Organize information clearly but flow naturally
- Keep paragraphs short and readable
- Use bullet points or numbered lists only when it makes the information clearer
- Total length should be comprehensive but not overwhelming (aim for 8-12 sentences total)
- Make it feel like a helpful conversation with a knowledgeable friend who cares about their recovery
${hasRelevantContext ? '- IMPORTANT: When referencing information from the provided sources, cite them using [Source 1], [Source 2], etc. based on the source numbers provided above' : ''}
${hasRelevantContext ? '- Prioritize information from the verified sources when available' : ''}
${hasRelevantContext ? '- If you use information from sources, make sure to cite them appropriately in your response' : ''}

Format the response as a single flowing message with clear sections.`;

  const result = await model.generateContent(prompt);
  const welcomeMessage = result.response.text();
  
  // Build source summary for frontend display
  const sourceSummary = hasRelevantContext && ragResult.sources
    ? ragResult.sources.map((s, i) => `[${i + 1}] ${s.title}${s.source_url ? ` - ${s.source_url}` : ''}`).join('\n')
    : null;
  
  const provenanceLabel = hasRelevantContext
    ? "Based on verified clinical sources from HealthBay's database."
    : "⚠️ AI-generated (no source match).";
  
  // Build enhanced context for follow-up questions
  const enhancedContext = {
    ...currentContext,
    stage: "CONFIRMED_INJURY_CHAT",
    diagnosisId: diagnosisId,
    diagnosisName: diagnosisName,
    confirmedDiagnosis: true,
    diagnosisDetail: diagnosisDetail,
    currentDetails: {
      ...details,
      diagnosisId: diagnosisId,
      diagnosisName: diagnosisName,
      confirmedDiagnosis: true
    }
  };
  
  return {
    stage: "CONFIRMED_INJURY_CHAT",
    type: "injury",
    response: welcomeMessage,
    diagnosisId: diagnosisId,
    diagnosisName: diagnosisName,
    currentContext: enhancedContext,
    currentDetails: enhancedContext.currentDetails,
    diagnosisDetail: diagnosisDetail,
    ragUsed: hasRelevantContext,
    provenance: provenanceLabel,
    sources: sourceSummary,
    nextAction: "continue_conversation",
    uiHint: "Show welcome message in chat. User can now ask any questions about their confirmed injury, treatment, recovery, etc."
  };
}

/**
 * Handle follow-up questions for confirmed injury chat
 * Uses diagnosis context and treatment plan information
 */
async function handleConfirmedInjuryFollowUp(message, currentContext, chatHistory) {
  const details = currentContext.currentDetails || {};
  const diagnosisId = currentContext.diagnosisId;
  const diagnosisName = currentContext.diagnosisName || diagnosisId || 'your injury';
  const diagnosisDetail = currentContext.diagnosisDetail || {};
  const treatmentPlan = diagnosisDetail.treatmentPlan || {};
  const recoveryTimeline = diagnosisDetail.recoveryTimeline || {};
  
  // Build treatment plan context
  const treatmentPlanString = `
Immediate Care: ${treatmentPlan.immediate?.join(', ') || 'RICE protocol, rest'}
Ongoing Treatment: ${treatmentPlan.ongoing?.join(', ') || 'Continuing care'}
Rehabilitation: ${treatmentPlan.rehabilitation?.join(', ') || 'Progressive exercises'}
${treatmentPlan.requiresProfessional?.length > 0 ? `Professional Care Needed: ${treatmentPlan.requiresProfessional.join(', ')}` : ''}`;
  
  const recoveryTimelineString = recoveryTimeline.acute || recoveryTimeline.subacute || recoveryTimeline.chronic
    ? `Recovery Timeline: ${recoveryTimeline.acute ? 'Acute: ' + recoveryTimeline.acute + ' ' : ''}${recoveryTimeline.subacute ? 'Subacute: ' + recoveryTimeline.subacute + ' ' : ''}${recoveryTimeline.chronic ? 'Return to Activity: ' + recoveryTimeline.chronic : ''}`
    : '';
  
  const prompt = `You are HealthBay, an AI rehabilitation assistant. The user has confirmed they have ${diagnosisName} and is in an ongoing conversation about their injury.

Current Context:
- Confirmed Diagnosis: ${diagnosisName}
- Body Part: ${details.body_part || 'Not specified'}
- Symptoms: ${details.symptoms?.join(', ') || 'Not specified'}
- Duration: ${details.duration || 'Not specified'}
- Context: ${details.context || 'Not specified'}

Treatment Plan:
${treatmentPlanString}

${recoveryTimelineString ? recoveryTimelineString + '\n' : ''}
Overview: ${diagnosisDetail.overview || 'General information about this injury'}

The user just asked: "${message}"

Provide a helpful, conversational response that:
1. Answers their question directly and accurately
2. References the treatment plan, recovery timeline, or diagnosis information when relevant
3. Uses a warm, supportive, and conversational tone
4. Is concise and focused on their specific question
5. Encourages further questions if appropriate
6. If they ask about something not covered, provide helpful guidance based on the diagnosis and general knowledge
7. Always emphasize safety and when to seek professional medical care if relevant

Be conversational and natural - match their communication style. If they're brief, be brief. Only elaborate when asked.`;

  const result = await model.generateContent(prompt);
  const aiResponse = result.response.text();
  
  return {
    stage: "CONFIRMED_INJURY_CHAT",
    type: "injury",
    response: aiResponse,
    diagnosisId: diagnosisId,
    diagnosisName: diagnosisName,
    currentContext: currentContext,
    currentDetails: details,
    nextAction: "continue_conversation",
    uiHint: "Show response in chat. User can continue asking questions about their confirmed injury, treatment, recovery, etc."
  };
}

/**
 * Handle follow-up questions in treatment chat mode
 * Uses full context including diagnosis, test results, and treatment plan
 */
async function handleTreatmentChatFollowUp(message, currentContext, chatHistory) {
  const details = currentContext.currentDetails || {};
  const diagnosisId = currentContext.diagnosisId;
  const diagnosisName = currentContext.diagnosisName || diagnosisId || 'your injury';
  const testResults = currentContext.testResults || [];
  const analysis = currentContext.analysis || {};
  const refinedTreatmentPlan = currentContext.refinedTreatmentPlan || {};
  
  // Build comprehensive context for the LLM
  const testResultsString = testResults.length > 0
    ? testResults.map(r => `${r.testName}: ${r.result}${r.painLevel ? ` (Pain: ${r.painLevel}/10)` : ''}`).join('\n')
    : 'No test results available';
  
  const treatmentPlanString = `
Immediate Care: ${refinedTreatmentPlan.immediate?.join(', ') || 'RICE protocol, rest'}
Week 1: ${refinedTreatmentPlan.week1?.join(', ') || 'Continuing care'}
Weeks 2-3: ${refinedTreatmentPlan.week2_3?.join(', ') || 'Progressive rehabilitation'}
Ongoing: ${refinedTreatmentPlan.ongoing?.join(', ') || 'Long-term care'}
${refinedTreatmentPlan.requiresProfessional?.length > 0 ? `Professional Care Needed: ${refinedTreatmentPlan.requiresProfessional.join(', ')}` : ''}`;
  
  const prompt = `You are HealthBay, an AI rehabilitation assistant. The user is in an ongoing conversation about their treatment plan for ${diagnosisName}.

Current Context:
- Diagnosis: ${diagnosisName}
- Body Part: ${details.body_part || 'Not specified'}
- Symptoms: ${details.symptoms?.join(', ') || 'Not specified'}
- Duration: ${details.duration || 'Not specified'}
- Context: ${details.context || 'Not specified'}

Test Results:
${testResultsString}

Treatment Plan:
${treatmentPlanString}

Analysis:
- Confidence: ${analysis.confidenceLevel || 'moderate'}
- Assessment: ${analysis.assessment || 'Tests completed'}
- Recovery Timeline: ${analysis.estimatedRecovery || '4-6 weeks'}

The user just asked: "${message}"

Provide a helpful, conversational response that:
1. Answers their question directly and accurately
2. References the treatment plan, test results, or diagnosis when relevant
3. Uses a warm, supportive, and conversational tone
4. Is concise and focused on their specific question
5. Encourages further questions if appropriate
6. If they ask about something not in the treatment plan, provide helpful guidance based on the diagnosis and context

Be conversational and natural - match their communication style. If they're brief, be brief. Only elaborate when asked.`;

  const result = await model.generateContent(prompt);
  const aiResponse = result.response.text();
  
  return {
    stage: "TREATMENT_CHAT",
    type: "injury",
    response: aiResponse,
    diagnosisId: diagnosisId,
    diagnosisName: diagnosisName,
    currentContext: currentContext,
    currentDetails: details,
    nextAction: "continue_conversation",
    uiHint: "Show response in chat. User can continue asking questions about their injury, treatment, recovery, etc."
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

1. Possible Conditions (list of all possible diagnoses with confidence levels):
   - List potential conditions with likelihood
   - Brief explanation

2. Symptom Management:
   - Home care recommendations
   - Over-the-counter remedies (if appropriate)
   - Comfort measures

3. When to Seek Medical Care:
   - Signs that require immediate attention
   - When to see a doctor within 24-48 hours
   - When self-care is appropriate

4. General Advice:
   - Rest, hydration, nutrition
   - What to avoid
   - Expected recovery timeline (if applicable)

5. Note About HealthBay:
   - Mention that HealthBay specializes in musculoskeletal injuries
   - Suggest seeing appropriate healthcare provider for this type of concern

IMPORTANT: Include medical disclaimer and strongly encourage consulting healthcare provider for non-injury conditions.

Use plain text formatting only - no bold (**) or other markdown formatting.`;

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