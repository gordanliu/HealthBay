import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';

export default function SymptomChecklist({ symptomCategories, onSubmit, message }) {
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [otherSymptom, setOtherSymptom] = useState('');

  const toggleSymptom = (symptom) => {
    if (selectedSymptoms.includes(symptom)) {
      setSelectedSymptoms(selectedSymptoms.filter(s => s !== symptom));
    } else {
      setSelectedSymptoms([...selectedSymptoms, symptom]);
    }
  };

  const handleSubmit = () => {
    const allSymptoms = [...selectedSymptoms];
    if (otherSymptom.trim()) {
      allSymptoms.push(otherSymptom.trim());
    }
    onSubmit(allSymptoms);
  };

  return (
    <View style={styles.container}>
      <View style={styles.messageBubble}>
        <Text style={styles.messageText}>{message}</Text>
      </View>

      <ScrollView style={styles.checklistContainer}>
        {Object.entries(symptomCategories).map(([categoryKey, category]) => (
          <View key={categoryKey} style={styles.category}>
            <Text style={styles.categoryLabel}>{category.label}</Text>
            {category.symptoms.map((symptom, index) => {
              const isSelected = selectedSymptoms.includes(symptom);
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.symptomButton, isSelected && styles.symptomButtonSelected]}
                  onPress={() => toggleSymptom(symptom)}
                >
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={[styles.symptomText, isSelected && styles.symptomTextSelected]}>
                    {symptom}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <View style={styles.otherContainer}>
          <Text style={styles.categoryLabel}>Other Symptoms</Text>
          <TextInput
            style={styles.otherInput}
            placeholder="Describe any other symptoms..."
            value={otherSymptom}
            onChangeText={setOtherSymptom}
            multiline
          />
        </View>
      </ScrollView>

      <TouchableOpacity 
        style={[styles.submitButton, selectedSymptoms.length === 0 && !otherSymptom.trim() && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={selectedSymptoms.length === 0 && !otherSymptom.trim()}
      >
        <Text style={styles.submitButtonText}>
          Continue ({selectedSymptoms.length + (otherSymptom.trim() ? 1 : 0)} selected)
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafbfc',
  },
  messageBubble: {
    backgroundColor: '#F4F5F7',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  messageText: {
    color: '#333',
    fontSize: 15,
    lineHeight: 22,
  },
  checklistContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  category: {
    marginBottom: 20,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  symptomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  symptomButtonSelected: {
    backgroundColor: '#EBF5FF',
    borderColor: '#007AFF',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  symptomText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  symptomTextSelected: {
    color: '#007AFF',
    fontWeight: '500',
  },
  otherContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  otherInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    margin: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
