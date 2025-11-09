import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';

export default function DiagnosisList({ diagnoses, summary, immediateAdvice, onSelectDiagnosis, isLoading, onContinueChat, onSaveAndClose }) {
  // Sort diagnoses by confidence (high -> medium -> low)
  const confidenceOrder = { high: 1, medium: 2, low: 3 };
  const sortedDiagnoses = [...diagnoses].sort((a, b) => 
    confidenceOrder[a.confidence] - confidenceOrder[b.confidence]
  );

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'high': return '#4CAF50';
      case 'medium': return '#FF9800';
      case 'low': return '#9E9E9E';
      default: return '#9E9E9E';
    }
  };

  const getConfidenceBadge = (confidence) => {
    switch (confidence) {
      case 'high': return '🎯 High Match';
      case 'medium': return '⚠️ Moderate Match';
      case 'low': return '💭 Possible';
      default: return confidence;
    }
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Summary Message */}
        {summary && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{summary}</Text>
          </View>
        )}

      {/* Diagnosis List Title */}
      <Text style={styles.sectionTitle}>Possible Diagnoses</Text>
      <Text style={styles.subtitle}>Tap on any diagnosis to see detailed treatment plan</Text>

      {/* Diagnosis Cards */}
      {sortedDiagnoses.map((diagnosis, index) => (
        <TouchableOpacity
          key={diagnosis.id}
          style={[
            styles.diagnosisCard,
            index === 0 && styles.firstCard
          ]}
          onPress={() => onSelectDiagnosis(diagnosis.id)}
          activeOpacity={0.7}
        >
          {/* Confidence Badge */}
          <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(diagnosis.confidence) }]}>
            <Text style={styles.confidenceText}>{getConfidenceBadge(diagnosis.confidence)}</Text>
          </View>

          {/* Diagnosis Name */}
          <Text style={styles.diagnosisName}>{diagnosis.name}</Text>

          {/* Short Description */}
          <Text style={styles.shortDescription}>{diagnosis.shortDescription}</Text>

          {/* Matched Symptoms */}
          {diagnosis.matchedSymptoms && diagnosis.matchedSymptoms.length > 0 && (
            <View style={styles.symptomsContainer}>
              <Text style={styles.symptomsLabel}>Matched symptoms:</Text>
              <View style={styles.symptomTags}>
                {diagnosis.matchedSymptoms.slice(0, 3).map((symptom, idx) => (
                  <View key={idx} style={styles.symptomTag}>
                    <Text style={styles.symptomTagText}>✓ {symptom}</Text>
                  </View>
                ))}
                {diagnosis.matchedSymptoms.length > 3 && (
                  <Text style={styles.moreSymptoms}>+{diagnosis.matchedSymptoms.length - 3} more</Text>
                )}
              </View>
            </View>
          )}

          {/* Typical Causes */}
          {diagnosis.typicalCauses && (
            <Text style={styles.typicalCauses}>💡 {diagnosis.typicalCauses}</Text>
          )}

          {/* Tap to Learn More */}
          <View style={styles.tapPrompt}>
            <Text style={styles.tapPromptText}>Tap for treatment plan & tests →</Text>
          </View>
        </TouchableOpacity>
      ))}

      {/* Immediate Advice */}
      {immediateAdvice && (
        <View style={styles.adviceCard}>
          <Text style={styles.adviceTitle}>🏥 Immediate Care</Text>
          <Text style={styles.adviceText}>{immediateAdvice}</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.continueChatButton} 
          onPress={onContinueChat}
          activeOpacity={0.8}
        >
          <Text style={styles.continueChatText}>💬 Continue to Chat</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.saveCloseButton} 
          onPress={onSaveAndClose}
          activeOpacity={0.8}
        >
          <Text style={styles.saveCloseText}>💾 Save & Close Chat</Text>
        </TouchableOpacity>
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          ⚠️ This is AI-generated guidance. Always consult a healthcare professional for accurate diagnosis and personalized treatment.
        </Text>
      </View>
      </ScrollView>
      
      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading diagnosis details...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    position: 'relative',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#2c3e50',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 16,
  },
  diagnosisCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  firstCard: {
    borderLeftWidth: 5,
    borderLeftColor: '#4CAF50',
  },
  confidenceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  confidenceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  diagnosisName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  shortDescription: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 12,
  },
  symptomsContainer: {
    marginBottom: 12,
  },
  symptomsLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 6,
    fontWeight: '600',
  },
  symptomTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  symptomTag: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  symptomTagText: {
    fontSize: 12,
    color: '#2e7d32',
  },
  moreSymptoms: {
    fontSize: 12,
    color: '#7f8c8d',
    alignSelf: 'center',
    marginLeft: 4,
  },
  typicalCauses: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  tapPrompt: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
    marginTop: 4,
  },
  tapPromptText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  adviceCard: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  adviceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  adviceText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  actionButtons: {
    marginTop: 20,
    marginBottom: 16,
  },
  continueChatButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  continueChatText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveCloseButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  saveCloseText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disclaimer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#7f8c8d',
    lineHeight: 18,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600',
  },
});
