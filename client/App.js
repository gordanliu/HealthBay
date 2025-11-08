import React, { useState } from 'react';

import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const [user, setUser] = useState(null); // null = not logged in

  return (
    <NavigationContainer>
      <AppNavigator user={user} setUser={setUser} />
    </NavigationContainer>
  );
}
