import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Calculate optimal column density perfectly mapping physical screen width
const COLUMN_WIDTH = 18;
const COLUMN_COUNT = Math.floor(width / COLUMN_WIDTH);

// Function to generate a massive, random static string of binary code to prevent JS thread rendering bottlenecks
const generateBinaryStream = () => {
  let stream = "";
  const lines = Math.floor(height / 14) * 2; // Generate enough to cover 2x screen height
  for (let i = 0; i < lines; i++) {
    stream += (Math.random() > 0.5 ? '1' : '0') + '\n';
  }
  return stream;
};

const MatrixColumn = ({ xOffset }) => {
  const translateY = useRef(new Animated.Value(-height * 1.5)).current;
  const [stream, setStream] = useState(generateBinaryStream());
  const opacity = useRef(Math.random() * 0.7 + 0.3).current; // Random baseline brightness per stream

  useEffect(() => {
    // Randomized terminal velocity per stream (between 3s and 8s)
    const speed = Math.random() * 5000 + 3000;

    const drop = () => {
      translateY.setValue(-height * 1.5);
      
      // Native Driver moves the entire massive text element on the GPU avoiding bridge latency
      Animated.timing(translateY, {
        toValue: height,
        duration: speed,
        useNativeDriver: true
      }).start(({ finished }) => {
        if (finished) {
          setStream(generateBinaryStream()); // Randomize code upon resetting track
          drop();
        }
      });
    };

    // Stagger column startup drops
    const startDelay = setTimeout(drop, Math.random() * 4000);
    return () => clearTimeout(startDelay);
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute',
      top: 0,
      left: xOffset,
      transform: [{ translateY }],
      opacity
    }}>
      <Text style={styles.matrixCode}>{stream}</Text>
    </Animated.View>
  );
};

export default function MatrixBackground() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="none">
      {/* Dim ambient glow layer */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#051005', opacity: 0.95 }]} />
      
      {Array.from({ length: COLUMN_COUNT }).map((_, i) => (
        <MatrixColumn key={`col-${i}`} xOffset={i * COLUMN_WIDTH} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
    overflow: 'hidden',
    zIndex: 0
  },
  matrixCode: {
    color: '#50fa7b', // Hacker / Dracula Neon Green
    fontSize: 16,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 18,
    textShadowColor: '#50fa7b', // Sub-pixel organic glow
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
    letterSpacing: 2
  }
});
