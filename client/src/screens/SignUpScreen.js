import { useState, useContext } from 'react';
import { View, TextInput, Button, StyleSheet, Alert, Platform, Text, TouchableOpacity } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { AuthContext } from '../context/AuthContext';

export default function SignUpScreen({ navigation }) {
  const { signup, setUser } = useContext(AuthContext);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthday, setBirthday] = useState(null); // store Date object
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = () => {
    if (!firstName || !lastName || !birthday || !gender || !username || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Format birthday as YYYY-MM-DD
    const formattedBirthday = birthday.toISOString().split('T')[0];

    signup(firstName, lastName, username, password, formattedBirthday, gender)
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
      <TextInput
        style={styles.input}
        placeholder="First Name"
        value={firstName}
        onChangeText={setFirstName}
      />
      <TextInput
        style={styles.input}
        placeholder="Last Name"
        value={lastName}
        onChangeText={setLastName}
      />

      <TouchableOpacity
        style={styles.input}
        onPress={() => setShowDatePicker(true)}
      >
        <Text>{birthday ? birthday.toDateString() : 'Select Birthday'}</Text>
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={birthday || new Date()}
          mode="date"
          display="default"
          maximumDate={new Date()} // can't pick future date
          onChange={onChangeBirthday}
        />
      )}

      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={gender}
          onValueChange={(itemValue) => setGender(itemValue)}
        >
          <Picker.Item label="Select Gender" value="" />
          <Picker.Item label="Male" value="Male" />
          <Picker.Item label="Female" value="Female" />
          <Picker.Item label="Other" value="Other" />
        </Picker>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <View style={{ width: '100%', marginBottom: 16 }}>
        <Button title="Create Account" onPress={handleSignUp} />
      </View>
      <Button title="Back to Login" onPress={() => navigation.goBack()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  input: { width: '100%', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 16, justifyContent: 'center' },
  pickerWrapper: { width: '100%', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 16 },
});
