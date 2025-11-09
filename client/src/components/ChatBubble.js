import { View, Text, StyleSheet } from 'react-native';

export default function ChatBubble({ role, text, time }) {
  const isUser = role === 'user';
  return (
    <View
      style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.aiBubble,
        isUser ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' },
      ]}
    >
      <Text style={isUser ? styles.userText : styles.aiText}>{text}</Text>
      <Text style={styles.timestamp}>{time}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '80%',
    borderRadius: 12,
    padding: 10,
    marginVertical: 6,
  },
  userBubble: {
    backgroundColor: '#007AFF',
  },
  aiBubble: {
    backgroundColor: '#F4F5F7',
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 10,
    color: '#888',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
});
