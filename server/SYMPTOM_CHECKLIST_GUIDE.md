# Symptom Checklist - Frontend Implementation Guide

## Overview

Instead of free-text symptom input, the system now provides a **structured symptom checklist** tailored to the specific body part injured. This improves diagnosis accuracy and makes data collection more systematic.

---

## How It Works

### Flow

```
User reports injury → System detects missing symptoms → Returns symptom checklist
→ User selects symptoms + adds custom ones → System generates diagnosis
```

---

## Response Structure

### SYMPTOM_CHECKLIST Stage Response

When symptoms are missing, you'll receive:

```json
{
  "stage": "GATHERING_INFO",
  "substage": "SYMPTOM_CHECKLIST",
  "type": "injury",
  "response": "I'd like to understand your symptoms better. Please check all that apply to your wrist injury:",
  
  "symptomChecklist": {
    "pain": {
      "label": "Pain Characteristics",
      "symptoms": [
        "Sharp pain with movement",
        "Dull ache at rest",
        "Throbbing pain radiating into hand or forearm",
        "Burning sensation in the wrist joint",
        "Stabbing pain when gripping"
      ]
    },
    "mobility": {
      "label": "Movement Issues",
      "symptoms": [
        "Limited wrist flexion",
        "Limited wrist extension",
        "Stiffness after inactivity",
        "Unable to bear weight on the wrist",
        "Difficulty rotating the wrist",
        "Clicking/popping sound with movement"
      ]
    },
    "appearance": {
      "label": "Visual Changes",
      "symptoms": [
        "Swelling around the wrist joint",
        "Bruising on the wrist or hand",
        "Redness and warmth to the touch",
        "Visible deformity of the wrist",
        "Discoloration (e.g., paleness or blueness)"
      ]
    },
    "sensation": {
      "label": "Sensory Changes",
      "symptoms": [
        "Numbness in fingers or hand",
        "Tingling sensation in fingers or hand (pins and needles)",
        "Weakness in grip strength",
        "Feeling of instability in the wrist",
        "Loss of sensation in part of the hand"
      ]
    },
    "functional": {
      "label": "Functional Impact",
      "symptoms": [
        "Difficulty with tasks like typing or opening jars",
        "Cannot perform sports or hobbies involving wrist use",
        "Wrist pain disrupts sleep",
        "Wrist injury affects work productivity",
        "Inability to lift objects"
      ]
    }
  },
  
  "missingInfo": ["duration", "context"],
  "currentDetails": {
    "injury_name": "wrist injury",
    "body_part": "wrist",
    "symptoms": [],
    "severity": "unknown",
    "duration": "just happened",
    "context": "daily activity",
    "mechanism": "fell while skateboarding and landed on wrist"
  },
  
  "nextAction": "select_symptoms",
  "uiHint": "Show checkbox list organized by categories with 'Other' text input field at bottom",
  "hasOtherOption": true,
  "otherLabel": "Other symptoms not listed:"
}
```

---

## Frontend Implementation

### 1. Render the Symptom Checklist

```jsx
import React, { useState } from 'react';

function SymptomChecklist({ data, onSubmit }) {
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [otherSymptoms, setOtherSymptoms] = useState('');
  
  const handleCheckboxChange = (symptom) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptom)
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };
  
  const handleSubmit = () => {
    const allSymptoms = [...selectedSymptoms];
    
    // Add custom symptoms from "Other" field
    if (otherSymptoms.trim()) {
      allSymptoms.push(otherSymptoms.trim());
    }
    
    onSubmit(allSymptoms);
  };
  
  return (
    <div className="symptom-checklist">
      <h2>Symptom Assessment</h2>
      <p>{data.response}</p>
      
      {/* Render each category */}
      {Object.entries(data.symptomChecklist).map(([categoryKey, category]) => (
        <div key={categoryKey} className="symptom-category">
          <h3>{category.label}</h3>
          <div className="symptom-options">
            {category.symptoms.map(symptom => (
              <label key={symptom} className="symptom-option">
                <input
                  type="checkbox"
                  checked={selectedSymptoms.includes(symptom)}
                  onChange={() => handleCheckboxChange(symptom)}
                />
                <span>{symptom}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      
      {/* Other symptoms input */}
      {data.hasOtherOption && (
        <div className="other-symptoms">
          <label>
            <strong>{data.otherLabel}</strong>
            <input
              type="text"
              value={otherSymptoms}
              onChange={(e) => setOtherSymptoms(e.target.value)}
              placeholder="e.g., Feels tender when I touch it"
            />
          </label>
        </div>
      )}
      
      {/* Submit button */}
      <button 
        onClick={handleSubmit}
        disabled={selectedSymptoms.length === 0 && !otherSymptoms.trim()}
        className="submit-symptoms"
      >
        Continue
      </button>
    </div>
  );
}

export default SymptomChecklist;
```

