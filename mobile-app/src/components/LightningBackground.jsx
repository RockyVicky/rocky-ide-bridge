import React, { useState, useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function LightningBackground() {
  const flashAnim = useRef(new Animated.Value(0)).current;
  const [bolt, setBolt] = useState(null);

  useEffect(() => {
    let timeout;
    
    // Recursive function to generate physical, randomized lightning bolts
    const strike = () => {
      // Generate randomized visual vectors
      const randomX = Math.random() * width - 50; 
      const randomY = Math.random() * (height / 2) - 100; // Keep strikes to the upper sky
      const randomScale = Math.random() * 3 + 1; // Scale between 1x and 4x
      const randomRotation = (Math.random() * 60 - 30) + 'deg'; // Tilt -30deg to 30deg

      setBolt({
        x: randomX,
        y: randomY,
        scale: randomScale,
        rotation: randomRotation
      });

      // Rapid strobe animation for opacity
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 40, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0.1, duration: 60, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0.8, duration: 40, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 400, useNativeDriver: true })
      ]).start(() => setBolt(null));

      // Schedule next storm hit
      const nextStrike = Math.random() * 6000 + 4000;
      timeout = setTimeout(strike, nextStrike);
    };

    timeout = setTimeout(strike, 2000);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 0, overflow: 'hidden' }]} pointerEvents="none">
      
      {/* Dimmed Ambient Flash */}
      <Animated.View 
        style={[
          StyleSheet.absoluteFill, 
          { 
            backgroundColor: '#ccedff', 
            opacity: flashAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.15] }) 
          }
        ]} 
      />

      {/* Physical Lightning Graphic */}
      {bolt && (
        <Animated.View style={{
          position: 'absolute',
          left: bolt.x,
          top: bolt.y,
          opacity: flashAnim,
          transform: [
            { scale: bolt.scale },
            { rotate: bolt.rotation }
          ],
          shadowColor: '#8be9fd',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 20,
          elevation: 10
        }}>
          <Ionicons name="flash" size={200} color="#e0f7fa" />
        </Animated.View>
      )}

    </View>
  );
}
