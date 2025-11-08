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
 * 4. GENERAL - Handle off-topic queries
 */
export async function handleChat(req, res) {
  try {
    const { 
      message, 
      chatHistory = [], 
      diagnosisId = null,
      currentContext = {} 
    } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: "Message is required" });
    }

    console.log("🗣️ Received:", message);
    console.log("📋 Current Context:", currentContext);
    console.log("🔍 Diagnosis ID:", diagnosisId);
    
    let response;
    
    // If diagnosisId is provided, user clicked on a diagnosis - show detailed info
    if (diagnosisId) {
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
Ask about the most critical missing information first (symptoms, mechanism, duration).

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
    nextAction: "conversation",
    uiHint: "Show detailed diagnosis page with sections. User can ask follow-up questions."
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