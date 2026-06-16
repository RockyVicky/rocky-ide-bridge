import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../src/store/useStore';

export default function SetupScreen() {
  const { serverUrl, setServerUrl, setAuthToken } = useStore();
  const [url, setUrl] = useState(serverUrl || '');
  const [password, setPassword] = useState('');
  const [testing, setTesting] = useState(false);

  const isDirectHostTarget = (value) => {
    const host = value.split('/')[0].split('?')[0];
    return /^(localhost|0\.0\.0\.0|127(?:\.\d{1,3}){3}|(?:\d{1,3}\.){3}\d{1,3})(:\d+)?$/i.test(host);
  };

  const validateUrl = (input) => {
    let finalUrl = input.trim().replace(/\s+/g, '');
    if (finalUrl && !finalUrl.startsWith('http')) {
      if (isDirectHostTarget(finalUrl)) {
        finalUrl = 'http://' + finalUrl;
      } else {
        finalUrl = 'https://' + finalUrl;
      }
    }

    return finalUrl;
  };

  const testConnection = async () => {
    const finalUrl = validateUrl(url);
    if (finalUrl.length < 10) return;

    setTesting(true);
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${finalUrl}/api/status`, {
        signal: controller.signal,
        headers: { 
          'Bypass-Tunnel-Reminder': 'true',
          'ngrok-skip-browser-warning': 'true'
        }
      });
      clearTimeout(id);

      if (response.ok) {
        Alert.alert('Success', 'Backend is reachable!');
      } else {
        Alert.alert('Error', `Server status: ${response.status}`);
      }
    } catch (err) {
      Alert.alert('Connection Failed', 'Could not reach server.');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const finalUrl = validateUrl(url);
    if (finalUrl.length < 10) return;
    if (!password) {
      Alert.alert('Security', 'Please enter your Rocky password.');
      return;
    }
    
    setTesting(true);
    try {
      // 1. Get JWT Token
      const response = await fetch(`${finalUrl}/api/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Bypass-Tunnel-Reminder': 'true',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ password })
      });
      
      const data = await response.json();
      
      if (response.ok && data.token) {
        await Promise.all([
          AsyncStorage.setItem('serverUrl', finalUrl),
          AsyncStorage.setItem('authToken', data.token)
        ]);
        
        setServerUrl(finalUrl);
        setAuthToken(data.token);
        Alert.alert('Secure Connection', 'Logged in successfully!');
        router.replace('/');
      } else {
        Alert.alert('Login Failed', data.error || 'Invalid password');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to authenticate with server.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Secure Login</Text>
      
      <View style={styles.guideContainer}>
        <Text style={styles.guideTitle}>Internal Testing Mode</Text>
        <Text style={styles.guideText}>• Your URL and Password will be encrypted with JWT.</Text>
      </View>
      
      <TextInput
        style={styles.input}
        placeholder="Enter IP or Tunnel URL"
        placeholderTextColor="#666"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        keyboardType="url"
      />

      <TextInput
        style={styles.input}
        placeholder="Enter Rocky Password"
        placeholderTextColor="#666"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
      />
      
      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={styles.testButton} 
          onPress={testConnection}
          disabled={testing}
        >
          {testing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Ping</Text>}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.saveButton, (!url.trim() || !password) && styles.buttonDisabled]} 
          onPress={handleSave}
          disabled={!url.trim() || !password || testing}
        >
          <Text style={styles.buttonText}>Login & Connect</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: -1,
  },
  guideContainer: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#534AB7',
  },
  guideTitle: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 8,
    fontSize: 16,
  },
  guideText: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  bold: {
    color: '#fff',
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 18,
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  testButton: {
    flex: 1,
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    flex: 2,
    backgroundColor: '#534AB7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
