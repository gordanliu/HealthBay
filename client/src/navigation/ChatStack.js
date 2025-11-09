import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import ChatScreen from '../screens/ChatScreen';

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
        options={({ route }) => ({ 
          title: route.params?.chatId ? 'Consultation' : 'New Consultation',
          headerShown: true,
        })}
      />
    </Stack.Navigator>
  );
}
