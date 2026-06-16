import { useEffect } from 'react';
import { AppState, View, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useStore } from '../src/store/useStore';

import { useJarvisConnection } from '../src/hooks/useJarvisConnection';

export default function Layout() {
  const { serverUrl, setServerUrl, socketInstance, isInternalTesting, setAuthToken } = useStore();
  const router = useRouter();
  
  // Set global axios defaults for Ngrok and Tunnel stability
  axios.defaults.headers.common['Bypass-Tunnel-Reminder'] = 'true';
  axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';


  // Persistent Connection Management
  useJarvisConnection(serverUrl);

  useEffect(() => {
    // 1. Initial Load: Get the stable server URL and Token
    Promise.all([
      AsyncStorage.getItem('serverUrl'),
      AsyncStorage.getItem('authToken')
    ]).then(([url, token]) => {
      const finalUrl = url || serverUrl;
      setServerUrl(finalUrl);

      
      if (token) {
        setAuthToken(token);
      } else {
        // Only go to setup if we need a password/token
        router.replace('/setup');
      }
    });

    // 2. Lifecycle Watcher: Re-validate socket when returning from background
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && socketInstance) {
        if (!socketInstance.connected) {
          console.log('[LIFECYCLE] App active, reconnecting socket...');
          socketInstance.connect();
        }
      }
    });

    return () => subscription.remove();
  }, [serverUrl, socketInstance]);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#090a0f' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="goal/[id]" />
        <Stack.Screen name="setup" options={{ presentation: 'modal' }} />
      </Stack>

      {isInternalTesting && (
        <View style={{ position: 'absolute', top: 40, right: -40, backgroundColor: '#ff4444', padding: 5, paddingHorizontal: 40, transform: [{ rotate: '45deg' }], zIndex: 9999 }} pointerEvents="none">
          <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>TESTING</Text>
        </View>
      )}
    </>
  );
}
