import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { io } from 'socket.io-client';
import { useStore } from '../store/useStore';

export function useJarvisConnection(serverUrl) {
  const { setConnected, addActivity, updateGoal, addIntel, setSocketInstance, authToken } = useStore();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!serverUrl || !authToken) return;

    console.log('Connecting to Secure Jarvis WS...');
    const socket = io(serverUrl, { 
      transports: ['websocket'],
      auth: { token: authToken },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      extraHeaders: {
        'Bypass-Tunnel-Reminder': 'true',
        'ngrok-skip-browser-warning': 'true'
      }
    });
    socketRef.current = socket;

    socket.on('connect', () => { 
      console.log('[SOCKET] Connected to:', serverUrl);
      setConnected(true);
      setSocketInstance(socket);
    });
    
    socket.on('disconnect', (reason) => {
      console.log('[SOCKET] Disconnected:', reason);
      setConnected(false);
      setSocketInstance(null);
    });
    
    socket.on('activity', (data) => {
      // 1. The Global Feed Catcher: Route strategic intelligence to the Intel Tab
      const isIntel = 
        data.event === 'intel' ||
        (data.message && (
          data.message.includes('Antigravity') || 
          data.message.includes('✅ CrewAI Plan') ||
          data.message.includes('[INTEL]')
        )) || 
        data.event === 'goal_complete';

      if (isIntel) {
         let cleanIntel = data.raw || data.message || '';
         cleanIntel = cleanIntel.replace('Antigravity:', '').trim();
         cleanIntel = cleanIntel.replace('[INTEL]', '').trim();
         
         if (data.event === 'goal_complete') {
            cleanIntel = `SYSTEM PROTOCOL: Goal Execution Finalized.\n\nSummary: ${data.message || '(Processing Complete)'}\n\nPlease review your physical device or deployment target. Use the triggers below for any necessary adjustments.`;
         }

         addIntel({ 
            id: data.id || Math.random().toString(), 
            raw: cleanIntel, 
            source: data.source || 'SYSTEM',
            ts: data.ts || Date.now() 
         });
         
         // If it's just an intel/log event, don't clutter task activity
         if (data.event === 'log' || data.event === 'intel') return; 
      }

      addActivity({
        id: Math.random().toString(),
        event: data.event,
        message: data.message,
        status: data.status,
        progress: data.progress,
        goalId: data.goalId,
        projectId: data.projectId,
        ts: data.ts || Date.now()
      });

      if (data.event.startsWith('goal_') || data.event.startsWith('project_')) {
        if (data.goalId) {
          updateGoal(data.goalId, {
            status: data.status,
            progress: data.progress,
            estimated_time: data.estimated_time
          });
        }
      }
    });

    socket.on('system_log', (data) => {
      const { addSystemLog } = useStore.getState();
      addSystemLog({
        id: Math.random().toString(),
        level: data.level,
        message: data.message,
        ts: data.ts || Date.now()
      });
    });

    return () => {

      socket.disconnect();
    };
  }, [serverUrl]);

  return socketRef.current;
}
