import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

export default function DiagnosticTest({ testData, onTestAction }) {
  const { stage } = testData;

  // Test Introduction Screen
  if (stage === 'DIAGNOSTIC_TEST_INTRO') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>🔬 Diagnostic Testing</Text>
          <Text style={styles.subtitle}>
            Interactive self-assessment to help confirm your diagnosis
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About These Tests</Text>
          <Text style={styles.bodyText}>{testData.introduction}</Text>
        </View>

        <View style={[styles.section, styles.warningSection]}>
          <Text style={styles.warningTitle}>⚠️ Safety First</Text>
          <Text style={styles.warningText}>{testData.safetyWarning}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What to Expect</Text>
          <Text style={styles.bodyText}>
            You'll complete {testData.testSession?.totalTests || 0} diagnostic tests. 
            Each test will guide you through specific movements or positions. 
            Follow the instructions carefully and stop immediately if you feel severe pain.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => onTestAction({ action: 'start_test' })}
          >
            <Text style={styles.primaryButtonText}>Begin Testing</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => onTestAction({ action: 'exit_test' })}
          >
            <Text style={styles.secondaryButtonText}>← Back to Diagnosis</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Test Step Screen
  if (stage === 'DIAGNOSTIC_TEST_STEP') {
    const { currentTest, progress } = testData;

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.contentContainer}>
          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>
                Test {progress.testNumber} of {progress.totalTests}
              </Text>
              <Text style={styles.progressPercentage}>{progress.percentage}%</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${progress.percentage}%` }]} />
            </View>
          </View>

          {/* Test Info */}
          <View style={styles.testHeader}>
            <Text style={styles.testName}>{currentTest.name}</Text>
            <Text style={styles.testPurpose}>{currentTest.purpose}</Text>
            <View style={styles.timeEstimate}>
              <Text style={styles.timeEstimateText}>⏱️ {currentTest.estimatedTime}</Text>
            </View>
          </View>

          {/* Current Step */}
          <View style={[styles.section, styles.stepSection]}>
            <Text style={styles.stepTitle}>
              Step {currentTest.stepNumber} of {currentTest.totalSteps}
            </Text>
            <Text style={styles.stepInstruction}>{currentTest.stepInstruction}</Text>
          </View>

          {/* Safety Note */}
          {currentTest.safetyNote && (
            <View style={[styles.section, styles.safetyNoteSection]}>
              <Text style={styles.safetyNoteText}>💡 {currentTest.safetyNote}</Text>
            </View>
          )}
        </ScrollView>

        {/* Fixed Bottom Buttons */}
        <View style={styles.fixedButtonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => onTestAction({ action: 'next_step' })}
          >
            <Text style={styles.primaryButtonText}>
              {currentTest.stepNumber === currentTest.totalSteps 
                ? 'Complete Test' 
                : 'Next Step →'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={() => onTestAction({ action: 'stop_test', reason: 'pain' })}
          >
            <Text style={styles.dangerButtonText}>⚠️ Stop - Severe Pain</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Test Result Screen
  if (stage === 'DIAGNOSTIC_TEST_RESULT') {
    const { currentTest, question, progress } = testData;

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.contentContainer}>
          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>
                Test {progress.testNumber} of {progress.totalTests}
              </Text>
              <Text style={styles.progressPercentage}>{progress.percentage}%</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${progress.percentage}%` }]} />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.testName}>{currentTest.name}</Text>
            <Text style={styles.questionText}>{question}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What to Look For:</Text>
            <Text style={styles.bodyText}>{currentTest.whatToLookFor}</Text>
          </View>
        </ScrollView>

        {/* Fixed Bottom Buttons */}
        <View style={styles.fixedButtonContainer}>
          <TouchableOpacity
            style={[styles.resultButton, styles.positiveButton]}
            onPress={() => onTestAction({ action: 'submit_result', result: 'positive' })}
          >
            <Text style={styles.resultButtonText}>✓ Yes (Positive)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resultButton, styles.negativeButton]}
            onPress={() => onTestAction({ action: 'submit_result', result: 'negative' })}
          >
            <Text style={styles.resultButtonText}>✗ No (Negative)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resultButton, styles.unsureButton]}
            onPress={() => onTestAction({ action: 'submit_result', result: 'unsure' })}
          >
            <Text style={styles.resultButtonText}>? Unsure</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resultButton, styles.stoppedButton]}
            onPress={() => onTestAction({ action: 'submit_result', result: 'stopped' })}
          >
            <Text style={styles.resultButtonText}>⚠️ Stopped - Too Painful</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Test Transition Screen
  if (stage === 'DIAGNOSTIC_TEST_TRANSITION') {
    const { completedTest, nextTest, progress } = testData;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>
              Test {progress.testNumber} of {progress.totalTests}
            </Text>
            <Text style={styles.progressPercentage}>{progress.percentage}%</Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarFill, { width: `${progress.percentage}%` }]} />
          </View>
        </View>

        <View style={[styles.section, styles.completedSection]}>
          <Text style={styles.completedTitle}>✓ Test Completed</Text>
          <Text style={styles.completedTestName}>{completedTest.name}</Text>
          <Text style={styles.completedResult}>Result: {completedTest.result}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Next Test</Text>
          <Text style={styles.nextTestName}>{nextTest.name}</Text>
          <Text style={styles.bodyText}>{nextTest.purpose}</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => onTestAction({ action: 'start_test' })}
          >
            <Text style={styles.primaryButtonText}>Start Next Test</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => onTestAction({ action: 'stop_test', reason: 'user_choice' })}
          >
            <Text style={styles.secondaryButtonText}>Stop Testing</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Test Stopped Screen
  if (stage === 'DIAGNOSTIC_TEST_STOPPED') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.section, styles.warningSection]}>
          <Text style={styles.warningTitle}>⚠️ Testing Stopped</Text>
          <Text style={styles.warningText}>{testData.message}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommendation</Text>
          <Text style={styles.bodyText}>{testData.recommendation}</Text>
        </View>

        {testData.partialResults && testData.partialResults.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completed Tests</Text>
            {testData.partialResults.map((result, idx) => (
              <View key={idx} style={styles.resultItem}>
                <Text style={styles.resultItemText}>
                  {result.testName}: {result.result}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => onTestAction({ action: 'exit_test' })}
          >
            <Text style={styles.primaryButtonText}>Back to Diagnosis</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Default fallback
  return (
    <View style={styles.container}>
      <Text>Unknown test stage: {stage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    lineHeight: 22,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    color: '#2c3e50',
    lineHeight: 22,
  },
  warningSection: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 15,
    color: '#856404',
    lineHeight: 22,
  },
  buttonContainer: {
    marginTop: 24,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
  },
  progressSection: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  testHeader: {
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
  testName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  testPurpose: {
    fontSize: 15,
    color: '#555',
    lineHeight: 20,
    marginBottom: 12,
  },
  timeEstimate: {
    alignSelf: 'flex-start',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  timeEstimateText: {
    fontSize: 13,
    color: '#1976d2',
    fontWeight: '600',
  },
  stepSection: {
    backgroundColor: '#e8f5e9',
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 12,
  },
  stepInstruction: {
    fontSize: 16,
    color: '#1b5e20',
    lineHeight: 24,
    fontWeight: '500',
  },
  safetyNoteSection: {
    backgroundColor: '#fff3e0',
  },
  safetyNoteText: {
    fontSize: 14,
    color: '#e65100',
    lineHeight: 20,
  },
  fixedButtonContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  dangerButton: {
    backgroundColor: '#dc3545',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  questionText: {
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 24,
    marginBottom: 16,
  },
  resultButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  resultButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  positiveButton: {
    backgroundColor: '#28a745',
  },
  negativeButton: {
    backgroundColor: '#6c757d',
  },
  unsureButton: {
    backgroundColor: '#ffc107',
  },
  stoppedButton: {
    backgroundColor: '#dc3545',
  },
  completedSection: {
    backgroundColor: '#d4edda',
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  completedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#155724',
    marginBottom: 8,
  },
  completedTestName: {
    fontSize: 16,
    color: '#155724',
    marginBottom: 4,
  },
  completedResult: {
    fontSize: 14,
    color: '#155724',
    fontWeight: '600',
  },
  nextTestName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  resultItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  resultItemText: {
    fontSize: 14,
    color: '#2c3e50',
  },
});
