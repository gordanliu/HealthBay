import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AuthContext } from '../context/AuthContext';

export default function Profile() {
  const { user, setIsLoggedIn } = useContext(AuthContext);

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  if (!user) {
    // fallback if somehow profile is opened before login
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No user data available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Profile 👤</Text>

      <View style={styles.infoContainer}>
        <Text style={styles.label}>First Name:</Text>
        <Text style={styles.value}>{user.firstName}</Text>

        <Text style={styles.label}>Last Name:</Text>
        <Text style={styles.value}>{user.lastName}</Text>

        <Text style={styles.label}>Age:</Text>
        <Text style={styles.value}>{user.age}</Text>

        <Text style={styles.label}>Gender:</Text>
        <Text style={styles.value}>{user.gender}</Text>

        <Text style={styles.label}>Email:</Text>
        <Text style={styles.value}>{user.email}</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f9f9f9', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 30, textAlign: 'center' },
  infoContainer: { marginBottom: 40 },
  label: { fontWeight: '600', fontSize: 16, marginTop: 10 },
  value: { fontSize: 16, color: '#555' },
  logoutButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: 'center',
    marginHorizontal: 50,
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

