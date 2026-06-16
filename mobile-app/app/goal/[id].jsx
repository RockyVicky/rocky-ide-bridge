import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import { useStore } from '../../src/store/useStore';

const STATUS_COLOR = {
  pending: '#6272a4',
  planning: '#bd93f9',
  running: '#8be9fd',
  fixing: '#ffb86c',
  done: '#50fa7b',
  completed: '#50fa7b',
  partial: '#ffb86c',
  failed: '#ff5555',
};

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams();
  const goalId = Array.isArray(id) ? id[0] : id;
  const { serverUrl, activity, authToken } = useStore();
  const [goal, setGoal] = useState(null);
  const [projects, setProjects] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadGoal = useCallback(async (showSpinner = false) => {
    if (!serverUrl || !goalId || !authToken) return;

    if (showSpinner) setLoading(true);
    try {
      const response = await axios.get(`${serverUrl}/api/goals/${goalId}`, {
        headers: { 
          'Bypass-Tunnel-Reminder': 'true',
          'Authorization': `Bearer ${authToken}`
        }
      });
      setGoal(response.data.goal || null);
      setProjects(response.data.projects || []);
      setLogs(response.data.logs || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load goal');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serverUrl, goalId]);

  useEffect(() => {
    loadGoal(true);
  }, [loadGoal]);

  useEffect(() => {
    if (!goal || !['planning', 'running'].includes(goal.status)) return;

    const timer = setInterval(() => loadGoal(false), 4000);
    return () => clearInterval(timer);
  }, [goal, loadGoal]);

  useEffect(() => {
    const latestForGoal = activity.find((item) => item.goalId === goalId);
    if (latestForGoal) {
      loadGoal(false);
    }
  }, [activity, goalId, loadGoal]);

  const onRefresh = () => {
    setRefreshing(true);
    loadGoal(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8be9fd" />
        <Text style={styles.loadingText}>Loading goal...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Unable to load goal</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => loadGoal(true)}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!goal) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Goal not found</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = STATUS_COLOR[goal.status] || '#8be9fd';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle} numberOfLines={2}>{goal.title}</Text>
          <Text style={styles.headerSubtitle}>
            {goal.status} {goal.progress !== undefined ? `| ${goal.progress}%` : ''}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8be9fd" />}
      >
        <View style={styles.heroCard}>
          <View style={[styles.statusBadge, { borderColor: `${statusColor}66`, backgroundColor: `${statusColor}18` }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>{goal.status}</Text>
          </View>
          <Text style={styles.goalTitle}>{goal.title}</Text>
          {goal.description ? <Text style={styles.goalDescription}>{goal.description}</Text> : null}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${goal.progress || 0}%`, backgroundColor: statusColor }]} />
          </View>
          <Text style={styles.metaText}>Estimated time: {goal.estimated_time || 'Unknown'}</Text>
          <Text style={styles.metaText}>Created: {formatSqliteDate(goal.created_at)}</Text>
        </View>

        <Section title="Projects">
          {projects.length ? projects.map((project) => (
            <View key={project.id} style={styles.projectCard}>
              <View style={styles.projectHeader}>
                <Text style={styles.projectName}>{project.name}</Text>
                <Text style={[styles.projectStatus, { color: STATUS_COLOR[project.status] || '#aaa' }]}>
                  {project.status}
                </Text>
              </View>
              {project.description ? <Text style={styles.projectDescription}>{project.description}</Text> : null}
              {project.error ? <Text style={styles.projectError}>{project.error}</Text> : null}
              {project.model_used ? <Text style={styles.projectMeta}>Model: {project.model_used}</Text> : null}
              {project.output ? <Text style={styles.projectOutput}>{project.output}</Text> : null}
            </View>
          )) : (
            <EmptyText text="Project steps will appear here once Jarvis starts planning." />
          )}
        </Section>

        <Section title="Recent Logs">
          {logs.length ? logs.map((item) => (
            <View key={item.id} style={styles.logRow}>
              <Text style={styles.logMessage}>{item.message}</Text>
              <Text style={styles.logTime}>{formatSqliteDate(item.created_at)}</Text>
            </View>
          )) : (
            <EmptyText text="No logs yet for this goal." />
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function EmptyText({ text }) {
  return <Text style={styles.emptyText}>{text}</Text>;
}

function formatSqliteDate(value) {
  if (!value) return 'Unknown';
  return new Date(value.replace(' ', 'T') + 'Z').toLocaleString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090a0f' },
  centered: {
    flex: 1,
    backgroundColor: '#090a0f',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: { marginTop: 12, color: '#d7dbef', fontSize: 14 },
  errorTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  errorText: { color: '#9da3bf', fontSize: 14, textAlign: 'center', marginBottom: 18 },
  primaryButton: {
    backgroundColor: '#8be9fd',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  primaryButtonText: { color: '#061018', fontWeight: '700' },
  header: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1d1e2b',
    backgroundColor: '#0d0f17',
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 14,
  },
  backButtonText: { color: '#8be9fd', fontSize: 14, fontWeight: '700' },
  headerTextWrap: { flex: 1 },
  headerTitle: { color: '#f8f8f2', fontSize: 18, fontWeight: '800' },
  headerSubtitle: { color: '#6272a4', fontSize: 12, marginTop: 4 },
  content: { padding: 14, paddingBottom: 28 },
  heroCard: {
    backgroundColor: '#121523',
    borderWidth: 1,
    borderColor: '#222538',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  goalTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  goalDescription: { color: '#c5cae1', fontSize: 14, marginTop: 8, lineHeight: 20 },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#1a2031',
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: { height: '100%' },
  metaText: { color: '#7b84a8', fontSize: 12, marginTop: 10 },
  section: { marginBottom: 18 },
  sectionTitle: { color: '#f8f8f2', fontSize: 16, fontWeight: '800', marginBottom: 10 },
  projectCard: {
    backgroundColor: '#10131d',
    borderWidth: 1,
    borderColor: '#1f2435',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  projectHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  projectName: { color: '#f8f8f2', fontSize: 14, fontWeight: '700', flex: 1 },
  projectStatus: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  projectDescription: { color: '#b9bfd6', fontSize: 13, marginTop: 8, lineHeight: 18 },
  projectMeta: { color: '#7b84a8', fontSize: 11, marginTop: 8 },
  projectError: { color: '#ff7d7d', fontSize: 12, marginTop: 8 },
  projectOutput: { color: '#8f97b5', fontSize: 12, marginTop: 8, lineHeight: 18 },
  logRow: {
    backgroundColor: '#10131d',
    borderWidth: 1,
    borderColor: '#1f2435',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  logMessage: { color: '#dbe0f5', fontSize: 13, lineHeight: 18 },
  logTime: { color: '#6f7896', fontSize: 11, marginTop: 6 },
  emptyText: { color: '#7b84a8', fontSize: 13, lineHeight: 18 },
});
