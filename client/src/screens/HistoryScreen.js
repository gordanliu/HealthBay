import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getChatHistory, deleteChatSession } from '../utils/chatStorage';

export default function HistoryScreen() {
  const [chatHistory, setChatHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Load chat history when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const loadHistory = async () => {
    try {
      const history = await getChatHistory();
      setChatHistory(history);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const handleViewChat = (chat) => {
    // Show detailed view of the chat
    const refinedInfo = chat.refinedDiagnosis 
      ? `\n\n✅ Refined Diagnosis: ${chat.refinedDiagnosis.name || 'N/A'}\nConfidence: ${chat.confidenceLevel || 'N/A'}\nTests Completed: Yes`
      : '';
    
    Alert.alert(
      chat.injuryType || 'Chat Details',
      `Date: ${chat.date} at ${chat.time}\nBody Part: ${chat.bodyPart}\nSymptoms: ${chat.symptoms.join(', ')}\n\nMessages: ${chat.messages.length}${refinedInfo}`,
      [
        { text: 'Close', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteChat(chat.id),
        },
      ]
    );
  };

  const handleDeleteChat = async (chatId) => {
    Alert.alert(
      'Delete Chat',
      'Are you sure you want to delete this chat? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChatSession(chatId);
              await loadHistory();
              Alert.alert('Success', 'Chat deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete chat');
            }
          },
        },
      ]
    );
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chatCard}
      onPress={() => handleViewChat(item)}
      activeOpacity={0.7}
    >
      <View style={styles.chatHeader}>
        <Text style={styles.injuryType}>{item.injuryType || 'Health Consultation'}</Text>
        <Text style={styles.timestamp}>{item.date}</Text>
      </View>
      
      <View style={styles.chatBody}>
        <View style={styles.bodyPartBadge}>
          <Text style={styles.bodyPartText}>📍 {item.bodyPart}</Text>
        </View>
        {item.completedTests && item.refinedDiagnosis && (
          <View style={styles.refinedBadge}>
            <Text style={styles.refinedText}>✅ Tests Complete - {item.confidenceLevel || 'N/A'} confidence</Text>
          </View>
        )}
        <Text style={styles.summary} numberOfLines={2}>{item.summary}</Text>
      </View>

      <View style={styles.chatFooter}>
        <Text style={styles.messageCount}>💬 {item.messages.length} messages</Text>
        <Text style={styles.timeText}>{item.time}</Text>
      </View>
    </TouchableOpacity>
  );

  if (chatHistory.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No Chat History Yet</Text>
          <Text style={styles.emptySubtitle}>
            Your saved chats will appear here.{'\n'}
            Complete a diagnosis and tap "Save & Close Chat" to save it.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Chat History</Text>
        <Text style={styles.subtitle}>{chatHistory.length} saved chat{chatHistory.length !== 1 ? 's' : ''}</Text>
      </View>
      
      <FlatList
        data={chatHistory}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#007AFF']} />
        }
      />
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
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  subtitle: { 
    fontSize: 14, 
    color: '#7f8c8d',
  },
  listContainer: {
    padding: 16,
  },
  chatCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  injuryType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  chatBody: {
    marginBottom: 12,
  },
  bodyPartBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  bodyPartText: {
    fontSize: 13,
    color: '#1976d2',
    fontWeight: '600',
  },
  refinedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  refinedText: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '600',
  },
  summary: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  messageCount: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
  },
});
