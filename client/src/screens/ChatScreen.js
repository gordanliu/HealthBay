import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';
import { sendChatMessage } from '../api/chatApi';

export default function ChatScreen() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hello! I'm your health assistant. Please describe your symptoms, and I'll help you understand what might be happening.",
      time: '06:43 PM',
    },
  ]);
  const [input, setInput] = useState('');
  const [context, setContext] = useState({});

  const handleSend = async () => {
    if (!input.trim()) return;

    const newUserMsg = {
      role: 'user',
      text: input,
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setMessages((prev) => [...prev, newUserMsg]);
    setInput('');

    try {
      const res = await sendChatMessage({
        message: input,
        chatHistory: messages,
        currentContext: context,
      });
      const aiResponse = res.data.response || 'No response';
      const newAiMsg = {
        role: 'assistant',
        text: aiResponse,
        time: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setMessages((prev) => [...prev, newAiMsg]);
      setContext(res.data);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Error: could not connect to the server.',
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.chatArea}>
        {messages.map((msg, index) => (
          <ChatBubble
            key={index}
            role={msg.role}
            text={msg.text}
            time={msg.time}
          />
        ))}
      </ScrollView>
      <ChatInput input={input} setInput={setInput} onSend={handleSend} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafbfc' },
  chatArea: { padding: 16 },
});
