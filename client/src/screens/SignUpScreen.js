import { useState, useContext } from 'react';
import { View, TextInput, Text, Button, StyleSheet, Alert, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { AuthContext } from '../context/AuthContext';

export default function SignUpScreen({ navigation }) {
  const { signup, setUser } = useContext(AuthContext);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthday, setBirthday] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = () => {
    if (!firstName || !lastName || !birthday || !gender || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if(password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    if(!/\S+@\S+\.\S+/.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    const formattedBirthday = birthday.toISOString().split('T')[0];

    signup(firstName, lastName, email, password, formattedBirthday, gender)
      .then((data) => {
        Alert.alert('Sign Up Successful', `Welcome, ${firstName}!`);
        setUser(data.user);
      })
      .catch((error) => {
        Alert.alert('Error', error.message || 'Sign Up Failed');
      });
  };

  const onChangeBirthday = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios'); // keep open on iOS
    if (selectedDate) setBirthday(selectedDate);
  };

  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="First Name" value={firstName} onChangeText={setFirstName} />
      <TextInput style={styles.input} placeholder="Last Name" value={lastName} onChangeText={setLastName} />

      <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
        <Text>{birthday ? birthday.toDateString() : 'Select Birthday'}</Text>
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={birthday || new Date()}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={onChangeBirthday}
        />
      )}

      <View style={styles.pickerWrapper}>
        <Picker selectedValue={gender} onValueChange={setGender}>
          <Picker.Item label="Select Gender" value="" />
          <Picker.Item label="Male" value="Male" />
          <Picker.Item label="Female" value="Female" />
          <Picker.Item label="Other" value="Other" />
        </Picker>
      </View>

      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />

      <View style={{ width: '100%', marginBottom: 16 }}>
        <Button title="Create Account" onPress={handleSignUp} />
      </View>

      {/* Back to Login as text link */}
      <View style={styles.loginContainer}>
        <Text style={styles.loginText}>Already have an account?</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.loginLink}> Log In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  input: { width: '100%', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 16, justifyContent: 'center' },
  pickerWrapper: { width: '100%', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 16 },
  loginContainer: { flexDirection: 'row', marginTop: 10 },
  loginText: { fontSize: 14, color: '#333' },
  loginLink: { fontSize: 14, color: '#0b84ff', fontWeight: 'bold' },
});
