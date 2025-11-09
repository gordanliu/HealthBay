import { View, Text, Button, StyleSheet } from 'react-native';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Alert } from 'react-native';

export default function ProfileScreen() {
  const { setUser, setIsLoggedIn, logout, user } = useContext(AuthContext);

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setIsLoggedIn(false);
      Alert.alert("Logged out", "You have successfully logged out.");
    } catch (e) {
      console.error("Logout error:", e);
      Alert.alert("Error", "Failed to log out.");
    }
  };

  if (!user) return null; // or a loading spinner

  const { name, email, age, gender } = user.user_metadata;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.infoContainer}>
        <Text style={styles.label}>Name:</Text>
        <Text style={styles.value}>{name}</Text>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.label}>Email:</Text>
        <Text style={styles.value}>{email}</Text>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.label}>Age:</Text>
        <Text style={styles.value}>{age}</Text>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.label}>Gender:</Text>
        <Text style={styles.value}>{gender}</Text>
      </View>

      <View style={{ marginTop: 30, width: '80%' }}>
        <Button title="Log Out" onPress={handleLogout} color="red" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 20 },
  infoContainer: { flexDirection: 'row', marginBottom: 15, width: '100%' },
  label: { fontWeight: '600', width: 80 },
  value: { flex: 1, fontSize: 16 },
});
