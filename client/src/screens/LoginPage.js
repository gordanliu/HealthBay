import { Text, View, StyleSheet, TextInput, Button, Alert } from 'react-native';
import { useState } from 'react';
export const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = () => {
        if (username && password) {
            Alert.alert('Login Successful', `Welcome, ${username}!`);
        } else {
            Alert.alert('Error', 'Please enter both username and password');
        }
    };

    const handleSignIn = () => {
        Alert.alert('Sign In', 'Sign in button pressed');
    };

    return (
        <View style={styles.container}>
            {/* Welcome Screen */}
            <Text style={styles.welcome}>Welcome to HealthBay</Text>

            {/* Login Instruction */}
            <Text style={styles.instruction}>
                Please login with your username and password!
            </Text>

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

            {/* Horizontal button row */}
            <View style={styles.buttonRow}>
                <View style={styles.buttonWrapper}>
                    <Button title="Log In" onPress={handleLogin} />
                </View>
                <View style={styles.buttonWrapper}>
                    <Button title="Sign In" onPress={handleSignIn} color="#0b84ff" />
                </View>
            </View>
        </View>
    )
};

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
        fontSize: 14, // smaller font
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
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    buttonWrapper: {
        flex: 1,
        marginHorizontal: 5,
    },
    instruction: {
        fontSize: 18,
        marginBottom: 20,
        textAlign: 'center',
        color: '#333',
    },

});
