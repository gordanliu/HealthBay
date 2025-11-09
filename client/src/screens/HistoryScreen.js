import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getChats, deleteChat } from '../api/chatHistoryApi';

export default function HistoryScreen() {
  const navigation = useNavigation();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      setLoading(true);
      const res = await getChats();
      if (res.success && res.data) {
        setChats(res.data);
      }
    } catch (err) {
      console.error('❌ Error loading chats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadChats();
  };

  const handleChatPress = (chatId) => {
    // Navigate to Chat screen with chatId
    // Navigate to Home tab (ChatStack) and then to Chat screen
    navigation.navigate('Home', {
      screen: 'Chat',
      params: { chatId },
    });
  };

  const handleDeleteChat = (chatId, chatTitle) => {
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete "${chatTitle}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteChat(chatId);
              if (res.success) {
                // Remove chat from list
                setChats(chats.filter(chat => chat.id !== chatId));
              }
            } catch (err) {
              console.error('❌ Error deleting chat:', err);
              Alert.alert('Error', 'Failed to delete conversation. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  const renderChatItem = ({ item }) => {
    const lastActivity = formatDate(item.last_activity);
    const messageCount = item.messages_count || 0;
    const title = item.title || 'Untitled Consultation';
    const status = item.status || 'active';

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => handleChatPress(item.id)}
      >
        <View style={styles.chatContent}>
          <Text style={styles.chatTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.chatMeta}>
            <Text style={styles.chatMetaText}>
              {messageCount} {messageCount === 1 ? 'message' : 'messages'}
            </Text>
            <Text style={styles.chatMetaText}> • </Text>
            <Text style={styles.chatMetaText}>{lastActivity}</Text>
          </View>
          {item.context_summary && (
            <Text style={styles.chatSummary} numberOfLines={2}>
              {item.context_summary}
            </Text>
          )}
          {status !== 'active' && (
            <View style={[styles.statusBadge, status === 'resolved' && styles.statusResolved]}>
              <Text style={styles.statusText}>{status}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteChat(item.id, item.title || 'Untitled Consultation')}
        >
          <Text style={styles.deleteButtonText}>×</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading your conversations...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Chat History</Text>
        <Text style={styles.subtitle}>
          {chats.length === 0
            ? 'No conversations yet'
            : `${chats.length} ${chats.length === 1 ? 'conversation' : 'conversations'}`}
        </Text>
      </View>

      {chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubtext}>
            Start a new consultation to see your chat history here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafbfc',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8c8d',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  chatItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  chatContent: {
    flex: 1,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  chatMeta: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  chatMetaText: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  chatSummary: {
    fontSize: 14,
    color: '#5a6c7d',
    lineHeight: 20,
    marginTop: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  statusResolved: {
    backgroundColor: '#e8f5e9',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1976d2',
    textTransform: 'capitalize',
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffebee',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  deleteButtonText: {
    fontSize: 24,
    color: '#f44336',
    fontWeight: 'bold',
    lineHeight: 24,
  },
});
