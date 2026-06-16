import { create } from 'zustand';

import tunnelConfig from './tunnel_config.json';

export const useStore = create((set) => ({
  serverUrl: tunnelConfig.url,

  setServerUrl: (url) => set({ serverUrl: url }),

  isInternalTesting: false,
  setIsInternalTesting: (val) => set({ isInternalTesting: val }),

  authToken: null,
  setAuthToken: (token) => set({ authToken: token }),

  connected: false,
  setConnected: (status) => set({ connected: status }),

  socketInstance: null,
  setSocketInstance: (sock) => set({ socketInstance: sock }),

  goals: [],
  setGoals: (goals) => set({ goals }),
  updateGoal: (id, updates) => set((state) => ({
    goals: state.goals.map(g => g.id === id ? { ...g, ...updates } : g)
  })),

  activity: [],
  addActivity: (act) => set((state) => {
    const newAct = [act, ...state.activity].slice(0, 200); // keep last 200
    return { activity: newAct, unreadCount: state.unreadCount + 1 };
  }),

  systemLogs: [],
  addSystemLog: (log) => set((state) => {
    const newLogs = [log, ...state.systemLogs].slice(0, 500); // keep last 500
    return { systemLogs: newLogs };
  }),

  unreadCount: 0,

  clearUnread: () => set({ unreadCount: 0 }),

  intelFeed: [],
  addIntel: (intel) => set((state) => {
    const newIntel = [intel, ...state.intelFeed].slice(0, 50);
    return { intelFeed: newIntel, unreadIntelCount: state.unreadIntelCount + 1 };
  }),
  removeIntel: (id) => set((state) => ({
    intelFeed: state.intelFeed.filter(intel => intel.id !== id)
  })),
  
  unreadIntelCount: 0,
  clearUnreadIntel: () => set({ unreadIntelCount: 0 })
}));
