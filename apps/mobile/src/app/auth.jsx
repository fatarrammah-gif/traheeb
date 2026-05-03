import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { ChevronDown, Search, X } from "lucide-react-native";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import useAppAuthStore from "@/store/appAuthStore";
import fetchToWeb from "@/__create/fetch";

const { height } = Dimensions.get("window");
const LOGO =
  "https://ucarecdn.com/03257673-eb5c-488a-8763-5a0cd1769775/-/format/auto/";

const T = {
  bg: "#FDFBFC",
  surface: "#FFFFFF",
  primary: "#C8005A",
  primarySoft: "#FFF0F7",
  accent: "#C8991A",
  accentSoft: "#FFF8E7",
  text: "#1A0910",
  muted: "#7A5568",
  border: "#F2E0EB",
  borderDark: "#E0C4D5",
};

const COUNTRIES = [
  { name: "المملكة العربية السعودية", code: "+966", flag: "🇸🇦" },
  { name: "الإمارات العربية المتحدة", code: "+971", flag: "🇦🇪" },
  { name: "الكويت", code: "+965", flag: "🇰🇼" },
  { name: "قطر", code: "+974", flag: "🇶🇦" },
  { name: "البحرين", code: "+973", flag: "🇧🇭" },
  { name: "عُمان", code: "+968", flag: "🇴🇲" },
  { name: "مصر", code: "+20", flag: "🇪🇬" },
  { name: "الأردن", code: "+962", flag: "🇯🇴" },
  { name: "لبنان", code: "+961", flag: "🇱🇧" },
  { name: "العراق", code: "+964", flag: "🇮🇶" },
  { name: "سوريا", code: "+963", flag: "🇸🇾" },
  { name: "ليبيا", code: "+218", flag: "🇱🇾" },
  { name: "تونس", code: "+216", flag: "🇹🇳" },
  { name: "الجزائر", code: "+213", flag: "🇩🇿" },
  { name: "المغرب", code: "+212", flag: "🇲🇦" },
  { name: "السودان", code: "+249", flag: "🇸🇩" },
  { name: "اليمن", code: "+967", flag: "🇾🇪" },
  { name: "فلسطين", code: "+970", flag: "🇵🇸" },
  { name: "تركيا", code: "+90", flag: "🇹🇷" },
  { name: "باكستان", code: "+92", flag: "🇵🇰" },
  { name: "الهند", code: "+91", flag: "🇮🇳" },
  { name: "المملكة المتحدة", code: "+44", flag: "🇬🇧" },
  { name: "الولايات المتحدة", code: "+1", flag: "🇺🇸" },
  { name: "كندا", code: "+1", flag: "🇨🇦" },
  { name: "أستراليا", code: "+61", flag: "🇦🇺" },
  { name: "ألمانيا", code: "+49", flag: "🇩🇪" },
  { name: "فرنسا", code: "+33", flag: "🇫🇷" },
  { name: "إيطاليا", code: "+39", flag: "🇮🇹" },
  { name: "إسبانيا", code: "+34", flag: "🇪🇸" },
  { name: "هولندا", code: "+31", flag: "🇳🇱" },
];

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setUser } = useAppAuthStore();

  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone"); // 'phone' | 'otp'
  const [loading, setLoading] = useState(false);
  const [countryModal, setCountryModal] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const otpRef = useRef(null);

  const filteredCountries = COUNTRIES.filter(
    (c) => c.name.includes(countrySearch) || c.code.includes(countrySearch),
  );

  const fullPhone = `${selectedCountry.code}${phone.replace(/^0+/, "")}`;

  const handleSendOtp = async () => {
    if (!phone.trim() || phone.trim().length < 7) {
      Alert.alert("خطأ", "يرجى إدخال رقم هاتف صحيح.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      Alert.alert("خطأ", "يرجى إدخال اسمك الكريم.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetchToWeb("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = await res.json();

      if (!res.ok) {
        Alert.alert("خطأ", data.error || "تعذر إرسال رمز التحقق");
        return;
      }

      setStep("otp");
      setTimeout(() => otpRef.current?.focus(), 300);
    } catch {
      Alert.alert("خطأ", "تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.trim().length < 6) return;

    setLoading(true);
    try {
      const res = await fetchToWeb("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: fullPhone,
          code: otp.trim(),
          name: mode === "signup" ? name.trim() : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        Alert.alert("خطأ", data.error || "رمز التحقق غير صحيح");
        return;
      }

      await setUser({
        id: data.user.id,
        name: data.user.name,
        phone: data.user.phone,
        jwt: data.jwt,
      });

      router.replace("/(tabs)");
    } catch {
      Alert.alert("خطأ", "تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      await fetchToWeb("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: T.text,
    backgroundColor: T.surface,
    textAlign: "right",
  };

  return (
    <KeyboardAvoidingAnimatedView
      style={{ flex: 1, backgroundColor: T.bg }}
      behavior="padding"
    >
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 32,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <Image
            source={{ uri: LOGO }}
            style={{ width: 140, height: 205 }}
            contentFit="contain"
          />
        </View>

        {/* Card */}
        <View
          style={{
            backgroundColor: T.surface,
            borderRadius: 16,
            padding: 24,
            borderWidth: 1,
            borderColor: T.border,
          }}
        >
          {/* Mode Tabs */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: T.bg,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: T.border,
              marginBottom: 24,
              padding: 3,
            }}
          >
            {[
              { key: "login", label: "تسجيل الدخول" },
              { key: "signup", label: "إنشاء حساب" },
            ].map((m) => (
              <TouchableOpacity
                key={m.key}
                onPress={() => {
                  setMode(m.key);
                  setStep("phone");
                  setOtp("");
                }}
                style={{
                  flex: 1,
                  paddingVertical: 9,
                  borderRadius: 8,
                  alignItems: "center",
                  backgroundColor: mode === m.key ? T.surface : "transparent",
                  borderWidth: mode === m.key ? 1 : 0,
                  borderColor: T.border,
                }}
              >
                <Text
                  style={{
                    fontFamily:
                      mode === m.key ? "Inter_600SemiBold" : "Inter_400Regular",
                    fontSize: 13,
                    color: mode === m.key ? T.primary : T.muted,
                  }}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {step === "phone" ? (
            <>
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  fontSize: 20,
                  color: T.text,
                  textAlign: "right",
                  marginBottom: 6,
                }}
              >
                {mode === "signup" ? "إنشاء حساب جديد" : "مرحباً بعودتك"}
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: T.muted,
                  textAlign: "right",
                  marginBottom: 22,
                  lineHeight: 20,
                }}
              >
                {mode === "signup"
                  ? "سيتم إرسال رمز التحقق إلى واتساب الخاص بك تلقائياً."
                  : "أدخل رقم هاتفك وسنرسل لك رمز التحقق على واتساب تلقائياً."}
              </Text>

              {/* Name (signup only) */}
              {mode === "signup" && (
                <View style={{ marginBottom: 14 }}>
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 12,
                      color: T.text,
                      textAlign: "right",
                      marginBottom: 6,
                    }}
                  >
                    الاسم <Text style={{ color: "#EF4444" }}>*</Text>
                  </Text>
                  <TextInput
                    style={inputStyle}
                    placeholder="اسمك الكريم"
                    placeholderTextColor={T.muted}
                    value={name}
                    onChangeText={setName}
                  />
                </View>
              )}

              {/* Phone + Country */}
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 12,
                  color: T.text,
                  textAlign: "right",
                  marginBottom: 6,
                }}
              >
                رقم الهاتف <Text style={{ color: "#EF4444" }}>*</Text>
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 22 }}>
                <TextInput
                  style={[inputStyle, { flex: 1 }]}
                  placeholder="5XXXXXXXX"
                  placeholderTextColor={T.muted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
                <TouchableOpacity
                  onPress={() => setCountryModal(true)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: T.border,
                    borderRadius: 10,
                    backgroundColor: T.surface,
                    minWidth: 90,
                    justifyContent: "center",
                  }}
                >
                  <ChevronDown size={14} color={T.muted} />
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 13,
                      color: T.text,
                    }}
                  >
                    {selectedCountry.code}
                  </Text>
                  <Text style={{ fontSize: 18 }}>{selectedCountry.flag}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleSendOtp}
                disabled={loading}
                style={{
                  backgroundColor: loading ? "#E88AB4" : T.primary,
                  borderRadius: 12,
                  padding: 15,
                  alignItems: "center",
                }}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 15,
                      color: "#FFF",
                    }}
                  >
                    إرسال رمز التحقق عبر واتساب
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  fontSize: 20,
                  color: T.text,
                  textAlign: "right",
                  marginBottom: 6,
                }}
              >
                أدخل رمز التحقق
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: T.muted,
                  textAlign: "right",
                  marginBottom: 6,
                  lineHeight: 20,
                }}
              >
                تم إرسال رمز مكون من 6 أرقام إلى واتساب على الرقم:
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                  color: T.primary,
                  textAlign: "right",
                  marginBottom: 22,
                }}
              >
                {fullPhone}
              </Text>

              <View style={{ marginBottom: 22 }}>
                <TextInput
                  ref={otpRef}
                  style={[
                    inputStyle,
                    {
                      fontSize: 22,
                      letterSpacing: 8,
                      textAlign: "center",
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                  placeholder="_ _ _ _ _ _"
                  placeholderTextColor={T.border}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              <TouchableOpacity
                onPress={handleVerifyOtp}
                disabled={loading || otp.length < 6}
                style={{
                  backgroundColor: otp.length < 6 ? "#E88AB4" : T.primary,
                  borderRadius: 12,
                  padding: 15,
                  alignItems: "center",
                  marginBottom: 14,
                }}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 15,
                      color: "#FFF",
                    }}
                  >
                    تأكيد
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setStep("phone");
                  setOtp("");
                }}
                style={{ alignItems: "center", paddingVertical: 10 }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 13,
                    color: T.muted,
                  }}
                >
                  تعديل رقم الهاتف
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResendOtp}
                disabled={loading}
                style={{ alignItems: "center", paddingVertical: 6 }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 13,
                    color: T.primary,
                  }}
                >
                  إعادة الإرسال
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Terms */}
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 11,
            color: T.muted,
            textAlign: "center",
            marginTop: 20,
            lineHeight: 17,
          }}
        >
          بالمتابعة فإنك توافق على شروط الاستخدام وسياسة الخصوصية لتراحيب
        </Text>
      </ScrollView>

      {/* Country Modal */}
      <Modal
        visible={countryModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={{ flex: 1, backgroundColor: T.bg }}>
          <View
            style={{
              paddingTop: insets.top + 12,
              paddingHorizontal: 20,
              paddingBottom: 14,
              borderBottomWidth: 1,
              borderBottomColor: T.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <TouchableOpacity onPress={() => setCountryModal(false)}>
              <X size={22} color={T.text} />
            </TouchableOpacity>
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 16,
                color: T.text,
                flex: 1,
                textAlign: "right",
              }}
            >
              اختر الدولة
            </Text>
          </View>

          <View
            style={{
              padding: 14,
              borderBottomWidth: 1,
              borderBottomColor: T.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: T.surface,
                borderWidth: 1,
                borderColor: T.border,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Search size={15} color={T.muted} />
              <TextInput
                placeholder="ابحث عن دولة…"
                placeholderTextColor={T.muted}
                value={countrySearch}
                onChangeText={setCountrySearch}
                style={{
                  flex: 1,
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  color: T.text,
                  textAlign: "right",
                }}
              />
            </View>
          </View>

          <FlatList
            data={filteredCountries}
            keyExtractor={(item, i) => item.code + i}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  setSelectedCountry(item);
                  setCountryModal(false);
                  setCountrySearch("");
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: T.border,
                  backgroundColor:
                    selectedCountry.name === item.name
                      ? T.primarySoft
                      : T.surface,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 14,
                    color: T.muted,
                    marginLeft: 12,
                  }}
                >
                  {item.code}
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 14,
                    color: T.text,
                    flex: 1,
                    textAlign: "right",
                  }}
                >
                  {item.name}
                </Text>
                <Text style={{ fontSize: 22, marginLeft: 8 }}>{item.flag}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </KeyboardAvoidingAnimatedView>
  );
}
