import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

export default function DiagnosisDetail({ diagnosisDetail, onStartDiagnosticTest, onBack, onConfirmInjury }) {
  const {
    diagnosisName,
    overview,
    detailedSymptoms,
    causes,
    recoveryTimeline,
    treatmentPlan,
    diagnosticTests,
    redFlags,
    whenToSeeDoctorImmediate,
    whenToSeeDoctor24_48hrs,
    estimatedRecoveryTime,
    returnToActivityGuidelines,
  } = diagnosisDetail;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back to Diagnosis List</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.diagnosisName}>{diagnosisName}</Text>
          {estimatedRecoveryTime && (
            <View style={styles.recoveryBadge}>
              <Text style={styles.recoveryBadgeText}>⏱️ {estimatedRecoveryTime}</Text>
            </View>
          )}
        </View>

        {/* Overview */}
        {overview && (
          <View style={styles.section}>
            <Text style={styles.overviewText}>{overview}</Text>
          </View>
        )}

        {/* Red Flags - Most Important */}
        {redFlags && redFlags.length > 0 && (
          <View style={[styles.section, styles.redFlagSection]}>
            <Text style={styles.redFlagTitle}>🚨 Seek Emergency Care If:</Text>
            {redFlags.map((flag, idx) => (
              <View key={idx} style={styles.redFlagItem}>
                <Text style={styles.redFlagBullet}>•</Text>
                <Text style={styles.redFlagText}>{flag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Diagnostic Tests */}
        {diagnosticTests && diagnosticTests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔬 Self-Diagnostic Tests</Text>
            <Text style={styles.sectionSubtitle}>
              These tests can help confirm this diagnosis. Tap below to start interactive testing.
            </Text>
            
            <TouchableOpacity 
              style={styles.startTestButton}
              onPress={onStartDiagnosticTest}
            >
              <Text style={styles.startTestButtonText}>Start Interactive Testing</Text>
              <Text style={styles.startTestButtonSubtext}>I'll guide you through each test step-by-step</Text>
            </TouchableOpacity>

            {/* Show test previews */}
            {diagnosticTests.map((test, idx) => (
              <View key={idx} style={styles.testPreview}>
                <Text style={styles.testName}>{idx + 1}. {test.name}</Text>
                <Text style={styles.testDescription}>{test.description}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Treatment Plan */}
        {treatmentPlan && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💊 Treatment Plan</Text>
            
            {treatmentPlan.immediate && treatmentPlan.immediate.length > 0 && (
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Immediate Care (First 48 hours)</Text>
                {treatmentPlan.immediate.map((item, idx) => (
                  <View key={idx} style={styles.listItem}>
                    <Text style={styles.bullet}>✓</Text>
                    <Text style={styles.listItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}

            {treatmentPlan.ongoing && treatmentPlan.ongoing.length > 0 && (
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Ongoing Treatment</Text>
                {treatmentPlan.ongoing.map((item, idx) => (
                  <View key={idx} style={styles.listItem}>
                    <Text style={styles.bullet}>✓</Text>
                    <Text style={styles.listItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}

            {treatmentPlan.rehabilitation && treatmentPlan.rehabilitation.length > 0 && (
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Rehabilitation Exercises</Text>
                {treatmentPlan.rehabilitation.map((item, idx) => (
                  <View key={idx} style={styles.listItem}>
                    <Text style={styles.bullet}>💪</Text>
                    <Text style={styles.listItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}

            {treatmentPlan.requiresProfessional && treatmentPlan.requiresProfessional.length > 0 && (
              <View style={[styles.subsection, styles.professionalSection]}>
                <Text style={styles.subsectionTitle}>⚕️ May Require Professional Care</Text>
                {treatmentPlan.requiresProfessional.map((item, idx) => (
                  <View key={idx} style={styles.listItem}>
                    <Text style={styles.bullet}>→</Text>
                    <Text style={styles.listItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Recovery Timeline */}
        {recoveryTimeline && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📅 Recovery Timeline</Text>
            
            {recoveryTimeline.acute && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: '#f44336' }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>Acute Phase</Text>
                  <Text style={styles.timelineText}>{recoveryTimeline.acute}</Text>
                </View>
              </View>
            )}

            {recoveryTimeline.subacute && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: '#ff9800' }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>Subacute Phase</Text>
                  <Text style={styles.timelineText}>{recoveryTimeline.subacute}</Text>
                </View>
              </View>
            )}

            {recoveryTimeline.chronic && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: '#4caf50' }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>Return to Activity</Text>
                  <Text style={styles.timelineText}>{recoveryTimeline.chronic}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Detailed Symptoms */}
        {detailedSymptoms && detailedSymptoms.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🩺 Detailed Symptoms</Text>
            {detailedSymptoms.map((symptom, idx) => (
              <View key={idx} style={styles.listItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.listItemText}>{symptom}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Causes */}
        {causes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔍 What Causes This?</Text>
            <Text style={styles.bodyText}>{causes}</Text>
          </View>
        )}

        {/* When to See Doctor */}
        {(whenToSeeDoctorImmediate || whenToSeeDoctor24_48hrs) && (
          <View style={[styles.section, styles.doctorSection]}>
            <Text style={styles.sectionTitle}>⚕️ When to See a Doctor</Text>
            
            {whenToSeeDoctorImmediate && whenToSeeDoctorImmediate.length > 0 && (
              <View style={styles.subsection}>
                <Text style={styles.urgentLabel}>Seek Immediate Care:</Text>
                {whenToSeeDoctorImmediate.map((item, idx) => (
                  <View key={idx} style={styles.listItem}>
                    <Text style={styles.bullet}>🚨</Text>
                    <Text style={styles.listItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}

            {whenToSeeDoctor24_48hrs && whenToSeeDoctor24_48hrs.length > 0 && (
              <View style={styles.subsection}>
                <Text style={styles.urgentLabel}>See Doctor Within 24-48 Hours:</Text>
                {whenToSeeDoctor24_48hrs.map((item, idx) => (
                  <View key={idx} style={styles.listItem}>
                    <Text style={styles.bullet}>⚠️</Text>
                    <Text style={styles.listItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Return to Activity */}
        {returnToActivityGuidelines && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏃 Return to Activity Guidelines</Text>
            <Text style={styles.bodyText}>{returnToActivityGuidelines}</Text>
          </View>
        )}

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚠️ This is AI-generated guidance based on general information. Always consult a healthcare professional for accurate diagnosis and personalized treatment.
          </Text>
        </View>

        {/* Confirm Injury Button */}
        {onConfirmInjury && (
          <View style={styles.confirmSection}>
            <TouchableOpacity 
              style={styles.confirmButton}
              onPress={onConfirmInjury}
            >
              <Text style={styles.confirmButtonText}>✓ Confirm Injury</Text>
              <Text style={styles.confirmButtonSubtext}>Start a conversation about this injury</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  header: {
    marginBottom: 16,
  },
  diagnosisName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  recoveryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  recoveryBadgeText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  redFlagSection: {
    backgroundColor: '#ffebee',
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  redFlagTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#c62828',
    marginBottom: 12,
  },
  redFlagItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  redFlagBullet: {
    fontSize: 16,
    color: '#f44336',
    marginRight: 8,
    fontWeight: 'bold',
  },
  redFlagText: {
    flex: 1,
    fontSize: 14,
    color: '#c62828',
    lineHeight: 20,
    fontWeight: '600',
  },
  overviewText: {
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 12,
    lineHeight: 20,
  },
  startTestButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  startTestButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  startTestButtonSubtext: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.9,
  },
  testPreview: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  testName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  testDescription: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
  },
  subsection: {
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  professionalSection: {
    backgroundColor: '#fff3e0',
    padding: 12,
    borderRadius: 8,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bullet: {
    fontSize: 14,
    color: '#007AFF',
    marginRight: 8,
    fontWeight: 'bold',
  },
  listItemText: {
    flex: 1,
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  timelineText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  bodyText: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 22,
  },
  doctorSection: {
    backgroundColor: '#fff8e1',
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  urgentLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e65100',
    marginBottom: 8,
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
  confirmSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  confirmButtonSubtext: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
});
