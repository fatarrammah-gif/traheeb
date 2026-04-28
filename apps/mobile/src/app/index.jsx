import { useEffect, useRef } from "react";
import { View, Animated, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import useAppAuthStore from "@/store/appAuthStore";

const { width } = Dimensions.get("window");

const LOGO =
  "https://ucarecdn.com/03257673-eb5c-488a-8763-5a0cd1769775/-/format/auto/";

export default function SplashScreen() {
  const router = useRouter();
  const { user, isReady, initAuth } = useAppAuthStore();

  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    if (!isReady) return;

    // 1. spring pop-in
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 4,
        tension: 55,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 550,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 2. gentle double-pulse then fade out
      Animated.sequence([
        Animated.timing(pulseScale, {
          toValue: 1.07,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(pulseScale, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(pulseScale, {
          toValue: 1.04,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(pulseScale, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.delay(700),
        Animated.timing(screenOpacity, {
          toValue: 0,
          duration: 480,
          useNativeDriver: true,
        }),
      ]).start(() => {
        router.replace(user ? "/(tabs)" : "/auth");
      });
    });
  }, [isReady]);

  // Logo is portrait — fill most of the screen nicely
  const LOGO_W = Math.round(width * 0.68);
  const LOGO_H = Math.round(LOGO_W * 1.46);

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        opacity: screenOpacity,
      }}
    >
      <StatusBar style="dark" />

      {/* Soft pink radial glow behind logo */}
      <View
        style={{
          position: "absolute",
          width: width * 0.88,
          height: width * 0.88,
          borderRadius: width * 0.44,
          backgroundColor: "#FFEDF5",
          opacity: 0.65,
        }}
      />

      {/* Logo with spring + pulse */}
      <Animated.View
        style={{
          opacity: logoOpacity,
          transform: [{ scale: Animated.multiply(logoScale, pulseScale) }],
        }}
      >
        <Image
          source={{ uri: LOGO }}
          style={{ width: LOGO_W, height: LOGO_H }}
          contentFit="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}
