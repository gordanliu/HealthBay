import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getChatHistory, deleteChatSession } from '../utils/chatStorage';

export default function HomeScreen({ navigation }) {
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
    // Navigate to full chat view
    navigation.navigate('ChatView', { chat });
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
      onLongPress={() => handleDeleteChat(item.id)}
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

  return (
    <View style={styles.container}>
      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeTitle}>Welcome to HealthBay</Text>
        <Text style={styles.welcomeSubtitle}>Your AI-powered health companion</Text>
        
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => navigation.navigate('Chat')}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>+ Start New Conversation</Text>
        </TouchableOpacity>
      </View>

      {/* History Section */}
      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Recent Conversations</Text>
          {chatHistory.length > 0 && (
            <Text style={styles.historyCount}>{chatHistory.length} chat{chatHistory.length !== 1 ? 's' : ''}</Text>
          )}
        </View>

        {chatHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtitle}>
              Start a new conversation to get personalized health guidance
            </Text>
          </View>
        ) : (
          <FlatList
            data={chatHistory}
            renderItem={renderChatItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f7fa',
  },
  welcomeSection: {
    backgroundColor: '#4CAF50',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  historySection: {
    flex: 1,
    paddingTop: 20,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  historyCount: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
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
    color: '#4CAF50',
    fontWeight: '600',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
  },
});
