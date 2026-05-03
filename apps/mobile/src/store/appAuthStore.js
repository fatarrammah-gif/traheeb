import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const AUTH_KEY = "taraheeb_auth_v1";
const JWT_KEY = `${process.env.EXPO_PUBLIC_PROJECT_GROUP_ID}-jwt`;

const useAppAuthStore = create((set) => ({
  user: null, // { id, name, phone, jwt }
  isReady: false,

  initAuth: async () => {
    try {
      const raw = await AsyncStorage.getItem(AUTH_KEY);
      if (raw) {
        const user = JSON.parse(raw);
        set({ user, isReady: true });
      } else {
        set({ isReady: true });
      }
    } catch {
      set({ isReady: true });
    }
  },

  // Called after a successful OTP verify — persists user + JWT
  setUser: async ({ id, name, phone, jwt }) => {
    const user = { id, name, phone, jwt };
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user));
    // fetch.ts reads this to add Authorization: Bearer header
    await SecureStore.setItemAsync(JWT_KEY, JSON.stringify({ jwt }));
    set({ user });
  },

  logout: async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    await SecureStore.deleteItemAsync(JWT_KEY).catch(() => {});
    set({ user: null });
  },
}));

export default useAppAuthStore;
