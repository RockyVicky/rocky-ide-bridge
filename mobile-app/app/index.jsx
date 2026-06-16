import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, RefreshControl, ScrollView, Alert, KeyboardAvoidingView, Platform, Animated, Easing
} from 'react-native'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import { useAudioRecorder, RecordingPresets, AudioModule } from 'expo-audio'
import { useStore } from '../src/store/useStore'
import { useJarvisConnection } from '../src/hooks/useJarvisConnection'
import ArcReactor from '../src/components/ArcReactor';
import ConnectedIcon from '../src/components/ConnectedIcon';
import ArcReactorBackground from '../src/components/ArcReactorBackground';
import ArchitectureChart from '../src/components/ArchitectureChart';
import DynamicBackground from '../src/components/DynamicBackground';


const STATUS_COLOR = {
  pending: '#6272a4', planning: '#bd93f9', running: '#8be9fd',
  fixing: '#ffb86c', done: '#8be9fd', completed: '#8be9fd',
  partial: '#ffb86c', failed: '#ff5555',
}

const GoalCard = ({ item }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    let interval;
    if (item.status === 'planning' || item.status === 'running') {
      let durationMs = 0;
      if (item.estimated_time) {
        const match = item.estimated_time.match(/(\d+)/);
        if (match) {
          const val = parseInt(match[1], 10);
          if (item.estimated_time.includes('sec')) durationMs = val * 1000;
          else if (item.estimated_time.includes('min')) durationMs = val * 60 * 1000;
          else if (item.estimated_time.includes('hour')) durationMs = val * 3600 * 1000;
        }
      }

      if (durationMs > 0 && item.created_at) {
        // Parse raw SQLite UTC string to local Date exactly
        const start = new Date(item.created_at.replace(' ', 'T') + 'Z').getTime();
        const target = start + durationMs;

        interval = setInterval(() => {
          const rem = target - Date.now();
          if (rem <= 0) {
            setTimeLeft('00:00');
            clearInterval(interval);
          } else {
            const m = Math.floor(rem / 60000);
            const s = Math.floor((rem % 60000) / 1000);
            setTimeLeft(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
          }
        }, 1000);
      }
    } else {
      setTimeLeft('');
    }
    return () => { if (interval) clearInterval(interval); }
  }, [item.status, item.estimated_time, item.created_at]);

  const rawDate = new Date((item.created_at || '').replace(' ', 'T') + 'Z');

  return (
    <TouchableOpacity style={styles.goalCard} onPress={() => router.push(`/goal/${item.id}`)} activeOpacity={0.7}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text style={styles.goalTitle} numberOfLines={2}>{item.title}</Text>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={[styles.badge, { borderColor: STATUS_COLOR[item.status] + '66', backgroundColor: STATUS_COLOR[item.status] + '18' }]}>
            <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] }]}>{item.status}</Text>
          </View>
          {timeLeft ? (
             <Text style={{color: '#E24B4A', fontSize: 11, marginTop: 4, fontWeight: '700'}}>ETA {timeLeft}</Text>
          ) : (item.estimated_time && item.estimated_time !== 'Unknown' && (
             <Text style={{color: '#888', fontSize: 10, marginTop: 4, fontWeight: '600'}}>ETA {item.estimated_time}</Text>
          ))}
        </View>
      </View>
      
      {item.description ? <Text style={styles.goalDesc} numberOfLines={1}>{item.description}</Text> : null}

      {item.status !== 'pending' && (
        <View style={{ height: 4, backgroundColor: '#222', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
           <View style={{ height: '100%', width: `${item.progress || 0}%`, backgroundColor: STATUS_COLOR[item.status] || '#7F77DD' }} />
        </View>
      )}
      
      <Text style={[styles.goalDate, { marginTop: 8 }]}>
        {rawDate.toLocaleDateString()} {rawDate.toLocaleTimeString()}{item.progress !== undefined ? ` | ${item.progress}%` : ''}
      </Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { connected, goals, setGoals, activity, systemLogs, clearUnread, unreadCount, serverUrl, setServerUrl, intelFeed, unreadIntelCount, clearUnreadIntel, removeIntel, socketInstance, authToken } = useStore()

  const [goalText, setGoalText] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState('goals') // 'goals' | 'task'
  const [showInput, setShowInput] = useState(false)
  const [imageUri, setImageUri] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const [isRecording, setIsRecording] = useState(false)

  const startRecording = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (perm.status === 'granted') {
        await AudioModule.setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
        setIsRecording(true);
      }
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }

  const stopRecording = async () => {
    if (!isRecording) return;
    try {
      setIsRecording(false);
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) throw new Error("Recording failed: Audio URI is empty.");
      
      setSubmitting(true);
      const formData = new FormData();
      formData.append('audioFile', {
        uri: uri.startsWith('file://') ? uri : 'file://' + uri,
        type: 'audio/m4a',
        name: 'audio.m4a',
      });

      const response = await fetch(`${serverUrl}/api/transcribe`, {
        method: 'POST',
        headers: {
          'Bypass-Tunnel-Reminder': 'true',
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData
      });
      
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const resData = await response.json();
      if (resData.success && resData.text) {
        setGoalText(prev => prev ? `${prev} ${resData.text.trim()}` : resData.text.trim());
      }
    } catch (err) {
      console.error('Failed to stop/transcribe', err);
      Alert.alert("Transcription failed", err.message);
    } finally {
      setSubmitting(false);
    }
  }



  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.5,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
    }
  };

  // Server settings and connection are now managed globally by the Root Layout
  useEffect(() => {
    if (serverUrl) loadGoals(serverUrl);
  }, [serverUrl]);

  useEffect(() => {
    if (tab === 'task') clearUnread()
  }, [tab])

  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const loadGoals = async (url = serverUrl) => {
    if (!url || !authToken) return
    try {
      const r = await axios.get(`${url}/api/goals`, {
        headers: { 
          'Bypass-Tunnel-Reminder': 'true',
          'Authorization': `Bearer ${authToken}`
        }
      })
      setGoals(r.data.goals || [])
    } catch (e) {
      console.log('Load goals error:', e.message)
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadGoals()
    setRefreshing(false)
  }, [serverUrl, authToken])

  const submitGoal = async () => {
    if (!goalText.trim()) return
    setSubmitting(true)
    try {
      const r = await axios.post(`${serverUrl}/api/goals`, {
        title: goalText.trim(),
        description: description.trim(),
        imageBase64: imageBase64
      }, {
        headers: { 
          'Bypass-Tunnel-Reminder': 'true',
          'Authorization': `Bearer ${authToken}`
        }
      })
      setGoalText('')
      setDescription('')
      setImageUri(null)
      setImageBase64(null)
      setShowInput(false)
      await loadGoals()
    } catch (e) {
      Alert.alert('Error', e.message)
    }
    setSubmitting(false)
  }

  const renderActivity = ({ item }) => {
    const rawDate = new Date(item.ts);
    return (
      <View style={[styles.actItem, { borderLeftColor: STATUS_COLOR[item.status] || '#333' }]}>
        <Text style={[styles.actMessage, { color: STATUS_COLOR[item.status] || '#aaa' }]}>{item.message}</Text>
        {item.progress !== undefined && (
          <View style={{ height: 3, backgroundColor: '#333', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${item.progress}%`, backgroundColor: STATUS_COLOR[item.status] || '#7F77DD' }} />
          </View>
        )}
        <Text style={[styles.actTime, { marginTop: item.progress !== undefined ? 6 : 0 }]}>{rawDate.toLocaleTimeString()}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      
      <ArcReactorBackground />
      <DynamicBackground />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5, 5, 10, 0.65)' }]} pointerEvents="none" />


      {/* ── Header ─────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ArcReactor size={22} connected={connected} />
          <Text style={styles.headerTitle}>Rocky</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 6, marginTop: 3 }}>
            <ConnectedIcon 
              connected={connected} 
              theme="cyberpunk" 
              size={14} 
              style={{ marginRight: 4 }} 
            />
            <Text style={[styles.headerSub, { marginLeft: 0 }]}>{connected ? 'connected' : 'offline'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/setup')} style={styles.settingsBtn}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="settings" size={20} color="#666" />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* ── Tabs ───────────────────────────────────── */}
      <View style={styles.tabs}>
        {['goals', 'task', 'intel', 'system'].map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => {
              setTab(t);
              if (t === 'task') clearUnread();
              if (t === 'intel') clearUnreadIntel();
            }}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive, { fontSize: 13 }]}>
              {t === 'goals' ? 'Goals' : t === 'task' ? 'Task' : t === 'intel' ? 'Intel' : 'System'}
              {t === 'task' && unreadCount > 0 && ` (${unreadCount})`}
              {t === 'intel' && unreadIntelCount > 0 && ` (${unreadIntelCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>


      {/* ── Content ────────────────────────────────── */}
      {tab === 'goals' ? (
        <FlatList
          data={goals}
          keyExtractor={(g) => g.id}
          renderItem={({item}) => <GoalCard item={item} />}
          contentContainerStyle={{ padding: 14 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8be9fd" />}
          ListEmptyComponent={
            <Text style={{ color: '#444', textAlign: 'center', marginTop: 40, fontSize: 14 }}>
              No goals yet. Tap + to give Rocky something to build.
            </Text>
          }
        />
      ) : tab === 'task' ? (
        <FlatList
          data={activity}
          keyExtractor={(a) => String(a.id)}
          renderItem={renderActivity}
          contentContainerStyle={{ padding: 14 }}
          ListEmptyComponent={
            <Text style={{ color: '#aaa', textAlign: 'center', marginTop: 40, fontSize: 14 }}>
              Tasks will appear here as Rocky works.
            </Text>
          }
        />
      ) : tab === 'intel' ? (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {intelFeed.length === 0 ? (
            <Text style={{ color: '#6272a4', textAlign: 'center', marginTop: 40, fontSize: 13, textTransform: 'uppercase', letterSpacing: 2 }}>
               No Active Intel Streams.
            </Text>
          ) : (
            intelFeed.map((intel) => {
               const rawDate = new Date(intel.ts);
               return (
                 <View key={intel.id} style={[styles.goalCard, { backgroundColor: 'rgba(5, 5, 10, 0.95)' }]}>
                    <Text style={{ color: '#8be9fd', fontSize: 10, fontWeight: 'bold', marginBottom: 8, letterSpacing: 1 }}>{rawDate.toLocaleTimeString()} / DATALINK</Text>
                    
                    <Text selectable={true} style={{ color: '#f8f8f2', fontSize: 14, lineHeight: 22, marginBottom: 16 }}>
                       {intel.raw}
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 'auto', paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(139, 233, 253, 0.15)' }}>
                       {intel.source === 'META-ARCHITECT' ? (
                         <>
                           <TouchableOpacity 
                             onPress={async () => {
                               try {
                                 await axios.post(`${serverUrl}/api/goals`, {
                                   title: 'Implement Meta-Architect Blueprint',
                                   description: intel.raw
                                 }, { 
                                   headers: { 
                                     'Bypass-Tunnel-Reminder': 'true',
                                     'Authorization': `Bearer ${authToken}`
                                   } 
                                 });
                                 Alert.alert('Approved', 'Goal sent to Rocky backend!');
                                 removeIntel(intel.id);
                                 loadGoals();
                                 setTab('goals');
                               } catch (err) {}
                             }} 
                             style={{ flex: 2, backgroundColor: 'rgba(80, 250, 123, 0.15)', padding: 8, borderRadius: 6, alignItems: 'center', borderColor: '#50fa7b', borderWidth: 1 }}>
                             <Text style={{ color: '#50fa7b', fontSize: 11, fontWeight: '800' }}>APPROVE & BUILD</Text>
                           </TouchableOpacity>
                           <TouchableOpacity 
                             onPress={() => removeIntel(intel.id)} 
                             style={{ flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: 8, borderRadius: 6, alignItems: 'center' }}>
                             <Text style={{ color: '#aaa', fontSize: 11, fontWeight: '700' }}>DISMISS</Text>
                           </TouchableOpacity>
                         </>
                       ) : (
                         <>
                           <TouchableOpacity 
                             onPress={() => {
                               socketInstance?.emit('mobile_trigger_macro', { prompt: "The UI layout is visually incorrect. Fix the styling." });
                               removeIntel(intel.id);
                             }} 
                             style={{ flex: 1, backgroundColor: 'rgba(139, 233, 253, 0.1)', padding: 8, borderRadius: 6, alignItems: 'center' }}>
                             <Text style={{ color: '#8be9fd', fontSize: 11, fontWeight: '700' }}>REDO LAYOUT</Text>
                           </TouchableOpacity>
                           
                           <TouchableOpacity 
                             onPress={() => {
                               socketInstance?.emit('mobile_trigger_macro', { prompt: "The code is functionally broken. Fix the logic." });
                               removeIntel(intel.id);
                             }} 
                             style={{ flex: 1, backgroundColor: 'rgba(255, 85, 85, 0.1)', padding: 8, borderRadius: 6, alignItems: 'center' }}>
                             <Text style={{ color: '#ff5555', fontSize: 11, fontWeight: '700' }}>FIX LOGIC</Text>
                           </TouchableOpacity>
                           
                           <TouchableOpacity 
                             onPress={() => removeIntel(intel.id)} 
                             style={{ flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: 8, borderRadius: 6, alignItems: 'center' }}>
                             <Text style={{ color: '#aaa', fontSize: 11, fontWeight: '700' }}>DISMISS</Text>
                           </TouchableOpacity>
                         </>
                       )}
                    </View>

                 </View>
               );
            })
          )}
        </ScrollView>
      ) : tab === 'system' ? (
        <FlatList
          data={systemLogs}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 4, paddingHorizontal: 14 }}>
               <Text style={{ color: item.level === 'error' ? '#ff5555' : '#50fa7b', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                 [{new Date(item.ts).toLocaleTimeString()}] {item.message}
               </Text>
            </View>
          )}
          inverted
          contentContainerStyle={{ paddingVertical: 10 }}
          ListEmptyComponent={<Text style={{ color: '#444', textAlign: 'center', marginTop: 40 }}>Initializing system link...</Text>}
        />


      ) : (
        <View />
      )}


      {/* ── New Goal Input ──────────────────────────── */}
      {showInput && (
        <View style={styles.inputPanel}>
          <TextInput
            value={goalText}
            onChangeText={setGoalText}
            placeholder="What should Rocky build?"
            placeholderTextColor="#444"
            style={styles.input}
            autoFocus
            multiline
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Extra details (optional)"
            placeholderTextColor="#444"
            style={[styles.input, { marginTop: 8, fontSize: 13 }]}
            multiline
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 }}>
            <TouchableOpacity onPress={pickImage} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, borderWidth: 1, borderColor: '#222538' }}>
               <Ionicons name="image-outline" size={24} color={imageUri ? "#8be9fd" : "#666"} />
            </TouchableOpacity>
            <TouchableOpacity 
               onPressIn={startRecording} 
               onPressOut={stopRecording} 
               style={{ padding: 8, backgroundColor: isRecording ? 'rgba(255,85,85,0.1)' : 'rgba(255,255,255,0.05)', borderRadius: 8, borderWidth: 1, borderColor: isRecording ? '#ff5555' : '#222538' }}>
               <Ionicons name="mic-outline" size={24} color={isRecording ? "#ff5555" : "#666"} />
            </TouchableOpacity>
            {isRecording && <Text style={{ color: '#ff5555', fontSize: 12, flex: 1 }}>Recording... release to finish</Text>}
            {!isRecording && imageUri && <Text style={{ color: '#8be9fd', fontSize: 12, flex: 1 }} numberOfLines={1}>Image attached</Text>}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity onPress={() => setShowInput(false)} style={styles.cancelBtn}>
              <Text style={{ color: '#666', fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submitGoal}
              disabled={submitting || !goalText.trim()}
              style={[styles.submitBtn, { opacity: submitting || !goalText.trim() ? 0.5 : 1 }]}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                {submitting ? 'Sending...' : 'Run Goal'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── FAB ─────────────────────────────────────── */}
      {!showInput && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowInput(true)}>
          <Text style={{ color: '#fff', fontSize: 26, lineHeight: 30 }}>+</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090a0f' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(139, 233, 253, 0.2)', backgroundColor: 'rgba(5, 10, 5, 0.85)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#8be9fd', letterSpacing: 3, textTransform: 'uppercase', textShadowColor: '#8be9fd', textShadowRadius: 8 },
  headerSub: { fontSize: 12, color: '#6272a4', marginTop: 2 },
  settingsBtn: { padding: 8 },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(5, 10, 5, 0.75)', borderBottomWidth: 1, borderBottomColor: 'rgba(139, 233, 253, 0.2)' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#8be9fd' },
  tabText: { color: '#6272a4', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  tabTextActive: { color: '#8be9fd', textShadowColor: '#8be9fd', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 },
  goalCard: {
    backgroundColor: 'rgba(10, 20, 10, 0.85)', borderRadius: 10, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(139, 233, 253, 0.3)',
  },
  goalTitle: { color: '#f8f8f2', fontSize: 15, fontWeight: '600', flex: 1, marginRight: 10 },
  goalDesc: { color: '#bfbfca', fontSize: 12, marginTop: 4 },
  goalDate: { color: '#6272a4', fontSize: 11, marginTop: 6 },
  badge: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  actItem: {
    paddingVertical: 12, paddingHorizontal: 12, borderLeftWidth: 3,
    borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(80, 250, 123, 0.2)',
    marginBottom: 10, backgroundColor: 'rgba(10, 20, 10, 0.85)', borderRadius: 6,
  },
  actMessage: { fontSize: 13, marginBottom: 2, color: '#f8f8f2' },
  actTime: { fontSize: 10, color: '#6272a4' },
  inputPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#131422', padding: 16, borderTopWidth: 1, borderTopColor: '#222538',
  },
  input: {
    backgroundColor: '#0d0f17', borderWidth: 1, borderColor: '#222538',
    borderRadius: 8, padding: 12, color: '#f8f8f2', fontSize: 15,
  },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#222538', borderRadius: 8 },
  submitBtn: { flex: 2, padding: 12, alignItems: 'center', backgroundColor: '#bd93f9', borderRadius: 8 },
  fab: {
    position: 'absolute', bottom: 28, right: 20, width: 56, height: 56,
    borderRadius: 28, backgroundColor: '#bd93f9', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#bd93f9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
})
