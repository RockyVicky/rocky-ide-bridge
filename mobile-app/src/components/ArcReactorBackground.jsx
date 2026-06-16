import React from 'react';
import { View, StyleSheet } from 'react-native';
import ArcReactor from './ArcReactor';

export default function ArcReactorBackground() {
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 0, backgroundColor: '#050510' }]} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', opacity: 0.15 }]}>
        <ArcReactor size={320} connected={true} />
      </View>
    </View>
  );
}
