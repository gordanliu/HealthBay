import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getChats, deleteChat } from '../api/chatHistoryApi';

export default function HomeScreen({ navigation, setUser }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    loadChats();
  }, []);

  // Reload chats when screen comes into focus (when returning from chat)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadChats();
    });
    return unsubscribe;
  }, [navigation]);

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
      
      // Animate in after loading
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadChats();
  };

  const handleStartNewChat = () => {
    // Animate out before navigation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigation.navigate('Chat', { isNewChat: true });
      // Reset animations for when returning
      fadeAnim.setValue(1);
      scaleAnim.setValue(1);
    });
  };

  const handleChatPress = (chatId) => {
    navigation.navigate('Chat', { chatId });
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
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    });
  };

  const renderChatItem = ({ item }) => {
    const lastActivity = formatDate(item.last_activity);
    const messageCount = item.messages_count || 0;
    const title = item.title || 'Untitled Consultation';
    const summary = item.context_summary || '';

    return (
      <TouchableOpacity
        style={styles.chatCard}
        onPress={() => handleChatPress(item.id)}
      >
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle} numberOfLines={1}>
              {title}
            </Text>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteChat(item.id, title)}
            >
              <Text style={styles.deleteButtonText}>×</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chatMeta}>
            <Text style={styles.chatMetaText}>
              {messageCount} {messageCount === 1 ? 'message' : 'messages'}
            </Text>
            <Text style={styles.chatMetaText}> • </Text>
            <Text style={styles.chatMetaText}>{lastActivity}</Text>
          </View>
          {summary && (
            <Text style={styles.chatSummary} numberOfLines={2}>
              {summary}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.animatedContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.welcomeTitle}>Welcome to HealthBay</Text>
          <Text style={styles.subtitle}>Your AI-powered health companion</Text>
          
          {/* Start New Conversation Button */}
          <TouchableOpacity 
            style={styles.newChatButton}
            onPress={handleStartNewChat}
            activeOpacity={0.8}
          >
            <Text style={styles.newChatButtonIcon}>+</Text>
            <Text style={styles.newChatButtonText}>Start New Conversation</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Conversations Section */}
        <View style={styles.conversationsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Conversations</Text>
            <Text style={styles.chatCount}>
              {chats.length} {chats.length === 1 ? 'chat' : 'chats'}
            </Text>
          </View>

          {chats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySubtext}>
                Start a new conversation to get help with your health concerns.
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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  animatedContainer: {
    flex: 1,
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 24,
    paddingTop: 60,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  welcomeTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.95,
    marginBottom: 24,
    fontWeight: '500',
  },
  newChatButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  newChatButtonIcon: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginRight: 8,
  },
  newChatButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#4CAF50',
  },
  conversationsSection: {
    flex: 1,
    padding: 16,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  chatCount: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 16,
  },
  chatCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
    marginRight: 8,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffebee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f44336',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  deleteButtonText: {
    fontSize: 20,
    color: '#f44336',
    fontWeight: 'bold',
    lineHeight: 20,
  },
  chatMeta: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  chatMetaText: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  chatSummary: {
    fontSize: 14,
    color: '#5a6c7d',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 8,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },
});
