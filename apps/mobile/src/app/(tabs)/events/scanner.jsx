/**
 * QR Scanner screen — event entrance check-in.
 * Opened from event detail when now >= eventStart - 2 hours.
 * Scans QR codes and calls POST /api/qr/scan for one-time validation.
 */
import { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, CheckCircle, XCircle, AlertCircle } from "lucide-react-native";
import fetchToWeb from "@/__create/fetch";

const OVERLAY_RESULT_DURATION = 3000; // ms before resuming scanning

export default function ScannerScreen() {
  const { eventId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState(null); // { status, guest?, usedAt? }
  const [loading, setLoading] = useState(false);

  const cooldownRef = useRef(false);

  const handleBarCode = async ({ data: token }) => {
    if (!scanning || cooldownRef.current || loading) return;
    cooldownRef.current = true;
    setLoading(true);
    setScanning(false);

    try {
      const res = await fetchToWeb("/api/qr/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, eventId }),
      });
      const data = await res.json();
      setResult(data);
      Vibration.vibrate(data.status === "valid" ? [0, 100, 50, 100] : 400);
    } catch {
      setResult({ status: "error" });
    } finally {
      setLoading(false);
      // Resume scanning after delay
      setTimeout(() => {
        setResult(null);
        setScanning(true);
        cooldownRef.current = false;
      }, OVERLAY_RESULT_DURATION);
    }
  };

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.permText}>
          يحتاج الماسح إلى صلاحية الكاميرا لمسح رموز QR.
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permBtn}>
          <Text style={styles.permBtnText}>منح الصلاحية</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const overlayColor =
    result?.status === "valid"
      ? "#22C55E"
      : result?.status === "already_used"
        ? "#F59E0B"
        : result?.status === "error" || result?.status === "invalid"
          ? "#EF4444"
          : "transparent";

  const OverlayIcon =
    result?.status === "valid"
      ? CheckCircle
      : result?.status === "already_used"
        ? AlertCircle
        : XCircle;

  const overlayMessage =
    result?.status === "valid"
      ? `✅ مسموح بالدخول\n${result.guest?.name}${result.guest?.companions > 0 ? ` (${result.guest.companions} مرافق)` : ""}`
      : result?.status === "already_used"
        ? `⚠️ تم استخدام هذا الرمز مسبقاً\n${result.guest?.name ?? ""}`
        : result?.status === "invalid"
          ? "❌ رمز غير صحيح"
          : result?.status === "error"
            ? "⚠️ خطأ في الاتصال"
            : null;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar style="light" />

      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanning ? handleBarCode : undefined}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      />

      {/* Back button */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.backBtn, { top: insets.top + 12 }]}
      >
        <ArrowLeft size={24} color="#FFF" />
      </TouchableOpacity>

      {/* Scan frame guide */}
      {!result && (
        <View style={styles.frameGuide}>
          <View style={styles.corner} />
        </View>
      )}

      {/* Result overlay */}
      {result && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.overlay,
            { backgroundColor: overlayColor + "E6" },
          ]}
        >
          <OverlayIcon size={72} color="#FFF" />
          <Text style={styles.overlayText}>{overlayMessage}</Text>
        </View>
      )}

      {/* Header label */}
      <View style={[styles.header, { paddingTop: insets.top + 60 }]}>
        <Text style={styles.headerText}>امسح رمز QR للدخول</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    padding: 24,
  },
  permText: {
    color: "#FFF",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 20,
    fontFamily: "Inter_400Regular",
  },
  permBtn: {
    backgroundColor: "#C8005A",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  permBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  backBtn: {
    position: "absolute",
    left: 16,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 8,
  },
  frameGuide: {
    position: "absolute",
    top: "30%",
    left: "15%",
    right: "15%",
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: 12,
  },
  corner: {
    position: "absolute",
    width: 20,
    height: 20,
    borderColor: "#E6D06A",
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  overlay: {
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  overlayText: {
    color: "#FFF",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 30,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  headerText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
});
