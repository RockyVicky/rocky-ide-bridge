import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

// Custom GUI Node for the Flowchart Engine
const Node = ({ title, sub, color }) => (
    <View style={[styles.node, { borderColor: color, shadowColor: color }]}>
        <Text style={[styles.title, { color }]}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
    </View>
);

const Line = ({ height = 25 }) => (
    <View style={[styles.vLine, { height }]} />
);

export default function ArchitectureChart() {
    return (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            
            <Text style={styles.headerText}>ECOSYSTEM MATRIX</Text>

            {/* Core User Input */}
            <Node title="📱 React Native App" sub="1. Tony Stark GUI" color="#bd93f9" />
            <Line />
            <Node title="💻 Node.js Local Hub" sub="2. Socket.IO Router" color="#6272a4" />
            <Line height={15} />

            {/* Horizontal Split Branch */}
            <View style={styles.hBridge} />

            <View style={styles.row}>
                {/* Offline Processing Branch */}
                <View style={styles.col}>
                    <Line height={15} />
                    <Node title="🧠 Local Qwen 7B" sub="3. Structure Translator" color="#50fa7b" />
                    <Line />
                    <Node title="📝 SQLite DB" sub="4. Storage Tracker" color="#f1fa8c" />
                </View>

                {/* Cloud Execution Branch */}
                <View style={styles.col}>
                    <Line height={15} />
                    <Node title="⚡ Windows Macro" sub="5. C# Window Spoofer" color="#ff5555" />
                    <Line />
                    <Node title="👽 Antigravity" sub="6. Cloud AI Coder" color="#ffb86c" />
                    <Line />
                    <Node title="🔒 OS Lockfile" sub="7. Zero-Click Bridge" color="#8be9fd" />
                </View>
            </View>

            {/* Rejoin to Source */}
            <View style={styles.hBridge} />
            <Line height={15} />
            <Node title="🔔 Native Android/iOS" sub="8. Push Notification" color="#bd93f9" />

            <View style={{ height: 60 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 10 },
    headerText: { color: '#50fa7b', fontFamily: 'monospace', fontSize: 16, marginBottom: 20, letterSpacing: 2 },
    node: {
        backgroundColor: 'rgba(10, 20, 10, 0.85)',
        borderWidth: 1.5,
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        width: 150,
        elevation: 8,
        shadowOpacity: 0.8,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 }
    },
    title: { fontWeight: '800', fontSize: 13, textAlign: 'center', marginBottom: 4 },
    sub: { fontSize: 10, color: '#A0B0A0', textAlign: 'center', fontWeight: '500' },
    vLine: { width: 2, backgroundColor: 'rgba(80, 250, 123, 0.4)' },
    hBridge: { width: 170, height: 2, backgroundColor: 'rgba(80, 250, 123, 0.4)' },
    row: { flexDirection: 'row', width: '100%', justifyContent: 'center' },
    col: { alignItems: 'center', width: 170 }
});
