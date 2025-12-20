import { NewAppScreen } from '@react-native/new-app-screen';
import { StatusBar, StyleSheet, useColorScheme, View, ActivityIndicator } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import Navigation from './Navigation';
import AuthNavigator from './AuthNavigator';
import CameraScreen from './ultraWideCamera';
import { useState, useEffect } from 'react';
import { isAuthenticated } from './authService';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [isAuthed, setIsAuthed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  async function checkAuthStatus() {
    try {
      const authed = await isAuthenticated();
      setIsAuthed(authed);
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthed(false);
    } finally {
      setIsLoading(false);
    }
  }

  function handleAuthSuccess() {
    setIsAuthed(true);
  }

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF14A7" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={StyleSheet.absoluteFill}>
          {isAuthed ? (
            <Navigation />
          ) : (
            <AuthNavigator onAuthSuccess={handleAuthSuccess} />
          )}
          {/* <CameraScreen /> */}
        </View>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <NewAppScreen
        templateFileName="App.tsx"
        safeAreaInsets={safeAreaInsets}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});

export default App;
