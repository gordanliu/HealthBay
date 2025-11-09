import { View, Text, Button, StyleSheet } from 'react-native';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import authService from '../api/authApi';
import { Alert } from 'react-native';

export default function ProfileScreen() {
  const { setUser, setIsLoggedIn, logout } = useContext(AuthContext);

  const handleLogout = async () => {
    try {
      // Call your backend logout
      await logout();

      // Clear local state
      setUser(null);
      setIsLoggedIn(false);

      Alert.alert("Logged out", "You have successfully logged out.");
    } catch (e) {
      console.error("Logout error:", e);
      Alert.alert("Error", "Failed to log out.");
    }
  };
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Your account details will go here.</Text>
      <Button title="Log Out" onPress={handleLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 10 },
  subtitle: { fontSize: 16, color: 'gray', marginBottom: 20 },
});
