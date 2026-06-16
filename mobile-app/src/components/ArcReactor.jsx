import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

export default function ArcReactor({ size = 24, connected = true }) {
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const color = connected ? '#8be9fd' : '#E24B4A'; // Cyberpunk Ice Blue / Failed Red

  useEffect(() => {
    if (connected) {
      Animated.loop(
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        })
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true })
        ])
      ).start();
    } else {
      rotationAnim.stopAnimation();
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [connected]);

  const rotateOuter = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const rotateInner = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'] // Opposite direction
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Outer Ring */}
      <Animated.View style={[styles.outerRing, { 
        borderColor: color,
        transform: [{ rotate: rotateOuter }] 
      }]} />
      
      {/* Inner Ring */}
      <Animated.View style={[styles.innerRing, { 
        borderColor: color,
        transform: [{ rotate: rotateInner }] 
      }]} />

      {/* Core */}
      <Animated.View style={[styles.core, { 
        backgroundColor: color,
        transform: [{ scale: pulseAnim }],
        shadowColor: color,
        elevation: connected ? 8 : 0,
        shadowOpacity: connected ? 1 : 0
      }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  outerRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    opacity: 0.8
  },
  innerRing: {
    position: 'absolute',
    width: '70%',
    height: '70%',
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dotted',
    opacity: 0.6
  },
  core: {
    position: 'absolute',
    width: '35%',
    height: '35%',
    borderRadius: 999,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
  }
});
