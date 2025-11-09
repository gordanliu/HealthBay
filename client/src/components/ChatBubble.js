import { View, Text, StyleSheet, Linking } from 'react-native';

export default function ChatBubble({ role, text, time, provenance, sources, ragUsed }) {
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

      {/* 🧠 Show provenance + sources only for AI messages */}
      {!isUser && (
        <>
          {provenance && (
            <Text
              style={[
                styles.provenance,
                { color: ragUsed ? '#2ecc71' : '#f1c40f' }, // green if RAG, yellow if AI
              ]}
            >
              {provenance}
            </Text>
          )}

          {sources && sources.length > 0 && (
            <View style={styles.sourceContainer}>
              {sources.map((src, i) => (
                <Text
                  key={i}
                  style={styles.sourceLink}
                  onPress={() => {
                    const urlMatch = src.match(/https?:\/\/\S+/);
                    if (urlMatch) Linking.openURL(urlMatch[0]);
                  }}
                >
                  {src}
                </Text>
              ))}
            </View>
          )}
        </>
      )}

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
  provenance: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 6,
  },
  sourceContainer: {
    marginTop: 4,
  },
  sourceLink: {
    fontSize: 12,
    color: '#3498DB',
    textDecorationLine: 'underline',
    marginBottom: 2,
  },
});