### 2. Submitting Selected Symptoms

When user clicks "Continue", send this request:

```javascript
const submitSymptoms = async (selectedSymptoms) => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: "Submitting my symptoms",
      selectedSymptoms: selectedSymptoms,  // Array of symptom strings
      currentContext: currentContext  // Pass the currentDetails from previous response
    })
  });
  
  const data = await response.json();
  // Will receive DIAGNOSIS_LIST stage or more questions if info still missing
  handleResponse(data.data);
};
```

### Example Request

```json
{
  "message": "Submitting my symptoms",
  "selectedSymptoms": [
    "Sharp pain with movement",
    "Swelling around the wrist joint",
    "Bruising on the wrist or hand",
    "Weakness in grip strength",
    "Difficulty with tasks like typing or opening jars",
    "Feels tender when I touch it"
  ],
  "currentContext": {
    "currentDetails": {
      "injury_name": "wrist injury",
      "body_part": "wrist",
      "symptoms": [],
      "severity": "unknown",
      "duration": "just happened",
      "context": "daily activity",
      "mechanism": "fell while skateboarding and landed on wrist"
    }
  }
}
```

---

## After Symptom Submission

### If All Info Gathered

You'll receive **DIAGNOSIS_LIST** stage:

```json
{
  "stage": "DIAGNOSIS_LIST",
  "diagnoses": [
    {
      "id": "wrist-sprain",
      "name": "Wrist Sprain",
      "confidence": "high",
      "matchedSymptoms": [
        "Sharp pain with movement",
        "Swelling around the wrist joint",
        "Bruising on the wrist or hand"
      ]
    }
  ],
  "currentDetails": {
    "symptoms": [
      "Sharp pain with movement",
      "Swelling around the wrist joint",
      "Feels tender when I touch it"
    ]
  }
}
```

### If More Info Needed

You'll receive another **GATHERING_INFO** stage asking for:
- Duration (when did it happen?)
- Context (athlete, work-related, etc.)
- Mechanism (more details on how injury occurred)

---

## UI/UX Best Practices

### Layout

```
┌─────────────────────────────────────────┐
│ Symptom Assessment                      │
├─────────────────────────────────────────┤
│ I'd like to understand your symptoms... │
│                                         │
│ ▶ Pain Characteristics                  │
│   ☑ Sharp pain with movement           │
│   ☐ Dull ache at rest                  │
│   ☑ Throbbing pain                     │
│                                         │
│ ▶ Movement Issues                       │
│   ☐ Limited wrist flexion              │
│   ☑ Stiffness after inactivity         │
│                                         │
│ ▶ Visual Changes                        │
│   ☑ Swelling around the wrist joint    │
│   ☑ Bruising on the wrist or hand      │
│                                         │
│ ▶ Other symptoms not listed:            │
│   [Feels tender when I touch it____]    │
│                                         │
│        [Continue] ──────────►           │
└─────────────────────────────────────────┘
```

### Styling Tips

1. **Categories as Collapsible Sections** - Allow users to expand/collapse categories
2. **Visual Feedback** - Highlight checked symptoms with color/background
3. **Count Selected** - Show "X symptoms selected" near submit button
4. **Validation** - Disable submit if nothing selected AND other field empty
5. **Mobile-Friendly** - Large touch targets for checkboxes
6. **Accessibility** - Proper labels and keyboard navigation

### Example CSS

