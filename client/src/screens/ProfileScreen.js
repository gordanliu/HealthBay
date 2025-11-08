import { View, Text, Button, StyleSheet } from 'react-native';

export default function ProfileScreen({ setUser }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Your account details will go here.</Text>
      <Button title="Log Out" onPress={() => setUser(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 10 },
  subtitle: { fontSize: 16, color: 'gray', marginBottom: 20 },
});
