import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import ChatScreen from '../screens/ChatScreen';
import ChatViewScreen from '../screens/ChatViewScreen';

const Stack = createNativeStackNavigator();

export default function ChatStack({ setUser }) {
  return (
    <Stack.Navigator>
      <Stack.Screen name="HomeMain" options={{ headerShown: false }}>
        {(props) => <HomeScreen {...props} setUser={setUser} />}
      </Stack.Screen>
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: 'New Consultation' }}
      />
      <Stack.Screen
        name="ChatView"
        component={ChatViewScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
