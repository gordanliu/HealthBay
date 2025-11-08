# Interactive Diagnostic Test Flow Documentation

## Overview
The diagnostic test flow provides **step-by-step guided testing** where users are walked through each test instruction, can report their results, and receive analysis based on their responses. This is superior to just listing tests because it ensures proper execution and provides real-time guidance.

## Why Interactive Testing is Better

### ✅ Benefits of Guided Approach:
1. **Accuracy** - Users perform tests correctly with step-by-step instructions
2. **Safety** - Can stop immediately if severe pain occurs
3. **Progressive Assessment** - Each test builds on previous results
4. **Engagement** - Users stay involved in their diagnosis
5. **Personalized** - Analysis adapts based on their specific responses
6. **Educational** - Users learn proper self-assessment techniques

### ❌ Problems with "Just List Tests":
- Users may perform tests incorrectly
- No safety monitoring
- Can't stop if pain increases
- No progressive refinement
- Less engaging experience
- Users may skip tests or do them all at once incorrectly

---

## Flow Stages

### Stage 1: DIAGNOSTIC_TEST_INTRO
**When**: User clicks "Start Diagnostic Tests" from diagnosis detail page

**Request:**
```json
{
  "message": "Start diagnostic tests",
  "diagnosisId": "lateral-ankle-sprain",
  "startDiagnosticTest": true,
  "currentContext": {
    "currentDetails": {
      "body_part": "ankle",
      "symptoms": ["sharp pains"]
    }
  }
}
```

**Response:**
```json
{
  "stage": "DIAGNOSTIC_TEST_INTRO",
  "type": "injury",
  "diagnosisId": "lateral-ankle-sprain",
  "testSession": {
    "testPlan": {
      "introduction": "Why these tests help...",
      "safetyWarning": "Safety instructions...",
      "tests": [
        {
          "id": "test-1",
          "name": "Anterior Drawer Test",
          "purpose": "What this tests",
          "steps": ["Step 1", "Step 2", "Step 3"],
          "estimatedTime": "15 seconds",
          "whatToLookFor": "Indicators",
          "safetyNote": "Specific warnings"
        }
      ]
    },
    "currentTestIndex": 0,
    "totalTests": 4,
    "currentStepIndex": 0,
    "testResults": [],
    "startTime": "ISO timestamp"
  },
  "introduction": "Brief intro text",
  "safetyWarning": "Safety text",
  "nextAction": "begin_first_test",
  "uiHint": "Show introduction and safety warning. Button to start first test."
}
```

**Frontend Actions:**
- Display `introduction` text
- Show `safetyWarning` prominently (red warning box)
- Display total number of tests
- Show "Begin First Test" button
- Optional: Show list of test names as preview

---

### Stage 2: DIAGNOSTIC_TEST_STEP
**When**: User is performing a specific step of a test

**Request:**
```json
{
  "message": "Starting test",
  "testResponse": {
    "action": "start_test"  // or "next_step"
  },
  "currentContext": {
    "testSession": { /* full test session from previous response */ }
  }
}
```

**Response:**
```json
{
  "stage": "DIAGNOSTIC_TEST_STEP",
  "type": "injury",
  "testSession": { /* updated session */ },
  "currentTest": {
    "id": "anterior-drawer-test",
    "name": "Anterior Drawer Test",
    "purpose": "Test ATFL integrity",
    "stepNumber": 1,
    "totalSteps": 4,
    "stepInstruction": "Sit with your leg extended and ankle relaxed",
    "estimatedTime": "15 seconds",
    "safetyNote": "Stop if severe pain"
  },
  "progress": {
    "testNumber": 1,
    "totalTests": 4,
    "percentage": 0
  },
  "nextAction": "complete_step",
  "uiHint": "Show step instruction with timer. Button for 'I've completed this step' or 'Stop - this causes pain'"
}
```

**Frontend Actions:**
- Display test name and purpose at top
- Show progress bar (`percentage`)
- Display current step number (Step 1 of 4)
- Show `stepInstruction` in large, clear text
- Start visual timer based on `estimatedTime` (optional)
- Show `safetyNote` if present
- Two buttons:
  - **"I've Completed This Step"** → Sends `next_step` action
  - **"Stop - This Causes Pain"** → Sends `stop_test` action

