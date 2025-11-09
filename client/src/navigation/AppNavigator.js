import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';
import MainTabs from './MainTabs';
import AuthStack from './AuthStack';

export default function AppNavigator() {
  const { user} = useContext(AuthContext);
  return user ? (
    <MainTabs />
  ) : (
    <AuthStack />
  );
}
