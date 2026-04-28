import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_KEY = "taraheeb_auth_v1";

const useAppAuthStore = create((set, get) => ({
  user: null, // { name, phone, country, countryCode, registeredAt }
  isReady: false,
  otp: null, // generated OTP for current session

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

  setUser: async (user) => {
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user));
    set({ user });
  },

  logout: async () => {
    await AsyncStorage.removeItem(AUTH_KEY);
    set({ user: null, otp: null });
  },

  generateOtp: () => {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    set({ otp });
    return otp;
  },

  clearOtp: () => set({ otp: null }),
}));

export default useAppAuthStore;