---

### Stage 3: DIAGNOSTIC_TEST_RESULT
**When**: User completes all steps of a test, now need to report result

**Request** (to get to this stage):
```json
{
  "message": "Next step",
  "testResponse": {
    "action": "next_step"
  },
  "currentContext": {
    "testSession": { /* session */ }
  }
}
```

**Response:**
```json
{
  "stage": "DIAGNOSTIC_TEST_RESULT",
  "type": "injury",
  "testSession": { /* session */ },
  "currentTest": {
    "id": "anterior-drawer-test",
    "name": "Anterior Drawer Test",
    "whatToLookFor": "Excessive forward movement with pain suggests ATFL tear"
  },
  "question": "You've completed the Anterior Drawer Test. Did you experience excessive forward movement with pain?",
  "progress": {
    "testNumber": 1,
    "totalTests": 4,
    "percentage": 25
  },
  "nextAction": "submit_result",
  "uiHint": "Show question with options: 'Yes (Positive)', 'No (Negative)', 'Unsure', 'Severe pain - stopped test'"
}
```

**Frontend Actions:**
- Show completion message
- Display `question` text
- Show `whatToLookFor` as reference
- Four option buttons:
  - **"Yes - I experienced this"** (Positive)
  - **"No - I did not experience this"** (Negative)
  - **"Unsure"**
  - **"Severe pain - I had to stop"**
- Optional: Pain scale slider (0-10)

**Request to submit result:**
```json
{
  "message": "Submitting result",
  "testResponse": {
    "action": "submit_result",
    "result": "positive",  // or "negative", "unsure", "stopped"
    "painLevel": 6  // optional 0-10 scale
  },
  "currentContext": {
    "testSession": { /* session */ }
  }
}
```

---

### Stage 4: DIAGNOSTIC_TEST_TRANSITION
**When**: User completed a test, moving to next test

**Response:**
```json
{
  "stage": "DIAGNOSTIC_TEST_TRANSITION",
  "type": "injury",
  "testSession": { /* updated session with results */ },
  "completedTest": {
    "name": "Anterior Drawer Test",
    "result": "positive"
  },
  "nextTest": {
    "name": "Talar Tilt Test",
    "purpose": "Test CFL integrity"
  },
  "progress": {
    "testNumber": 2,
    "totalTests": 4,
    "percentage": 25
  },
  "nextAction": "start_next_test",
  "uiHint": "Show transition screen. Button to 'Start Next Test' or 'Stop Testing'"
}
```

**Frontend Actions:**
- Show checkmark for completed test
- Display result summary
- Preview next test name and purpose
- Two buttons:
  - **"Start Next Test"** → Sends `start_test` action
  - **"Stop Testing"** → Sends `stop_test` action
- Show progress (Test 2 of 4)

---

### Stage 5: DIAGNOSTIC_TEST_COMPLETE
**When**: All tests completed, showing analysis

**Response:**
```json
{
  "stage": "DIAGNOSTIC_TEST_COMPLETE",
  "type": "injury",
  "diagnosisId": "lateral-ankle-sprain",
  "testResults": [
    {
      "testId": "anterior-drawer-test",
      "testName": "Anterior Drawer Test",
      "result": "positive",
      "painLevel": 6,
      "timestamp": "ISO timestamp"
    },
    {
      "testId": "talar-tilt-test",
      "testName": "Talar Tilt Test",
      "result": "positive",
      "painLevel": 7,
      "timestamp": "ISO timestamp"
    }
  ],
  "analysis": {
    "confidenceLevel": "high",
    "assessment": "Test results strongly suggest a moderate to severe lateral ankle sprain involving both ATFL and CFL ligaments.",
    "diagnosisConfirmation": "Results confirm the suspected lateral ankle sprain diagnosis",
    "recommendations": [
      "Continue RICE protocol for next 48-72 hours",
      "Use crutches to avoid weight-bearing",
      "Schedule appointment with sports medicine physician"
    ],
    "nextSteps": "Based on positive tests indicating ligament damage, professional evaluation is recommended",
    "redFlags": [
      "Multiple positive tests suggest significant ligament injury",
      "Pain levels above 6/10 indicate need for medical evaluation"
    ],
    "treatmentAdjustments": "Consider using ankle brace for support during initial healing phase"
  },
  "disclaimer": "⚠️ These diagnostic tests are for educational purposes...",
  "nextAction": "view_treatment",
  "uiHint": "Show complete analysis with test results summary. Option to view full treatment plan."
}
```

