import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SymptomIntakeScreen({ navigation }) {
  const [selectedBodyPart, setSelectedBodyPart] = useState('');
  const [symptomDescription, setSymptomDescription] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('');

  const bodyParts = [
    'Head',
    'Chest',
    'Abdomen',
    'Back',
    'Arms',
    'Legs',
    'Throat',
    'Skin',
    'Other',
  ];

  const durations = [
    'Just started',
    'A few hours',
    '1-2 days',
    '3-7 days',
    'Over a week',
  ];

  const handleContinue = () => {
    if (selectedBodyPart && symptomDescription && selectedDuration) {
      // Navigate to ChatScreen with intake data
      navigation.navigate('Chat', {
        intakeData: {
          bodyPart: selectedBodyPart,
          symptomDescription: symptomDescription,
          duration: selectedDuration,
        },
      });
    }
  };

  const isFormValid =
    selectedBodyPart && symptomDescription.trim() && selectedDuration;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Describe Your Symptoms</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.mainTitle}>Describe Your Symptoms</Text>

        {/* Body Part Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            What area hurts or bothers you?
          </Text>
          <View style={styles.buttonGrid}>
            {bodyParts.map((part) => (
              <TouchableOpacity
                key={part}
                style={[
                  styles.bodyPartButton,
                  selectedBodyPart === part && styles.bodyPartButtonSelected,
                ]}
                onPress={() => setSelectedBodyPart(part)}
              >
                <Text
                  style={[
                    styles.bodyPartText,
                    selectedBodyPart === part && styles.bodyPartTextSelected,
                  ]}
                >
                  {part}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Symptom Description */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Describe your symptoms</Text>
          <TextInput
            style={styles.textInput}
            placeholder="E.g., sharp pain, dull ache, burning sensation... Include any additional information that might help."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            value={symptomDescription}
            onChangeText={setSymptomDescription}
            textAlignVertical="top"
          />
        </View>

        {/* Duration Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            How long have you had these symptoms?
          </Text>
          <View style={styles.durationList}>
            {durations.map((duration) => (
              <TouchableOpacity
                key={duration}
                style={[
                  styles.durationOption,
                  selectedDuration === duration &&
                    styles.durationOptionSelected,
                ]}
                onPress={() => setSelectedDuration(duration)}
              >
                <View style={styles.durationContent}>
                  <Text
                    style={[
                      styles.durationText,
                      selectedDuration === duration &&
                        styles.durationTextSelected,
                    ]}
                  >
                    {duration}
                  </Text>
                  {selectedDuration === duration && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#007AFF"
                    />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            !isFormValid && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!isFormValid}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  section: {
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bodyPartButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
    marginBottom: 8,
  },
  bodyPartButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  bodyPartText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  bodyPartTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#000',
    backgroundColor: '#f9f9f9',
    minHeight: 120,
  },
  durationList: {
    gap: 12,
  },
  durationOption: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#fff',
  },
  durationOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  durationContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationText: {
    fontSize: 16,
    color: '#333',
  },
  durationTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  continueButton: {
    backgroundColor: '#8B9FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#d0d0d0',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
