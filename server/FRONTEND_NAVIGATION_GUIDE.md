# Frontend Navigation Guide - Diagnostic Test Flow

## Quick Reference: How to Handle Each Stage

Every response has a `navigation` object that tells you what navigation is available:

```javascript
{
  navigation: {
    canGoBack: true,
    backAction: "exit_to_diagnosis",
    backLabel: "← Exit Test"
  }
}
```

---

## Simple Navigation Implementation

### 1. **Add Back Button to ALL Test Screens**

```javascript
// In your component
const { navigation } = responseData;

return (
  <div>
    {/* Always show back button if navigation exists */}
    {navigation?.canGoBack && (
      <button onClick={handleBackAction}>
        {navigation.backLabel}
      </button>
    )}
    
    {/* Rest of your screen content */}
  </div>
);
```

### 2. **Handle Back Action**

```javascript
const handleBackAction = async () => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: "Exit diagnostic test",
      exitDiagnosticTest: true,  // THIS IS THE KEY
      diagnosisId: currentDiagnosisId,  // Keep track of this
      currentContext: currentContext  // Pass current context
    })
  });
  
  const data = await response.json();
  // You'll receive DIAGNOSIS_DETAIL stage back
  navigateToDiagnosisDetail(data.data);
};
```

---

## Navigation Flow Examples

### Example 1: User Exits During Test Steps

```
User on: DIAGNOSTIC_TEST_STEP (Step 2 of 4)
User clicks: "← Exit Test" button
Backend receives: exitDiagnosticTest: true
Backend returns: DIAGNOSIS_DETAIL stage
Frontend shows: Original diagnosis detail page
```

### Example 2: User Completes All Tests

```
User on: DIAGNOSTIC_TEST_COMPLETE
User clicks: "Back to Diagnosis Details"
Backend receives: exitDiagnosticTest: true
Backend returns: DIAGNOSIS_DETAIL stage
Frontend shows: Original diagnosis detail page
```

### Example 3: User Wants Refined Treatment

```
User on: DIAGNOSTIC_TEST_COMPLETE
User clicks: "View Personalized Treatment Plan"
Frontend shows: Refined treatment plan from analysis.refinedTreatmentPlan
User clicks: "← Back to Diagnosis" (in nav bar)
Backend receives: exitDiagnosticTest: true
Backend returns: DIAGNOSIS_DETAIL stage
```

---

## Stage-by-Stage Navigation

### DIAGNOSTIC_TEST_INTRO
```javascript
{
  stage: "DIAGNOSTIC_TEST_INTRO",
  navigation: {
    canGoBack: true,
    backAction: "exit_to_diagnosis",
    backLabel: "← Back to Diagnosis"
  }
}
```
**Frontend Action**: Show back button in header/nav

---

### DIAGNOSTIC_TEST_STEP
```javascript
{
  stage: "DIAGNOSTIC_TEST_STEP",
  navigation: {
    canGoBack: true,
    backAction: "exit_to_diagnosis",
    backLabel: "← Exit Test"
  }
}
```
**Frontend Action**: Show back button. User can exit at ANY step.

---

### DIAGNOSTIC_TEST_RESULT
```javascript
{
  stage: "DIAGNOSTIC_TEST_RESULT",
  navigation: {
    canGoBack: true,
    backAction: "exit_to_diagnosis",
    backLabel: "← Exit Test"
  }
}
```
**Frontend Action**: Show back button while they're answering questions.

---

### DIAGNOSTIC_TEST_TRANSITION
```javascript
{
  stage: "DIAGNOSTIC_TEST_TRANSITION",
  navigation: {
    canGoBack: true,
    backAction: "exit_to_diagnosis",
    backLabel: "← Exit Tests"
  }
}
```
**Frontend Action**: Show back button. User can stop before next test.

---

### DIAGNOSTIC_TEST_COMPLETE
```javascript
{
  stage: "DIAGNOSTIC_TEST_COMPLETE",
  actions: [
    {
      id: "view_refined_treatment",
      label: "View Personalized Treatment Plan",
      primary: true
    },
    {
      id: "back_to_diagnosis",
      label: "Back to Diagnosis Details"
    }
  ],
  navigation: {
    canGoBack: true,
    backAction: "exit_to_diagnosis",
    backLabel: "← Back to Diagnosis"
  }
}
```

**Frontend Actions**:
1. Show action buttons for user choices
2. Show back button in nav bar
3. All three should take user back to diagnosis detail

