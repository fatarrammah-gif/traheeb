/**
 * QR Scanner screen — event entrance check-in.
 * Opened from event detail when now >= eventStart - 2 hours.
 *
 * Flow:
 *   1. Scan QR → POST /api/qr/preview (guest info, no mark-used)
 *   2. Show confirmation card with guest name + Confirm / Cancel buttons
 *   3. Confirm → POST /api/qr/scan (mark used) → show result
 *   4. Cancel → resume scanning immediately
 */
import { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, UserCheck } from "lucide-react-native";
import fetchToWeb from "@/__create/fetch";

const RESULT_DURATION = 3000; // ms before auto-resuming after final result

export default function ScannerScreen() {
  const { eventId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();

  // 'scanning' | 'confirming' | 'result'
  const [phase, setPhase] = useState('scanning');
  const [preview, setPreview]   = useState(null); // guest info from preview
  const [result, setResult]     = useState(null); // final scan result
  const [token, setToken]       = useState(null); // token held during confirm
  const [loading, setLoading]   = useState(false);

  const cooldownRef = useRef(false);

  // ── Step 1: QR detected → preview ───────────────────────────────────────────
  const handleBarCode = async ({ data: scannedToken }) => {
    if (phase !== 'scanning' || cooldownRef.current || loading) return;
    cooldownRef.current = true;
    setLoading(true);

    try {
      const res = await fetchToWeb('/api/qr/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: scannedToken, eventId }),
      });
      const data = await res.json();

      if (data.status === 'valid') {
        // Show confirmation card
        setToken(scannedToken);
        setPreview(data);
        setPhase('confirming');
        Vibration.vibrate(80);
      } else {
        // already_used or invalid — skip confirmation, show result directly
        setResult(data);
        setPhase('result');
        Vibration.vibrate(400);
        setTimeout(resetScanner, RESULT_DURATION);
      }
    } catch {
      setResult({ status: 'error' });
      setPhase('result');
      setTimeout(resetScanner, RESULT_DURATION);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2a: Confirmed → actual scan ────────────────────────────────────────
  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetchToWeb('/api/qr/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, eventId }),
      });
      const data = await res.json();
      setResult(data);
      setPhase('result');
      Vibration.vibrate(data.status === 'valid' ? [0, 100, 50, 100] : 400);
      setTimeout(resetScanner, RESULT_DURATION);
    } catch {
      setResult({ status: 'error' });
      setPhase('result');
      setTimeout(resetScanner, RESULT_DURATION);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2b: Cancelled → resume immediately ──────────────────────────────────
  const handleCancel = () => {
    resetScanner();
  };

  function resetScanner() {
    setPhase('scanning');
    setPreview(null);
    setResult(null);
    setToken(null);
    cooldownRef.current = false;
  }

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.permText}>يحتاج الماسح إلى صلاحية الكاميرا لمسح رموز QR.</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permBtn}>
          <Text style={styles.permBtnText}>منح الصلاحية</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Result overlay config
  const overlayColor =
    result?.status === 'valid'        ? '#22C55E' :
    result?.status === 'already_used' ? '#F59E0B' :
    result?.status === 'declined'     ? '#EF4444' : '#EF4444';

  const overlayMessage =
    result?.status === 'valid'
      ? result.guest?.maxScans > 1
        ? `✅ تم تسجيل الدخول\n${result.guest?.name} — دخول ${result.guest.scanCount} من ${result.guest.maxScans}`
        : `✅ تم تسجيل الدخول\n${result.guest?.name}${result.guest?.companions > 0 ? ` (${result.guest.companions} مرافق)` : ''}`
      : result?.status === 'already_used'
        ? `⚠️ تم استخدام هذا الرمز مسبقاً\n${result.guest?.name ?? ''}`
        : result?.status === 'declined'
          ? '❌ هذا الضيف اعتذر عن الحضور'
          : result?.status === 'invalid'
            ? '❌ رمز غير صحيح'
            : '⚠️ خطأ في الاتصال';

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" />

      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={phase === 'scanning' ? handleBarCode : undefined}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Back button */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.backBtn, { top: insets.top + 12 }]}
      >
        <ArrowLeft size={24} color="#FFF" />
      </TouchableOpacity>

      {/* Scan frame guide */}
      {phase === 'scanning' && (
        <View style={styles.frameGuide}>
          <View style={styles.corner} />
        </View>
      )}

      {/* Header label */}
      {phase === 'scanning' && (
        <View style={[styles.header, { paddingTop: insets.top + 60 }]}>
          <Text style={styles.headerText}>امسح رمز QR للدخول</Text>
        </View>
      )}

      {/* ── Confirmation card ── */}
      {phase === 'confirming' && preview && (
        <View style={[StyleSheet.absoluteFill, styles.confirmOverlay]}>
          <View style={styles.confirmCard}>
            {/* Icon */}
            <View style={styles.confirmIconWrap}>
              <UserCheck size={40} color="#C8005A" />
            </View>

            <Text style={styles.confirmTitle}>تأكيد الدخول</Text>
            <Text style={styles.confirmName}>{preview.guest?.name}</Text>
            {preview.source === 'imported' && (
              <Text style={styles.confirmCode}>{preview.guest?.code}</Text>
            )}

            {preview.guest?.maxScans > 1 ? (
              <Text style={styles.confirmCompanions}>
                دخول {preview.guest.scanCount + 1} من {preview.guest.maxScans}
                {preview.guest.companions > 0 ? ` (${preview.guest.companions} مرافق)` : ''}
              </Text>
            ) : preview.guest?.companions > 0 && (
              <Text style={styles.confirmCompanions}>
                + {preview.guest.companions} مرافق
              </Text>
            )}

            <View style={styles.confirmButtons}>
              {/* Cancel */}
              <TouchableOpacity
                onPress={handleCancel}
                disabled={loading}
                style={[styles.confirmBtn, styles.cancelBtn]}
              >
                <XCircle size={20} color="#EF4444" />
                <Text style={[styles.confirmBtnText, { color: '#EF4444' }]}>إلغاء</Text>
              </TouchableOpacity>

              {/* Confirm */}
              <TouchableOpacity
                onPress={handleConfirm}
                disabled={loading}
                style={[styles.confirmBtn, styles.approveBtn]}
              >
                <CheckCircle size={20} color="#FFF" />
                <Text style={[styles.confirmBtnText, { color: '#FFF' }]}>
                  {loading ? 'جارٍ...' : 'تأكيد الدخول'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Final result overlay ── */}
      {phase === 'result' && result && (
        <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: overlayColor + 'E6' }]}>
          {result.status === 'valid'
            ? <CheckCircle size={72} color="#FFF" />
            : result.status === 'already_used'
              ? <AlertCircle size={72} color="#FFF" />
              : <XCircle size={72} color="#FFF" />
          }
          <Text style={styles.overlayText}>{overlayMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#000', padding: 24,
  },
  permText: {
    color: '#FFF', fontSize: 15, textAlign: 'center',
    marginBottom: 20, fontFamily: 'Inter_400Regular',
  },
  permBtn: {
    backgroundColor: '#C8005A', paddingVertical: 12,
    paddingHorizontal: 32, borderRadius: 12,
  },
  permBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  backBtn: {
    position: 'absolute', left: 16, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8,
  },
  frameGuide: {
    position: 'absolute', top: '30%', left: '15%', right: '15%',
    aspectRatio: 1, borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)', borderRadius: 12,
  },
  corner: {
    position: 'absolute', width: 20, height: 20,
    borderColor: '#E6D06A', borderTopWidth: 3, borderLeftWidth: 3,
  },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center',
  },
  headerText: {
    color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: 'Inter_500Medium',
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16,
    paddingVertical: 6, borderRadius: 20,
  },

  // Confirmation
  confirmOverlay: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  confirmCard: {
    backgroundColor: '#FFF', borderRadius: 24, padding: 28,
    marginHorizontal: 24, width: '85%', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 12,
  },
  confirmIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#FFF0F7', alignItems: 'center',
    justifyContent: 'center', marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18, fontFamily: 'Inter_700Bold',
    color: '#1A0910', marginBottom: 8,
  },
  confirmName: {
    fontSize: 22, fontFamily: 'Inter_700Bold',
    color: '#C8005A', textAlign: 'center', marginBottom: 4,
  },
  confirmCompanions: {
    fontSize: 14, fontFamily: 'Inter_400Regular',
    color: '#7A5568', marginBottom: 4,
  },
  confirmCode: {
    fontSize: 13, fontFamily: 'Inter_400Regular',
    color: '#7A5568', marginBottom: 4,
  },
  confirmButtons: {
    flexDirection: 'row', gap: 12, marginTop: 24, width: '100%',
  },
  confirmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6, paddingVertical: 13,
    borderRadius: 14,
  },
  cancelBtn: {
    backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#FECACA',
  },
  approveBtn: {
    backgroundColor: '#C8005A',
  },
  confirmBtnText: {
    fontSize: 15, fontFamily: 'Inter_600SemiBold',
  },

  // Result
  overlay: {
    alignItems: 'center', justifyContent: 'center', gap: 20,
  },
  overlayText: {
    color: '#FFF', fontSize: 20, fontFamily: 'Inter_700Bold',
    textAlign: 'center', paddingHorizontal: 32, lineHeight: 30,
  },
});
