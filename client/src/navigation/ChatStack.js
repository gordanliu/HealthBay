import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import SymptomIntakeScreen from '../screens/SymptomIntakeScreen';
import ChatScreen from '../screens/ChatScreen';

const Stack = createNativeStackNavigator();

export default function ChatStack({ setUser }) {
  return (
    <Stack.Navigator>
      <Stack.Screen name="HomeMain" options={{ headerShown: false }}>
        {(props) => <HomeScreen {...props} setUser={setUser} />}
      </Stack.Screen>
      <Stack.Screen
        name="SymptomIntake"
        component={SymptomIntakeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