---

## Simple State Management

```javascript
const [currentDiagnosisId, setCurrentDiagnosisId] = useState(null);
const [currentContext, setCurrentContext] = useState({});

// When entering diagnostic tests
const startDiagnosticTests = (diagnosisId) => {
  setCurrentDiagnosisId(diagnosisId);
  // Make API call with startDiagnosticTest: true
};

// When exiting (from anywhere)
const exitDiagnosticTests = async () => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: "Exit test",
      exitDiagnosticTest: true,
      diagnosisId: currentDiagnosisId,
      currentContext: currentContext
    })
  });
  
  const data = await response.json();
  // Back to DIAGNOSIS_DETAIL stage
  showDiagnosisDetail(data.data);
};
```

---

## Pain Level Collection

### At DIAGNOSTIC_TEST_RESULT Stage

Show pain input AFTER user selects their result:

```javascript
const [testResult, setTestResult] = useState(null);
const [painLevel, setPainLevel] = useState(null);

return (
  <div>
    <h3>Did you experience excessive movement with pain?</h3>
    
    {/* Step 1: Select result */}
    <button onClick={() => setTestResult('positive')}>
      Yes - I experienced this
    </button>
    <button onClick={() => setTestResult('negative')}>
      No - I did not
    </button>
    <button onClick={() => setTestResult('unsure')}>
      Unsure
    </button>
    
    {/* Step 2: If positive or unsure, show pain slider */}
    {(testResult === 'positive' || testResult === 'unsure') && (
      <div className="pain-input">
        <label>Pain Level:</label>
        <input 
          type="range" 
          min="0" 
          max="10" 
          value={painLevel} 
          onChange={(e) => setPainLevel(e.target.value)}
        />
        <span>{painLevel}/10</span>
      </div>
    )}
    
    {/* Step 3: Submit */}
    {testResult && (
      <button onClick={() => submitResult(testResult, painLevel)}>
        Continue
      </button>
    )}
  </div>
);

const submitResult = (result, pain) => {
  sendTestResponse('submit_result', result, pain);
};
```

---

## Refined Diagnosis Display

### At DIAGNOSTIC_TEST_COMPLETE Stage

```javascript
const { analysis, testResults } = responseData;

return (
  <div className="test-complete">
    {/* Header */}
    <h1>✅ Tests Complete!</h1>
    
    {/* Refined Diagnosis */}
    <div className="refined-diagnosis">
      <h2>{analysis.refinedDiagnosis.name}</h2>
      <span className="severity">{analysis.refinedDiagnosis.severity}</span>
      <span className="confidence">{analysis.confidenceLevel} confidence</span>
      <p>{analysis.refinedDiagnosis.explanation}</p>
    </div>
    
    {/* Assessment */}
    <div className="assessment">
      <h3>Assessment</h3>
      <p>{analysis.assessment}</p>
    </div>
    
    {/* Pain Analysis */}
    {analysis.painAnalysis && (
      <div className="pain-analysis">
        <h3>Pain Analysis</h3>
        <p>{analysis.painAnalysis}</p>
      </div>
    )}
    
    {/* Test Results Summary */}
    <div className="test-results">
      <h3>Your Test Results</h3>
      {testResults.map(test => (
        <div key={test.testId} className="test-result-card">
          <h4>{test.testName}</h4>
          <span className={`result ${test.result}`}>{test.result}</span>
          {test.painLevel && <span>Pain: {test.painLevel}/10</span>}
        </div>
      ))}
    </div>
    
    {/* Refined Treatment Plan */}
    <div className="treatment-plan">
      <h3>Your Personalized Treatment Plan</h3>
      
      <div className="immediate">
        <h4>Immediate (Now)</h4>
        <ul>
          {analysis.refinedTreatmentPlan.immediate.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      
      <div className="week1">
        <h4>Week 1</h4>
        <ul>
          {analysis.refinedTreatmentPlan.week1.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      
      <div className="week2-3">
        <h4>Weeks 2-3</h4>
        <ul>
          {analysis.refinedTreatmentPlan.week2_3.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      
      <div className="ongoing">
        <h4>Ongoing</h4>
        <ul>
          {analysis.refinedTreatmentPlan.ongoing.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
    
    {/* Recommendations */}
    <div className="recommendations">
      <h3>Recommendations</h3>
      <ol>
        {analysis.refinedRecommendations.map(rec => (
          <li key={rec}>{rec}</li>
        ))}
      </ol>
    </div>
    
    {/* Red Flags */}
    {analysis.redFlags.length > 0 && (
      <div className="red-flags warning">
        <h3>⚠️ Warning Signs</h3>
        <ul>
          {analysis.redFlags.map(flag => (
            <li key={flag}>{flag}</li>
          ))}
        </ul>
      </div>
    )}
    
    {/* Estimated Recovery */}
    <div className="recovery-time">
      <h3>Estimated Recovery</h3>
      <p>{analysis.estimatedRecovery}</p>
    </div>
    
    {/* Confidence Improvement */}
    <div className="confidence-note">
      <p><strong>Diagnostic Confidence:</strong> {analysis.confidenceImprovement}</p>
    </div>
    
    {/* Action Buttons */}
    <div className="actions">
      <button className="primary" onClick={() => viewTreatment()}>
        View Detailed Treatment Plan
      </button>
      <button onClick={() => exitToOriginalDiagnosis()}>
        Back to Diagnosis Details
      </button>
    </div>
    
    {/* Disclaimer */}
    <div className="disclaimer">
      <p>{responseData.disclaimer}</p>
    </div>
  </div>
);
```

