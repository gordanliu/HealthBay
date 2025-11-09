import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';
import MainTabs from './MainTabs';
import AuthStack from './AuthStack';
import ChatScreen from '../screens/ChatScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user} = useContext(AuthContext);
  return user ? (
    <Stack.Navigator>
      <Stack.Screen name="MainTabs" options={{ headerShown: false }}>
        {(props) => <MainTabs {...props} setUser={setUser} />}
      </Stack.Screen>

      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
    <MainTabs />
  ) : (
    <AuthStack />
  );
}
