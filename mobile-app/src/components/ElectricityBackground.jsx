import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');
const ARC_COUNT = 35; // WWE Level: Massive concurrent electric wires

function ElectricArc({ delay }) {
  const translateX = useRef(new Animated.Value(-width)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  
  const baseTop = useRef(Math.random() * height).current;
  const thickness = useRef(Math.random() * 4 + 1).current; // WWE Level: Thick sparks
  const arcWidth = useRef(width * (Math.random() * 1.5 + 0.5)).current; // WWE Level: Massive stretched lines

  useEffect(() => {
    let timeout;
    const zap = () => {
      translateX.setValue(-width * 1.5);
      translateY.setValue(0);
      opacity.setValue(0);

      const speed = Math.random() * 300 + 100; // Hyper-aggressive speeds (100ms - 400ms!)

      Animated.parallel([
        Animated.timing(translateX, {
          toValue: width * 1.5,
          duration: speed,
          useNativeDriver: true
        }),
        // Add violent vertical jittering to simulate raw uncontrollable voltage
        Animated.sequence([
          Animated.timing(translateY, { toValue: Math.random() * 60 - 30, duration: speed * 0.25, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: Math.random() * 60 - 30, duration: speed * 0.25, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: Math.random() * 60 - 30, duration: speed * 0.25, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 0, duration: speed * 0.25, useNativeDriver: true })
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: Math.random() * 0.5 + 0.5, duration: speed * 0.2, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: speed * 0.2, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: speed * 0.6, useNativeDriver: true })
        ])
      ]).start(() => {
        timeout = setTimeout(zap, Math.random() * 600 + 100); // Barely any rest between strikes
      });
    };

    timeout = setTimeout(zap, delay);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <Animated.View style={[
      styles.arc,
      {
        top: baseTop,
        height: thickness,
        width: arcWidth,
        transform: [{ translateX }, { translateY }],
        opacity,
      }
    ]} />
  );
}

export default function ElectricityBackground() {
  const flashAnim = useRef(new Animated.Value(0)).current;

  // WWE style aggressive ambient background strobing
  useEffect(() => {
    const strobe = () => {
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 0.15, duration: 50, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0.25, duration: 50, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0, duration: 150, useNativeDriver: true })
      ]).start(() => {
         setTimeout(strobe, Math.random() * 1500 + 500);
      });
    }
    strobe();
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 0, overflow: 'hidden', backgroundColor: '#050510' }]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#8be9fd', opacity: flashAnim }]} />
      {Array.from({ length: ARC_COUNT }).map((_, i) => (
        <ElectricArc key={i} delay={Math.random() * 1000} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  arc: {
    position: 'absolute',
    backgroundColor: '#8be9fd',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 10
  }
});
