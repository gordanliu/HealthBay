// server/src/controllers/chatController.js
import { queryRAG } from "../services/ragService.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

export async function handleChat(req, res) {
  try {
    const { message, chatHistory = [] } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: "Message is required" });
    }

    console.log("🗣️ Received:", message);
    
    // Step 1: Classify the input type (injury vs general health)
    const classification = await classifyInput(message);
    console.log("📊 Classification:", classification.type);
    
    let response;
    
    if (classification.type === "injury") {
      // Handle musculoskeletal injury query
      response = await handleInjuryQuery(message, classification.details, chatHistory);
    } else if (classification.type === "general_health") {
      // Handle general health/illness query
      response = await handleGeneralHealthQuery(message, classification.details, chatHistory);
    } else {
      // Handle off-topic or unclear queries
      response = await handleGeneralQuery(message, chatHistory);
    }
    
    // Log interaction for analysis
    logInteraction(message, classification, response);
    
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
async function classifyInput(message) {
  const prompt = `Analyze this health-related message and classify it:

Message: "${message}"

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
    "mechanism": "string (how injury occurred, if mentioned)"
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
 * Handle musculoskeletal injury queries
 */
async function handleInjuryQuery(message, details, chatHistory) {
  const { injury_name, body_part, symptoms, severity, duration, context } = details;
  
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

User's message: "${message}"

Rehabilitation documentation context:
${ragContext || 'No specific documentation found for this injury.'}

Provide a comprehensive response with:

1. **Possible Injuries** (2-3 most likely based on symptoms):
   - List injuries with confidence levels (high/medium/low)
   - Brief explanation of each

2. **Immediate Care Recommendations**:
   - RICE protocol or appropriate first aid
   - What to do in the first 24-48 hours
   - Pain management suggestions

3. **Recovery Timeline**:
   - Expected healing time for each possible injury
   - Phases of recovery (acute, subacute, chronic)

4. **Diagnostic Questions**:
   - Ask 2-3 specific movement tests or questions to help narrow down the diagnosis
   - Example: "Can you bear weight on your ankle?" or "Does it hurt more when you move it in a certain direction?"

5. **Treatment Recommendations**:
   - Exercises or therapies for each recovery phase
   - When to progress to next phase

6. **Red Flags**:
   - Symptoms that require immediate medical attention
   - When to see a doctor vs. self-care

**Important**: Include medical disclaimer at the end.

Format your response in a clear, structured way.`;

  const result = await model.generateContent(prompt);
  const aiResponse = result.response.text();
  
  return {
    type: "injury",
    response: aiResponse,
    classification: details,
    ragUsed: !!ragContext,
    diagnosticMode: true,
    disclaimer: "⚠️ This is AI-generated guidance based on general information. Always consult a healthcare professional for accurate diagnosis and personalized treatment."
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

1. **Possible Conditions** (2-3 most likely):
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
function logInteraction(message, classification, response) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    message: message.substring(0, 200), // Truncate for privacy
    classification: classification.type,
    responseType: response.type,
    ragUsed: response.ragUsed || false
  };
  
  console.log("📝 Interaction Log:", JSON.stringify(logEntry));
  
  // TODO: Your database teammate can implement persistent logging
  // Example: await db.query('INSERT INTO chat_logs ...', logEntry);
}