**Frontend Actions:**
- Show completion celebration (checkmark, success message)
- Display test results in a table/list
  - Test name, result (with color coding), pain level
- Show analysis sections:
  - **Confidence Level** - Badge (high/medium/low)
  - **Assessment** - Main findings
  - **Diagnosis Confirmation** - Text
  - **Recommendations** - Numbered list
  - **Red Flags** - Warning box
  - **Next Steps** - Action items
- Button: **"View Full Treatment Plan"**
- Display disclaimer at bottom

---

### Stage 6: DIAGNOSTIC_TEST_STOPPED
**When**: User stops testing due to pain or other reason

**Request:**
```json
{
  "message": "Stop",
  "testResponse": {
    "action": "stop_test",
    "reason": "Too much pain"
  },
  "currentContext": {
    "testSession": { /* session */ }
  }
}
```

**Response:**
```json
{
  "stage": "DIAGNOSTIC_TEST_STOPPED",
  "type": "injury",
  "testSession": {
    "stopped": true,
    "stopReason": "Too much pain"
  },
  "message": "You've stopped the diagnostic tests. This is important information.",
  "recommendation": "Severe pain during tests may indicate a more serious injury. Consider seeing a healthcare professional for proper evaluation.",
  "partialResults": [
    /* any completed test results */
  ],
  "nextAction": "view_recommendations",
  "uiHint": "Show stop message and recommendations. Option to return to diagnosis detail."
}
```

**Frontend Actions:**
- Show supportive message
- Display recommendation prominently
- Show partial results if any tests were completed
- Emphasize importance of seeking medical care
- Button: **"View Recommendations"**
- Button: **"Return to Diagnosis Details"**

---

## Complete Flow Example

### 1. User clicks "Start Diagnostic Tests"
```
GET: DIAGNOSTIC_TEST_INTRO
Shows: Introduction, safety warning, test list
Button: "Begin First Test"
```

### 2. User starts first test
```
POST: action="start_test"
GET: DIAGNOSTIC_TEST_STEP (Step 1/4)
Shows: "Sit with leg extended"
Buttons: "Completed" | "Stop"
```

### 3. User completes step 1
```
POST: action="next_step"
GET: DIAGNOSTIC_TEST_STEP (Step 2/4)
Shows: "Stabilize lower leg"
Buttons: "Completed" | "Stop"
```

### 4. User completes steps 2-4
```
(Repeats next_step for each)
```

### 5. All steps done, report result
```
GET: DIAGNOSTIC_TEST_RESULT
Shows: "Did you experience excessive movement with pain?"
Options: Yes | No | Unsure | Severe Pain
```

### 6. User selects "Yes (Positive)"
```
POST: action="submit_result", result="positive", painLevel=6
GET: DIAGNOSTIC_TEST_TRANSITION
Shows: Test 1 complete ✓, Next: Test 2
Buttons: "Start Next Test" | "Stop Testing"
```

### 7-9. Repeat for tests 2-4

### 10. All tests complete
```
GET: DIAGNOSTIC_TEST_COMPLETE
Shows: Full analysis with all results
Recommendations and next steps
Button: "View Treatment Plan"
```

---

## Frontend Implementation Guide

### State Management
```javascript
const [testSession, setTestSession] = useState(null);
const [currentStage, setCurrentStage] = useState(null);

// Store testSession from server response
const handleResponse = (data) => {
  if (data.testSession) {
    setTestSession(data.testSession);
  }
  setCurrentStage(data.stage);
};
```

