import MainTabs from './MainTabs';
import AuthStack from './AuthStack';

export default function AppNavigator({ user, setUser }) {
  return user ? (
    <MainTabs setUser={setUser} />
  ) : (
    <AuthStack setUser={setUser} />
  );
}
