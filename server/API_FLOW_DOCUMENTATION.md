# HealthBay Chat API Flow Documentation

## Overview
The HealthBay chat API follows a multi-stage conversational flow to guide users from initial injury report through diagnosis selection to detailed treatment information.

## API Endpoint
```
POST /api/chat
```

## Request Body Structure

### Basic Request (Initial message or follow-up)
```json
{
  "message": "string (required)",
  "chatHistory": [
    {
      "role": "user|assistant",
      "content": "string"
    }
  ],
  "currentContext": {
    "currentDetails": {
      "injury_name": "string",
      "body_part": "string",
      "symptoms": ["array"],
      "severity": "string",
      "duration": "string",
      "context": "string",
      "mechanism": "string"
    }
  }
}
```

### Request with Diagnosis Selection
```json
{
  "message": "string (e.g., 'Tell me more about this')",
  "diagnosisId": "string (e.g., 'lateral-ankle-sprain')",
  "currentContext": {
    "currentDetails": { /* user's injury details */ }
  }
}
```

---

## Response Structure by Stage

### Stage 1: GATHERING_INFO
**When:** User provides incomplete information about their injury.

**Purpose:** Collect missing details before providing diagnosis.

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "stage": "GATHERING_INFO",
    "type": "injury",
    "response": "Conversational message asking for missing details",
    "missingInfo": ["duration", "context", "mechanism"],
    "currentDetails": {
      "injury_name": "string or null",
      "body_part": "string or null",
      "symptoms": ["array"],
      "severity": "string",
      "duration": "string or null",
      "context": "string or null",
      "mechanism": "string or null"
    },
    "nextAction": "answer_questions",
    "uiHint": "Show text input for user to answer questions"
  },
  "timestamp": "ISO 8601 string"
}
```

**Frontend Action:**
- Display the `response` message conversationally
- Show text input for user to provide more details
- Include `currentContext` in the next request

**Example:**
```json
{
  "stage": "GATHERING_INFO",
  "response": "Okay, I understand your ankle is hurting. To give you the best advice, I need a little more information.\n\nCould you tell me:\n* What caused the ankle pain?\n* How long has it been hurting?",
  "missingInfo": ["duration", "context", "mechanism"],
  "nextAction": "answer_questions"
}
```

---

### Stage 2: DIAGNOSIS_LIST
**When:** Sufficient information has been gathered.

**Purpose:** Present possible diagnoses for user to select.

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "stage": "DIAGNOSIS_LIST",
    "type": "injury",
    "response": "Brief acknowledgment message",
    "diagnoses": [
      {
        "id": "lateral-ankle-sprain",
        "name": "Lateral Ankle Sprain",
        "confidence": "high|medium|low",
        "shortDescription": "Brief one-sentence description",
        "matchedSymptoms": ["symptom1", "symptom2"],
        "typicalCauses": "Brief explanation"
      }
    ],
    "immediateAdvice": "RICE protocol or immediate care instructions",
    "currentDetails": { /* user's complete injury details */ },
    "ragUsed": false,
    "nextAction": "select_diagnosis",
    "uiHint": "Show list of diagnoses as clickable cards. When user clicks, send diagnosisId in next request"
  },
  "timestamp": "ISO 8601 string"
}
```

**Frontend Action:**
- Display `response` as acknowledgment
- Show `immediateAdvice` prominently
- Render `diagnoses` array as clickable cards/buttons
- Each card should show:
  - `name`
  - `confidence` (use color coding: high=green, medium=yellow, low=orange)
  - `shortDescription`
  - `matchedSymptoms` (checkmarks)
- When user clicks a diagnosis, send new request with `diagnosisId`

**Example:**
```json
{
  "stage": "DIAGNOSIS_LIST",
  "response": "Based on your ankle injury, here are the most likely conditions:",
  "diagnoses": [
    {
      "id": "lateral-ankle-sprain",
      "name": "Lateral Ankle Sprain",
      "confidence": "high",
      "shortDescription": "Damage to ligaments on outside of ankle",
      "matchedSymptoms": ["sharp pains", "rolled ankle"],
      "typicalCauses": "Inversion injury during sports"
    }
  ],
  "immediateAdvice": "Apply RICE protocol: Rest, Ice, Compression, Elevation",
  "nextAction": "select_diagnosis"
}
```

---

### Stage 3: DIAGNOSIS_DETAIL
**When:** User clicks on a specific diagnosis from the list.