---

## Complete Navigation Examples

### Example 1: Start → Exit Immediately

```javascript
// User starts tests
POST /api/chat
{
  "message": "Start tests",
  "startDiagnosticTest": true,
  "diagnosisId": "lateral-ankle-sprain"
}

// Response: DIAGNOSTIC_TEST_INTRO with navigation.canGoBack = true

// User clicks back button
POST /api/chat
{
  "message": "Exit",
  "exitDiagnosticTest": true,
  "diagnosisId": "lateral-ankle-sprain"
}

// Response: DIAGNOSIS_DETAIL (back to original diagnosis)
```

### Example 2: Complete Tests → View Results → Go Back

```javascript
// User completes all tests
// Response: DIAGNOSTIC_TEST_COMPLETE

// User views results and refined treatment

// User clicks "Back to Diagnosis" button
POST /api/chat
{
  "message": "Back",
  "exitDiagnosticTest": true,
  "diagnosisId": "lateral-ankle-sprain"
}

// Response: DIAGNOSIS_DETAIL with message: "You've exited the diagnostic tests"
```

### Example 3: Mid-Test Exit

```javascript
// User is on step 3 of test 2
// Stage: DIAGNOSTIC_TEST_STEP

// User clicks "← Exit Test" button
POST /api/chat
{
  "message": "Exit test",
  "exitDiagnosticTest": true,
  "diagnosisId": "lateral-ankle-sprain",
  "currentContext": {
    "testSession": { /* current session */ }
  }
}

// Response: DIAGNOSIS_DETAIL
// Partial test results are discarded
```

---

## Key Takeaways for Frontend

1. **Always show back button** when `navigation.canGoBack` is true
2. **One simple request** to exit: `exitDiagnosticTest: true`
3. **Pain collection** happens at DIAGNOSTIC_TEST_RESULT stage
4. **Refined treatment** is in `analysis.refinedTreatmentPlan` with 4 phases
5. **Navigation is consistent** across all test stages
6. **Always pass diagnosisId** when exiting to know where to return

---

## Error Handling

```javascript
const handleNavigation = async (action) => {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "Navigation action",
        exitDiagnosticTest: action === 'exit',
        diagnosisId: currentDiagnosisId,
        currentContext: currentContext
      })
    });
    
    if (!response.ok) {
      throw new Error('Navigation failed');
    }
    
    const data = await response.json();
    handleStageChange(data.data);
    
  } catch (error) {
    console.error('Navigation error:', error);
    // Show user-friendly error
    showError('Unable to navigate. Please try again.');
  }
};
```

---

## Summary

### To Exit Diagnostic Tests (from ANY stage):
```javascript
{
  exitDiagnosticTest: true,
  diagnosisId: "the-diagnosis-id"
}
```

### To Collect Pain Levels:
- Show pain slider (0-10) after user selects test result
- Send in `testResponse.painLevel`

### To Show Refined Diagnosis:
- Display `analysis.refinedDiagnosis`
- Show `analysis.refinedTreatmentPlan` (4 phases)
- Display test results with pain levels
- Show confidence improvement

### Navigation is Simple:
- Every test screen has a back button
- One request exits everything
- Returns to original diagnosis detail
- No complex state management needed
