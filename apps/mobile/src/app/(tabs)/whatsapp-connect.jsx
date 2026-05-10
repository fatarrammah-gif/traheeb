/**
 * WhatsApp Connect Screen
 * Organizer links their personal WhatsApp once so invitations are sent from their number.
 * Shows a QR code (from whatsapp-web.js) for the organizer to scan.
 */
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CheckCircle, RefreshCw, WifiOff } from 'lucide-react-native';
import fetchToWeb from '@/__create/fetch';

const T = {
  bg: '#FDFBFC',
  surface: '#FFFFFF',
  primary: '#C8005A',
  primarySoft: '#FFF0F7',
  text: '#1A0910',
  muted: '#7A5568',
  border: '#F2E0EB',
  green: '#16A34A',
  greenSoft: '#F0FDF4',
};

export default function WhatsAppConnect() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [status, setStatus] = useState('idle'); // idle | loading | qr_ready | connected | error
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    checkStatus();
    return () => clearInterval(pollRef.current);
  }, []);

  async function checkStatus() {
    try {
      const res = await fetchToWeb('/api/whatsapp/status');
      const data = await res.json();
      if (data.connected) {
        setStatus('connected');
      } else if (data.qrDataUrl) {
        setQrDataUrl(data.qrDataUrl);
        setStatus('qr_ready');
        startPolling();
      }
    } catch {}
  }

  async function startConnect() {
    setStatus('loading');
    setQrDataUrl(null);
    clearInterval(pollRef.current);
    try {
      console.log('[WA connect] calling POST /api/whatsapp/connect');
      const res = await fetchToWeb('/api/whatsapp/connect', { method: 'POST' });
      console.log('[WA connect] HTTP status:', res.status);
      const data = await res.json();
      console.log('[WA connect] response:', JSON.stringify(data).slice(0, 120));
      if (data.connected) {
        setStatus('connected');
        return;
      }
      if (data.qrDataUrl) {
        setQrDataUrl(data.qrDataUrl);
        setStatus('qr_ready');
      } else {
        setStatus('loading');
      }
      startPolling();
    } catch (err) {
      console.error('[WA connect] error:', err?.message);
      setStatus('error');
    }
  }

  function startPolling() {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetchToWeb('/api/whatsapp/status');
        const data = await res.json();
        if (data.connected) {
          setStatus('connected');
          setQrDataUrl(null);
          clearInterval(pollRef.current);
        } else if (data.qrDataUrl) {
          setQrDataUrl(data.qrDataUrl);
          setStatus('qr_ready');
        }
      } catch {}
    }, 3000);
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient
        colors={['#1E000E', '#55002F', '#8A004F']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 20,
          paddingBottom: 18,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#FFF', fontSize: 26 }}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={{ color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 18 }}>
            ربط واتساب
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter_400Regular', fontSize: 12 }}>
            أرسل الدعوات من رقمك الشخصي
          </Text>
        </View>
      </LinearGradient>
      <LinearGradient
        colors={['#8A004F', '#C8991A', '#FFD54F', '#C8991A', '#8A004F']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ height: 4 }}
      />

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 40, alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        {/* Connected */}
        {status === 'connected' && (
          <View style={{ alignItems: 'center', marginTop: 40, gap: 16 }}>
            <View style={{
              width: 90, height: 90, borderRadius: 45,
              backgroundColor: T.greenSoft, alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle size={50} color={T.green} />
            </View>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: T.green }}>
              واتساب مرتبط ✓
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 22 }}>
              سيتم إرسال الدعوات من رقمك الشخصي تلقائياً عند دعوة الضيوف
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/(tabs)')}
              style={{ marginTop: 20, backgroundColor: T.primary, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 48 }}
            >
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#FFF' }}>الرئيسية</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Idle */}
        {status === 'idle' && (
          <View style={{ alignItems: 'center', marginTop: 40, gap: 18 }}>
            <View style={{
              width: 90, height: 90, borderRadius: 45,
              backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center',
            }}>
              <WifiOff size={44} color={T.primary} />
            </View>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 20, color: T.text, textAlign: 'center' }}>
              ربط حساب واتساب
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 22 }}>
              اربط رقمك الشخصي لإرسال الدعوات للمدعوين مباشرةً من حسابك في واتساب
            </Text>
            <TouchableOpacity
              onPress={startConnect}
              style={{ marginTop: 8, backgroundColor: T.primary, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 48 }}
            >
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#FFF' }}>ابدأ الربط</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading */}
        {status === 'loading' && (
          <View style={{ alignItems: 'center', marginTop: 60, gap: 20 }}>
            <ActivityIndicator size="large" color={T.primary} />
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 15, color: T.muted }}>
              جاري تحضير رمز الربط...
            </Text>
          </View>
        )}

        {/* QR Code */}
        {status === 'qr_ready' && qrDataUrl && (
          <View style={{ alignItems: 'center', marginTop: 16, gap: 16, width: '100%' }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 18, color: T.text }}>
              امسح الرمز بواتساب
            </Text>

            <View style={{ borderWidth: 2, borderColor: T.border, borderRadius: 16, padding: 12, backgroundColor: '#FFF' }}>
              <Image source={{ uri: qrDataUrl }} style={{ width: 240, height: 240 }} contentFit="contain" />
            </View>

            <View style={{ backgroundColor: T.primarySoft, borderRadius: 14, padding: 18, width: '100%', gap: 12 }}>
              {[
                'افتح واتساب على هاتفك',
                'اضغط على ⋮ ثم "الأجهزة المرتبطة"',
                'اضغط "ربط جهاز"',
                'وجّه الكاميرا نحو الرمز أعلاه',
              ].map((step, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <View style={{
                    width: 24, height: 24, borderRadius: 12,
                    backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center', marginTop: 1,
                  }}>
                    <Text style={{ color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 12 }}>{i + 1}</Text>
                  </View>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: T.text, flex: 1, lineHeight: 21 }}>
                    {step}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: T.muted }}>
              ينتهي الرمز بعد 20 ثانية ويُحدَّث تلقائياً
            </Text>

            <TouchableOpacity
              onPress={startConnect}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                borderWidth: 1.5, borderColor: T.primary, borderRadius: 12,
                paddingVertical: 11, paddingHorizontal: 24,
              }}
            >
              <RefreshCw size={15} color={T.primary} />
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.primary }}>تحديث الرمز</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Error */}
        {status === 'error' && (
          <View style={{ alignItems: 'center', marginTop: 40, gap: 16 }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#EF4444', textAlign: 'center' }}>
              حدث خطأ في الاتصال
            </Text>
            <TouchableOpacity
              onPress={startConnect}
              style={{ backgroundColor: T.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 }}
            >
              <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#FFF' }}>حاول مجدداً</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
