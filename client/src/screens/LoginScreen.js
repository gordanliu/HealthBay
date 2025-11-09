import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

import {
  Text,
  View,
  StyleSheet,
  TextInput,
  Button,
  Alert,
  TouchableOpacity,
} from 'react-native';

export default function LoginScreen({ navigation}) {
  const { login, setUser } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (email && password) {
      if(!/\S+@\S+\.\S+/.test(email)) {
        Alert.alert('Error', 'Please enter a valid email address');
        return;
      }
      login(email, password).then((data) => {
        if (data.user) {
          Alert.alert(`Welcome back, ${data.user.user_metadata.name}!`);
          setUser(data.user);
        } 
      }).catch(() => {
        Alert.alert('Error', 'Invalid email or password');
      });
    } else {
      Alert.alert('Error', 'Please enter both email and password');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Welcome to HealthBay</Text>

      <Text style={styles.instruction}>
        Please login with your email and password!
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {/* login button */}
      <View style={styles.buttonWrapper}>
        <Button title="Log In" onPress={handleLogin} />
      </View>

      <View style={styles.signUpContainer}>
        <Text style={styles.signUpText}>Don't have an account?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
          <Text style={(styles.signUpText, styles.signUpLink)}> Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  welcome: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
    color: '#0b84ff',
  },
  instruction: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  buttonWrapper: {
    width: '100%',
    marginBottom: 12,
  },
  signUpContainer: {
    flexDirection: 'row',
    marginTop: 10,
  },
  signUpText: {
    fontSize: 14,
    color: '#333',
  },
  signUpLink: { color: '#0b84ff', fontWeight: 'bold' },
});
