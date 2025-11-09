import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ChatInput({ input, setInput, onSend }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity>
        <Ionicons name="add" size={22} color="#777" />
      </TouchableOpacity>
      <TextInput
        style={styles.input}
        placeholder="Describe your symptoms..."
        value={input}
        onChangeText={setInput}
      />
      <TouchableOpacity onPress={onSend}>
        <Ionicons name="send" size={22} color="#8ab4f8" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  input: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 20,
    backgroundColor: '#f4f4f4',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