**Purpose:** Provide comprehensive treatment and recovery information.

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "stage": "DIAGNOSIS_DETAIL",
    "type": "injury",
    "diagnosisId": "lateral-ankle-sprain",
    "diagnosisDetail": {
      "diagnosisName": "Lateral Ankle Sprain",
      "overview": "2-3 sentence overview",
      "detailedSymptoms": ["symptom1", "symptom2"],
      "causes": "Detailed explanation",
      "recoveryTimeline": {
        "acute": "Days 1-7: Description",
        "subacute": "Weeks 1-3: Description",
        "chronic": "Weeks 3+: Description"
      },
      "treatmentPlan": {
        "immediate": ["action1", "action2"],
        "ongoing": ["treatment1", "treatment2"],
        "rehabilitation": ["exercise1", "exercise2"]
      },
      "diagnosticTests": [
        {
          "name": "Anterior Drawer Test",
          "description": "How to perform",
          "positiveIndicator": "What indicates positive"
        }
      ],
      "redFlags": ["warning1", "warning2"],
      "whenToSeeDoctorImmediate": ["situation1"],
      "whenToSeeDoctor24_48hrs": ["situation1"],
      "selfCareAppropriate": "When self-care is OK",
      "estimatedRecoveryTime": "4-6 weeks",
      "returnToActivityGuidelines": "Guidelines text"
    },
    "disclaimer": "⚠️ Medical disclaimer text",
    "nextAction": "conversation",
    "uiHint": "Show detailed diagnosis page with sections. User can ask follow-up questions."
  },
  "timestamp": "ISO 8601 string"
}
```

**Frontend Action:**
- Navigate to a new page/view for detailed diagnosis
- Display `diagnosisDetail` in organized sections:
  - **Overview** - Show at top
  - **Symptoms** - List with icons
  - **Causes** - Expandable section
  - **Recovery Timeline** - Progress bar or timeline visualization
  - **Treatment Plan** - Tabbed sections (Immediate, Ongoing, Rehabilitation)
  - **Diagnostic Tests** - Collapsible cards for each test
  - **Red Flags** - Warning box with urgent styling
  - **When to See Doctor** - Two sections (immediate vs 24-48hrs)
  - **Recovery Time** - Prominent display
  - **Return to Activity** - Guidelines box
- Always display `disclaimer` at bottom
- Allow user to ask follow-up questions (keep sending messages with same context)

---

## Frontend Implementation Guide

### 1. Initial Message Flow
```javascript
// User sends first message
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: userInput,
    chatHistory: [],
    currentContext: {}
  })
});

const data = await response.json();

// Check stage and render accordingly
switch(data.data.stage) {
  case 'GATHERING_INFO':
    renderQuestionsView(data.data);
    break;
  case 'DIAGNOSIS_LIST':
    renderDiagnosisListView(data.data);
    break;
  case 'DIAGNOSIS_DETAIL':
    renderDiagnosisDetailView(data.data);
    break;
}
```

### 2. Handling Diagnosis Selection
```javascript
// User clicks on a diagnosis card
const handleDiagnosisClick = async (diagnosis) => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Tell me more about ${diagnosis.name}`,
      diagnosisId: diagnosis.id,
      currentContext: {
        currentDetails: previousResponse.currentDetails
      }
    })
  });
  
  const data = await response.json();
  // Should receive DIAGNOSIS_DETAIL stage
  navigateToDetailPage(data.data);
};
```

### 3. Managing Context
```javascript
// Keep track of conversation context
const [conversationContext, setConversationContext] = useState({
  currentDetails: null,
  chatHistory: []
});

// Update after each response
const updateContext = (response) => {
  setConversationContext({
    currentDetails: response.data.currentDetails || conversationContext.currentDetails,
    chatHistory: [
      ...conversationContext.chatHistory,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: response.data.response }
    ]
  });
};
```

---

## Error Handling

### Error Response Structure
```json
{
  "success": false,
  "error": "Error message string"
}
```

**Common Errors:**
- `400` - Message is required
- `500` - Server error processing message

**Frontend Handling:**
- Show user-friendly error message
- Allow retry
- Don't lose conversation context

---

## UI/UX Recommendations

### Stage 1: Gathering Info
- **Layout:** Chat-style interface
- **Visuals:** Show questions in a friendly, conversational format
- **Input:** Large text area for user responses

### Stage 2: Diagnosis List
- **Layout:** Card grid or vertical list
- **Visuals:** 
  - Color-code confidence levels
  - Use icons for symptoms
  - Make cards clearly clickable
- **Prominence:** Show immediate advice in a highlighted box above diagnoses

### Stage 3: Diagnosis Detail
- **Layout:** Full page with sections
- **Visuals:**
  - Timeline visualization for recovery phases
  - Warning icons for red flags
  - Progress indicators
  - Accordion sections for detailed content
- **Navigation:** Back button to return to diagnosis list

---

## Example Complete Flow

### 1. User sends: "My ankle hurts"
**Response:** `GATHERING_INFO` stage
- Backend asks for duration, context, mechanism
- Frontend shows question in chat

### 2. User responds: "I rolled it playing basketball yesterday"
**Response:** `DIAGNOSIS_LIST` stage
- Backend analyzes and returns 3 possible diagnoses
- Frontend displays clickable diagnosis cards with confidence levels

### 3. User clicks: "Lateral Ankle Sprain" (high confidence)
**Response:** `DIAGNOSIS_DETAIL` stage
- Backend provides comprehensive treatment information
- Frontend navigates to detailed page with all sections

### 4. User asks follow-up: "Can I still play basketball?"
**Response:** Conversational reply based on context
- Backend uses current diagnosis context to answer
- Frontend shows response in chat or updates relevant section

---

## Key Points for Frontend Team

1. **Always include `currentContext` in follow-up requests** - The backend needs this to maintain conversation state

2. **The `stage` field determines UI layout** - Use it to conditionally render different views

3. **The `uiHint` field provides guidance** - Use it for UX decisions when unsure

4. **Diagnosis IDs are unique identifiers** - Use them for navigation and tracking

5. **Medical disclaimer should always be visible** - Show it prominently in diagnosis detail view

6. **Confidence levels are important** - High confidence = more likely diagnosis, style accordingly

7. **Chat history is optional but recommended** - Include it for better contextual responses

8. **RAG service may be unavailable** - Don't rely on it for UI decisions (check `ragUsed` flag if needed)

---

## Testing Examples

See `test_chat_flow.sh` for curl command examples of each stage.

```bash
# Stage 1: Gathering Info
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "My ankle hurts"}'

# Stage 2: Diagnosis List  
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "I rolled my ankle playing pickleball yesterday, sharp pain when pointing"}'

# Stage 3: Diagnosis Detail
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me more",
    "diagnosisId": "lateral-ankle-sprain",
    "currentContext": {"currentDetails": {...}}
  }'
```
