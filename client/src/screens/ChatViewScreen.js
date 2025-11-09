import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

export default function ChatViewScreen({ route, navigation }) {
  const { chat } = route.params;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{chat.injuryType}</Text>
          <Text style={styles.headerSubtitle}>{chat.date} at {chat.time}</Text>
        </View>
      </View>

      {/* Chat Messages */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.chatContainer}>
        {/* Context Info */}
        <View style={styles.contextCard}>
          <Text style={styles.contextTitle}>📋 Session Details</Text>
          <View style={styles.contextRow}>
            <Text style={styles.contextLabel}>Body Part:</Text>
            <Text style={styles.contextValue}>{chat.bodyPart}</Text>
          </View>
          <View style={styles.contextRow}>
            <Text style={styles.contextLabel}>Symptoms:</Text>
            <Text style={styles.contextValue}>{chat.symptoms.join(', ')}</Text>
          </View>
          {chat.refinedDiagnosis && (
            <>
              <View style={styles.contextRow}>
                <Text style={styles.contextLabel}>Refined Diagnosis:</Text>
                <Text style={styles.contextValue}>{chat.refinedDiagnosis.name}</Text>
              </View>
              <View style={styles.contextRow}>
                <Text style={styles.contextLabel}>Confidence:</Text>
                <Text style={[styles.contextValue, styles.confidenceBadge]}>
                  {chat.confidenceLevel?.toUpperCase() || 'N/A'}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Messages */}
        {chat.messages.map((msg, index) => (
          <View 
            key={index} 
            style={[
              styles.messageCard,
              msg.role === 'user' ? styles.userMessage : styles.aiMessage
            ]}
          >
            <Text style={styles.messageRole}>
              {msg.role === 'user' ? '👤 You' : '🤖 HealthBay'}
            </Text>
            <Text style={styles.messageText}>{msg.text}</Text>
            <Text style={styles.messageTime}>{msg.time}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
  },
  headerInfo: {
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  scrollView: {
    flex: 1,
  },
  chatContainer: {
    padding: 16,
  },
  contextCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contextTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  contextRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  contextLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    width: 120,
  },
  contextValue: {
    flex: 1,
    fontSize: 14,
    color: '#2c3e50',
  },
  confidenceBadge: {
    backgroundColor: '#4CAF50',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
  },
  messageCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userMessage: {
    backgroundColor: '#e3f2fd',
    alignSelf: 'flex-end',
    maxWidth: '85%',
    marginLeft: '15%',
  },
  aiMessage: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    maxWidth: '85%',
    marginRight: '15%',
  },
  messageRole: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#2c3e50',
    lineHeight: 22,
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    textAlign: 'right',
  },
});
