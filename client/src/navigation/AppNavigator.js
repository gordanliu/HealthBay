import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator({ user, setUser }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Home">
          {(props) => <HomeScreen {...props} setUser={setUser} />}
        </Stack.Screen>
      ) : (
        <Stack.Screen name="Login">
          {(props) => <LoginScreen {...props} setUser={setUser} />}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  );
}