```css
.symptom-category {
  margin-bottom: 1.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
}

.symptom-category h3 {
  color: #1976d2;
  margin-bottom: 0.75rem;
  font-size: 1.1rem;
}

.symptom-option {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.symptom-option:hover {
  background-color: #f5f5f5;
}

.symptom-option input[type="checkbox"] {
  margin-right: 0.75rem;
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.symptom-option input[type="checkbox"]:checked + span {
  font-weight: 600;
  color: #1976d2;
}

.other-symptoms {
  margin-top: 1.5rem;
  padding: 1rem;
  background-color: #f9f9f9;
  border-radius: 8px;
}

.other-symptoms input[type="text"] {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  margin-top: 0.5rem;
}

.submit-symptoms {
  width: 100%;
  padding: 1rem;
  margin-top: 1.5rem;
  background-color: #1976d2;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-symptoms:hover:not(:disabled) {
  background-color: #1565c0;
}

.submit-symptoms:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}
```

---

## Complete Flow Example

### Step 1: Initial Injury Report
```javascript
// User: "I fell while skateboarding and landed on my wrist"
POST /api/chat
{
  "message": "I fell while skateboarding and landed on my wrist"
}

// Response: SYMPTOM_CHECKLIST
```

### Step 2: Symptom Selection
```javascript
// User selects symptoms and clicks Continue
POST /api/chat
{
  "message": "Submitting my symptoms",
  "selectedSymptoms": [
    "Sharp pain with movement",
    "Swelling around the wrist joint",
    "Bruising on the wrist or hand",
    "Weakness in grip strength",
    "Feels tender when I touch it"
  ],
  "currentContext": { /* from previous response */ }
}

// Response: DIAGNOSIS_LIST with 3 diagnoses
```

### Step 3: View Diagnosis
```javascript
// User clicks on "Wrist Sprain"
POST /api/chat
{
  "message": "Tell me more",
  "diagnosisId": "wrist-sprain",
  "currentContext": { /* from previous response */ }
}

// Response: DIAGNOSIS_DETAIL with full treatment plan
```

---

## Benefits of Symptom Checklist

✅ **More Accurate** - Structured data vs free-text parsing  
✅ **Body-Part Specific** - Symptoms tailored to ankle, wrist, knee, etc.  
✅ **Faster Input** - Checkboxes faster than typing  
✅ **Better Diagnosis** - AI gets precise symptom data  
✅ **Flexible** - Still allows custom symptoms via "Other" field  
✅ **Mobile-Friendly** - Easy to tap checkboxes on phone  
✅ **Multilingual Ready** - Easy to translate symptom labels  

---

## State Management

```javascript
const [chatState, setChatState] = useState({
  stage: null,
  substage: null,
  currentContext: {},
  messages: []
});

const handleResponse = (data) => {
  if (data.substage === 'SYMPTOM_CHECKLIST') {
    // Show symptom checklist UI
    showSymptomChecklist(data);
  } else if (data.stage === 'DIAGNOSIS_LIST') {
    // Show diagnosis list
    showDiagnoses(data);
  }
  
  // Always save currentContext for next request
  setChatState(prev => ({
    ...prev,
    stage: data.stage,
    substage: data.substage,
    currentContext: {
      currentDetails: data.currentDetails
    }
  }));
};
```

---

## Error Handling

```javascript
const submitSymptoms = async (selectedSymptoms) => {
  try {
    // Validate at least one symptom
    if (!selectedSymptoms || selectedSymptoms.length === 0) {
      showError("Please select at least one symptom or describe in 'Other'");
      return;
    }
    
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "Submitting my symptoms",
        selectedSymptoms: selectedSymptoms,
        currentContext: currentContext
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to submit symptoms');
    }
    
    const data = await response.json();
    handleResponse(data.data);
    
  } catch (error) {
    console.error('Error submitting symptoms:', error);
    showError('Unable to submit symptoms. Please try again.');
  }
};
```

---

## Summary

### To Render Symptom Checklist:
- Display categories with symptom checkboxes
- Add "Other" text input at bottom
- Enable continue button when at least one symptom selected

### To Submit Symptoms:
```javascript
{
  selectedSymptoms: ["symptom1", "symptom2", "custom symptom"],
  currentContext: { currentDetails: {...} }
}
```

### What You'll Get Back:
- **DIAGNOSIS_LIST** if all info gathered
- **GATHERING_INFO** if more info needed (duration, context, etc.)

The system is smart enough to ask for remaining info step-by-step! 🎯
