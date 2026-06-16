import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Multiple color options to accommodate different application themes
const THEMES = {
  dracula: {
    connected: '#50fa7b', // Bright neon green
    disconnected: '#ff5555', // High-alert pinkish red
  },
  cyberpunk: {
    connected: '#8be9fd', // Ice blue
    disconnected: '#f1fa8c', // Warning yellow
  },
  monochrome: {
    connected: '#ffffff', // Clean white
    disconnected: '#444444', // Dead gray
  },
  classic: {
    connected: '#1D9E75', // Standard success green
    disconnected: '#E24B4A', // Standard error red
  }
};

export default function ConnectedIcon({ 
  connected = true, 
  theme = 'dracula', 
  size = 14, 
  style 
}) {
  const activeColor = THEMES[theme] 
    ? THEMES[theme][connected ? 'connected' : 'disconnected']
    : THEMES.dracula[connected ? 'connected' : 'disconnected']; // Fallback

  return (
    <View style={style}>
      <Ionicons 
        // Signal-based icon portraying live biometric/network status
        name={connected ? 'pulse' : 'pulse-outline'} 
        size={size} 
        color={activeColor} 
      />
    </View>
  );
}