### Rendering Based on Stage
```javascript
const renderTestStage = () => {
  switch(currentStage) {
    case 'DIAGNOSTIC_TEST_INTRO':
      return <TestIntroScreen data={responseData} />;
    
    case 'DIAGNOSTIC_TEST_STEP':
      return <TestStepScreen 
        data={responseData}
        onComplete={() => sendTestResponse('next_step')}
        onStop={() => sendTestResponse('stop_test')}
      />;
    
    case 'DIAGNOSTIC_TEST_RESULT':
      return <TestResultScreen 
        data={responseData}
        onSubmit={(result, pain) => sendTestResponse('submit_result', result, pain)}
      />;
    
    case 'DIAGNOSTIC_TEST_TRANSITION':
      return <TestTransitionScreen 
        data={responseData}
        onContinue={() => sendTestResponse('start_test')}
        onStop={() => sendTestResponse('stop_test')}
      />;
    
    case 'DIAGNOSTIC_TEST_COMPLETE':
      return <TestCompleteScreen data={responseData} />;
    
    case 'DIAGNOSTIC_TEST_STOPPED':
      return <TestStoppedScreen data={responseData} />;
  }
};
```

### Sending Test Responses
```javascript
const sendTestResponse = async (action, result = null, painLevel = null) => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Test action: ${action}`,
      testResponse: {
        action,
        ...(result && { result }),
        ...(painLevel && { painLevel })
      },
      currentContext: {
        testSession,
        currentDetails: userDetails
      }
    })
  });
  
  const data = await response.json();
  handleResponse(data.data);
};
```

### Timer Component (Optional)
```javascript
const TestTimer = ({ estimatedTime }) => {
  const [seconds, setSeconds] = useState(0);
  const [target] = useState(parseTime(estimatedTime)); // "30 seconds" → 30
  
  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  const progress = Math.min((seconds / target) * 100, 100);
  
  return (
    <div className="timer">
      <div className="timer-bar" style={{width: `${progress}%`}} />
      <span>{seconds}s / {target}s</span>
    </div>
  );
};
```

---

## UI/UX Best Practices

### Test Intro Screen
- Large, clear heading: "Diagnostic Tests"
- Safety warning in red box with icon
- Numbered list of tests to be performed
- Estimated total time
- Clear CTA button: "Begin Tests"

### Test Step Screen
- Progress indicator at top (Test 1 of 4, Step 2 of 4)
- Large step instruction text (18-24px)
- Optional timer/countdown
- Visual illustration if possible
- Two prominent buttons:
  - Primary: "I've Completed This Step" (green)
  - Secondary: "Stop - This Hurts" (red)

### Test Result Screen
- Summary: "You've completed [Test Name]"
- Question in clear language
- Four large option buttons (not small radio buttons)
- Optional pain slider below
- Visual feedback on selection

### Transition Screen
- Checkmark animation for completed test
- Brief rest period ("Take a moment to rest")
- Preview of next test
- Progress celebration ("2 of 4 complete!")

### Complete Screen
- Success animation
- Summary cards for each test
- Analysis in collapsible sections
- Clear next steps
- Prominent disclaimer

---

## Safety Considerations

1. **Always allow stopping** - Every step should have stop button
2. **Clear pain warnings** - Emphasize stopping if severe pain
3. **No medical advice** - Remind these are educational tests
4. **Professional recommendation** - If multiple positive tests, recommend doctor
5. **Disclaimer everywhere** - Show medical disclaimer on all test screens

---

## Testing Examples

See test file for curl commands to test each stage of the flow.

```bash
# Stage 1: Initialize tests
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Start tests",
    "diagnosisId": "lateral-ankle-sprain",
    "startDiagnosticTest": true,
    "currentContext": {"currentDetails": {"body_part": "ankle"}}
  }'

# Stage 2: Start first test
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Begin",
    "testResponse": {"action": "start_test"},
    "currentContext": {"testSession": {...}}
  }'

# Continue with next_step, submit_result, etc.
```
