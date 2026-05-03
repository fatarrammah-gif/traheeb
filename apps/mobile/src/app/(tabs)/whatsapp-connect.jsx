/**
 * WhatsApp Connect screen.
 * Shown after login to link the organizer's own WhatsApp account via pairing code.
 * Polls /api/whatsapp/status every 3 seconds until connected.
 */
import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { MessageCircle, CheckCircle } from "lucide-react-native";
import fetchToWeb from "@/__create/fetch";
import useAppAuthStore from "@/store/appAuthStore";

const LOGO =
  "https://ucarecdn.com/03257673-eb5c-488a-8763-5a0cd1769775/-/format/auto/";

const T = {
  bg: "#1E000E",
  surface: "rgba(255,255,255,0.07)",
  primary: "#C8005A",
  gold: "#E6D06A",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.65)",
};

export default function WhatsAppConnect() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAppAuthStore();

  const [pairingCode, setPairingCode] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const pollRef = useRef(null);

  // Start by checking current status, then request connect if needed
  useEffect(() => {
    (async () => {
      try {
        const statusRes = await fetchToWeb("/api/whatsapp/status");
        const { connected: isConnected } = await statusRes.json();

        if (isConnected) {
          setConnected(true);
          setLoading(false);
          return;
        }

        // Request pairing code
        const connectRes = await fetchToWeb("/api/whatsapp/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: user?.phone }),
        });
        const data = await connectRes.json();

        if (!connectRes.ok) {
          setError(data.error || "تعذر بدء الربط");
          setLoading(false);
          return;
        }

        if (data.connected) {
          setConnected(true);
        } else {
          setPairingCode(data.pairingCode);
        }
        setLoading(false);

        // Poll until connected
        pollRef.current = setInterval(async () => {
          try {
            const res = await fetchToWeb("/api/whatsapp/status");
            const { connected: isNowConnected } = await res.json();
            if (isNowConnected) {
              clearInterval(pollRef.current);
              setConnected(true);
            }
          } catch {
            // ignore poll errors
          }
        }, 3000);
      } catch {
        setError("تعذر الاتصال بالخادم");
        setLoading(false);
      }
    })();

    return () => clearInterval(pollRef.current);
  }, []);

  const handleContinue = () => router.replace("/(tabs)");

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: T.bg,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 28,
        alignItems: "center",
      }}
    >
      <StatusBar style="light" />

      <Image
        source={{ uri: LOGO }}
        style={{ width: 70, height: 105, marginBottom: 32 }}
        contentFit="contain"
      />

      {loading ? (
        <>
          <ActivityIndicator color={T.gold} size="large" />
          <Text style={{ color: T.muted, marginTop: 16, fontSize: 14 }}>
            جارٍ الاتصال...
          </Text>
        </>
      ) : connected ? (
        <>
          <CheckCircle size={64} color="#22C55E" />
          <Text
            style={{
              color: T.text,
              fontSize: 22,
              fontFamily: "Inter_700Bold",
              marginTop: 20,
              textAlign: "center",
            }}
          >
            تم ربط واتساب بنجاح!
          </Text>
          <Text
            style={{
              color: T.muted,
              fontSize: 14,
              marginTop: 10,
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            يمكنك الآن إرسال الدعوات من رقمك مباشرة عبر واتساب.
          </Text>
          <TouchableOpacity
            onPress={handleContinue}
            style={{
              marginTop: 36,
              backgroundColor: T.primary,
              borderRadius: 14,
              paddingVertical: 15,
              paddingHorizontal: 48,
            }}
          >
            <Text
              style={{
                color: "#FFF",
                fontSize: 16,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              ابدأ الاستخدام
            </Text>
          </TouchableOpacity>
        </>
      ) : error ? (
        <>
          <Text style={{ color: "#EF4444", fontSize: 16, textAlign: "center" }}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={handleContinue}
            style={{ marginTop: 24, padding: 12 }}
          >
            <Text style={{ color: T.muted, fontSize: 14 }}>
              تخطي الآن وربط لاحقاً
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <MessageCircle size={48} color={T.gold} />
          <Text
            style={{
              color: T.text,
              fontSize: 22,
              fontFamily: "Inter_700Bold",
              marginTop: 20,
              textAlign: "center",
            }}
          >
            ربط واتساب
          </Text>
          <Text
            style={{
              color: T.muted,
              fontSize: 14,
              marginTop: 10,
              marginBottom: 32,
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            للإرسال من رقمك الشخصي، افتح واتساب ثم اختر{"\n"}
            <Text style={{ color: T.gold }}>
              الإعدادات ← الأجهزة المرتبطة ← ربط جهاز
            </Text>
            {"\n"}وأدخل الرمز أدناه:
          </Text>

          {/* Pairing code display */}
          <View
            style={{
              backgroundColor: T.surface,
              borderRadius: 18,
              padding: 28,
              alignItems: "center",
              width: "100%",
              borderWidth: 1,
              borderColor: "rgba(230,208,106,0.3)",
            }}
          >
            <Text
              style={{
                color: T.gold,
                fontSize: 42,
                fontFamily: "Inter_700Bold",
                letterSpacing: 10,
              }}
            >
              {pairingCode ?? "------"}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 16,
                gap: 8,
              }}
            >
              <ActivityIndicator color={T.muted} size="small" />
              <Text style={{ color: T.muted, fontSize: 13 }}>
                في انتظار الربط...
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleContinue}
            style={{ marginTop: 28, padding: 12 }}
          >
            <Text
              style={{
                color: T.muted,
                fontSize: 13,
                textDecorationLine: "underline",
              }}
            >
              تخطي الآن وربط لاحقاً
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
