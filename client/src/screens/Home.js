import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AuthContext } from '../context/AuthContext';

export default function Home({ navigation }) {
  const { setIsLoggedIn } = useContext(AuthContext);

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  return (
    <View style={styles.container}>
      {/* Top logout button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Main content */}
      <View style={styles.mainContent}>

        <TouchableOpacity
          style={styles.assessmentButton}
          onPress={() => navigation.navigate('SymptomAssessment')}
        >
          <Text style={styles.buttonText}>Start Symptom Assessment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 50, // space for status bar
    alignItems: 'flex-end', // top-right
  },
  logoutButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center', // center vertically
    alignItems: 'center',     // center horizontally
    paddingHorizontal: 20,
  },
  assessmentButton: {
    width: '80%',
    backgroundColor: '#4a90e2',
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
