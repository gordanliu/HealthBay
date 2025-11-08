import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';

const Stack = createNativeStackNavigator();

export default function AuthStack({ setUser }) {
  return (
    <Stack.Navigator>
      {/* Login Screen — pass setUser manually */}
      <Stack.Screen name="Login" options={{ headerShown: false }}>
        {(props) => <LoginScreen {...props} setUser={setUser} />}
      </Stack.Screen>

      {/* Sign Up Screen — also needs setUser */}
      <Stack.Screen name="SignUp" options={{ title: 'Create Account' }}>
        {(props) => <SignUpScreen {...props} setUser={setUser} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
