import { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
  Dimensions,
  ActivityIndicator,
  BackHandler,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useNavigation, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { Calendar } from "react-native-calendars";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as ExpoImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import {
  ChevronDown,
  ChevronLeft,
  X,
  Clock,
  MapPin,
  ImageIcon,
  Video,
  Upload,
  Check,
  Trash2,
} from "lucide-react-native";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import useEventStore from "@/store/eventStore";
import useAppAuthStore from "@/store/appAuthStore";


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

const CATEGORIES = [
  "مؤتمر",
  "ورشة عمل",
  "إطلاق",
  "لقاء",
  "حفل",
  "ندوة",
  "أخرى",
];
const REMINDER_OPTIONS = [
  { key: "3days", label: "قبل ٣ أيام" },
  { key: "24hours", label: "قبل ٢٤ ساعة" },
];

// Time list: 6:00 ص → 11:30 م  (30-min intervals, Arabic)
const TIME_LIST = (() => {
  const list = [];
  for (let h = 6; h <= 23; h++) {
    for (let m = 0; m < 60; m += 30) {
      const period = h < 12 ? "ص" : "م";
      const h12 = h > 12 ? h - 12 : h;
      list.push(`${h12}:${m === 0 ? "00" : "30"} ${period}`);
    }
  }
  return list;
})();

const inputStyle = {
  borderWidth: 1,
  borderColor: T.border,
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontFamily: "Inter_400Regular",
  fontSize: 14,
  color: T.text,
  backgroundColor: T.surface,
  textAlign: "right",
};
const pickerRow = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  borderWidth: 1,
  borderColor: T.border,
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 13,
  backgroundColor: T.surface,
};

function Field({ label, required, children }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 12,
          color: T.text,
          textAlign: "right",
          marginBottom: 7,
        }}
      >
        {label}
        {required && <Text style={{ color: "#EF4444" }}> *</Text>}
      </Text>
      {children}
    </View>
  );
}

function SectionCard({ title, children }) {
  return (
    <View
      style={{
        backgroundColor: T.surface,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 14,
        padding: 18,
        marginBottom: 14,
      }}
    >
      {title && (
        <Text
          style={{
            fontFamily: "Inter_700Bold",
            fontSize: 13,
            color: T.primary,
            textAlign: "right",
            marginBottom: 16,
          }}
        >
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

export default function CreateEvent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { createEvent } = useEventStore();
  const { user } = useAppAuthStore();
  const [form, setForm] = useState({
    name: "",
    date: "",
    time: "",
    category: "مؤتمر",
    capacity: "",
    venue: "",
    location: "",
    mapCoords: null,
    invitationText: "",
    reminder: "24hours",
    eventLogo: null,
    invitationMedia: null,
    qrBackground: null,
  });
  const update = useCallback(
    (key, val) => setForm((f) => ({ ...f, [key]: val })),
    [],
  );

  const [calOpen, setCalOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Mark form dirty when any field has user input
  useEffect(() => {
    const dirty = !!(
      form.name.trim() ||
      form.date ||
      form.time ||
      form.venue.trim() ||
      form.capacity
    );
    setIsDirty(dirty);
  }, [form.name, form.date, form.time, form.venue, form.capacity]);

  // Leave confirmation modal state
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const pendingLeaveAction = useRef(null); // called only on confirmed leave

  const FORM_RESET = {
    name: "", date: "", time: "", category: "مؤتمر",
    capacity: "", venue: "", location: "", mapCoords: null,
    invitationText: "", reminder: "24hours",
    eventLogo: null, invitationMedia: null, qrBackground: null,
  };

  // "Stay here" — just close the modal, everything stays
  const handleStay = useCallback(() => {
    setLeaveModalVisible(false);
    pendingLeaveAction.current = null;
    // If blur fired (user switched tab), navigate back to create
    router.push("/(tabs)/create");
  }, [router]);

  // "Leave" — reset form then execute pending navigation
  const doLeave = useCallback(() => {
    setLeaveModalVisible(false);
    setForm(FORM_RESET);
    setIsDirty(false);
    const action = pendingLeaveAction.current;
    pendingLeaveAction.current = null;
    action?.();
  }, []);

  // Gate for any outbound navigation: shows modal if dirty
  const requestLeave = useCallback(
    (onConfirmedLeave) => {
      if (!isDirty) {
        onConfirmedLeave?.();
        return;
      }
      pendingLeaveAction.current = onConfirmedLeave ?? null;
      setLeaveModalVisible(true);
    },
    [isDirty],
  );

  // Leave guard: intercept Android back + tab switches
  useFocusEffect(
    useCallback(() => {
      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (isDirty) {
            pendingLeaveAction.current = () => router.back();
            setLeaveModalVisible(true);
            return true; // prevent default back
          }
          return false;
        },
      );

      const blurUnsub = navigation.addListener("blur", () => {
        if (isDirty) {
          // user already navigated away; on "stay" we'll push back
          pendingLeaveAction.current = null;
          setLeaveModalVisible(true);
        }
      });

      return () => {
        backHandler.remove();
        blurUnsub();
      };
    }, [isDirty, navigation, router]),
  );

  const [mapRegion, setMapRegion] = useState({
    latitude: 24.7136,
    longitude: 46.6753,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [markerCoords, setMarkerCoords] = useState(null);

  const today = new Date().toISOString().split("T")[0];

  // ── Locate me ──
  const locateMe = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "الإذن مرفوض",
          "يرجى السماح بالوصول إلى الموقع في الإعدادات.",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = pos.coords;
      setMapRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      setMarkerCoords({ latitude, longitude });
      const [place] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      if (place) {
        const addr = [place.street, place.district, place.city, place.country]
          .filter(Boolean)
          .join("، ");
        update("location", addr);
      }
    } catch {
      Alert.alert("خطأ", "تعذر تحديد موقعك الحالي.");
    } finally {
      setLocating(false);
    }
  };

  const confirmMap = async () => {
    if (!markerCoords) {
      Alert.alert("", "اضغط على الخريطة لتحديد الموقع.");
      return;
    }
    try {
      const [place] = await Location.reverseGeocodeAsync(markerCoords);
      if (place) {
        const addr = [place.street, place.district, place.city, place.country]
          .filter(Boolean)
          .join("، ");
        update("location", addr);
        if (!form.venue) update("venue", place.city || addr);
      }
      update("mapCoords", markerCoords);
    } catch {}
    setMapOpen(false);
  };

  // ── Pick media ──
  const pickMedia = async (mediaType, formKey) => {
    const MAX = 500 * 1024 * 1024;
    const opts = {
      mediaTypes:
        mediaType === "video"
          ? ExpoImagePicker.MediaTypeOptions.Videos
          : ExpoImagePicker.MediaTypeOptions.Images,
      allowsEditing: formKey !== "invitationMedia",
      quality: formKey === "qrBackground" ? 1 : 0.85,
    };
    const res = await ExpoImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled) return;
    const asset = res.assets[0];
    if (asset.fileSize && asset.fileSize > MAX) {
      Alert.alert("الملف كبير جداً", "الحد الأقصى ٥٠٠ ميغابايت.");
      return;
    }
    update(formKey, asset);
  };

  const uploadAsset = (asset) => new Promise((resolve, reject) => {
    if (!asset) return resolve(null);
    const publicKey = process.env.EXPO_PUBLIC_UPLOADCARE_PUBLIC_KEY;
    if (!publicKey) return resolve(null);

    const formData = new FormData();
    formData.append('UPLOADCARE_PUB_KEY', publicKey);
    formData.append('UPLOADCARE_STORE', 'auto');
    formData.append('file', {
      uri: asset.uri,
      name: asset.fileName || asset.uri.split('/').pop() || 'upload',
      type: asset.mimeType || 'application/octet-stream',
    });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://upload.uploadcare.com/base/');
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.file) {
          resolve(`https://ucarecdn.com/${data.file}/`);
        } else {
          reject(new Error(`Upload failed: ${xhr.status} — ${xhr.responseText}`));
        }
      } catch {
        reject(new Error('Upload failed: invalid response'));
      }
    };
    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.send(formData);
  });


  // ── Save ──
  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert("حقل مطلوب", "يرجى إدخال اسم الفعالية.");
      return;
    }
    if (!form.date) {
      Alert.alert("حقل مطلوب", "يرجى اختيار التاريخ من التقويم.");
      return;
    }
    if (!form.time) {
      Alert.alert("حقل مطلوب", "يرجى اختيار وقت الفعالية.");
      return;
    }
    if (!form.venue.trim()) {
      Alert.alert("حقل مطلوب", "يرجى إدخال اسم المكان.");
      return;
    }
    if (!form.capacity.trim()) {
      Alert.alert("حقل مطلوب", "يرجى إدخال عدد المدعوين.");
      return;
    }
    setSaving(true);
    try {
      const [logoUrl, mediaUrl, qrBgUrl] = await Promise.all([
        uploadAsset(form.eventLogo),
        uploadAsset(form.invitationMedia),
        uploadAsset(form.qrBackground),
      ]);
      await createEvent({
        name: form.name,
        date: form.date,
        time: form.time,
        category: form.category,
        capacity: parseInt(form.capacity) || 100,
        venue: form.venue,
        location: form.location || null,
        map_lat: form.mapCoords?.latitude ?? null,
        map_lng: form.mapCoords?.longitude ?? null,
        invitation_text: form.invitationText || null,
        reminder: form.reminder,
        event_logo_url: logoUrl ?? null,
        invitation_media_url: mediaUrl ?? null,
        qr_background_url: qrBgUrl ?? null,
      });
      setIsDirty(false);
      Alert.alert("تمت الإضافة! 🎉", `تم حفظ "${form.name}" بنجاح.`, [
        { text: "عرض الفعاليات", onPress: () => router.push("/(tabs)/events") },
        { text: "إنشاء أخرى", style: "cancel" },
      ]);
      setForm({
        name: "",
        date: "",
        time: "",
        category: "مؤتمر",
        capacity: "",
        venue: "",
        location: "",
        mapCoords: null,
        invitationText: "",
        reminder: "24hours",
        eventLogo: null,
        invitationMedia: null,
        qrBackground: null,
      });
    } catch (err) {
      console.error('[Save event]', err?.message, err);
      Alert.alert("خطأ", err?.message || "حدث خطأ أثناء الحفظ. حاول مجدداً.");
    } finally {
      setSaving(false);
    }
  };

  // ── Media picker button component ──
  function MediaBtn({ formKey, acceptVideo }) {
    const val = form[formKey];
    const isVideo = val?.type === "video" || val?.mimeType?.startsWith("video");
    if (val) {
      return (
        <View
          style={{
            borderWidth: 1,
            borderColor: T.border,
            borderRadius: 10,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {isVideo ? (
            <View
              style={{
                height: 100,
                backgroundColor: "#111",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Video size={32} color="#FFF" />
              <Text
                style={{
                  color: "#FFF",
                  fontFamily: "Inter_500Medium",
                  fontSize: 11,
                  marginTop: 6,
                }}
              >
                {val.fileName || "ملف فيديو"}
              </Text>
            </View>
          ) : (
            <Image
              source={{ uri: val.uri }}
              style={{ width: "100%", height: 110, borderRadius: 10 }}
              contentFit="cover"
            />
          )}
          <TouchableOpacity
            onPress={() => update(formKey, null)}
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              backgroundColor: "#EF4444",
              borderRadius: 999,
              padding: 5,
            }}
          >
            <Trash2 size={13} color="#FFF" />
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TouchableOpacity
          onPress={() => pickMedia("image", formKey)}
          style={{
            flex: 1,
            borderWidth: 1.5,
            borderColor: T.border,
            borderRadius: 10,
            paddingVertical: 16,
            alignItems: "center",
            gap: 7,
            backgroundColor: T.primarySoft,
          }}
          activeOpacity={0.7}
        >
          <ImageIcon size={22} color={T.primary} />
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 12,
              color: T.primary,
            }}
          >
            صورة
          </Text>
        </TouchableOpacity>
        {acceptVideo && (
          <TouchableOpacity
            onPress={() => pickMedia("video", formKey)}
            style={{
              flex: 1,
              borderWidth: 1.5,
              borderColor: "#E6D06A",
              borderRadius: 10,
              paddingVertical: 16,
              alignItems: "center",
              gap: 7,
              backgroundColor: T.accentSoft,
            }}
            activeOpacity={0.7}
          >
            <Video size={22} color={T.accent} />
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 12,
                color: T.accent,
              }}
            >
              فيديو
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingAnimatedView
      style={{ flex: 1, backgroundColor: T.bg }}
      behavior="padding"
    >
      <StatusBar style="light" />

      {/* ── Header ── */}
      <View
        style={{
          overflow: "hidden",
          shadowColor: "#1E000E",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 14,
          elevation: 14,
        }}
      >
        <LinearGradient
          colors={["#1E000E", "#55002F", "#8A004F"]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + 10,
            paddingHorizontal: 20,
            paddingBottom: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ width: 70 }} />
          <View style={{ alignItems: "center" }}>
            <Text
              style={{ fontFamily: "Inter_700Bold", fontSize: 22, color: "#FFFFFF" }}
            >
              إنشاء فعالية
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 11,
                color: "rgba(255,255,255,0.72)",
                marginTop: 2,
              }}
            >
              ادخل تفاصيل الفعالية الجديدة
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => requestLeave(() => router.replace("/(tabs)"))}
          >
            <Image
              source={require("../../../white_logo.png")}
              style={{ width: 70, height: 105 }}
              contentFit="contain"
            />
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Thick luxury gold separator */}
      <LinearGradient
        colors={["#8A004F", "#C8991A", "#FFD54F", "#FFC107", "#C8991A", "#8A004F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: 4 }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 110,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── تفاصيل الفعالية ── */}
        <SectionCard title="تفاصيل الفعالية">
          <Field label="اسم الفعالية" required>
            <TextInput
              style={inputStyle}
              placeholder="مثال: حفل تخرج دفعة 2025"
              placeholderTextColor={T.muted}
              value={form.name}
              onChangeText={(v) => update("name", v)}
            />
          </Field>

          {/* Date + Time */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="الوقت" required>
                <TouchableOpacity
                  style={pickerRow}
                  onPress={() => setTimeOpen(true)}
                  activeOpacity={0.8}
                >
                  <ChevronDown size={14} color={T.muted} />
                  <Text
                    style={{
                      fontFamily: form.time
                        ? "Inter_500Medium"
                        : "Inter_400Regular",
                      fontSize: 13,
                      color: form.time ? T.text : T.muted,
                    }}
                  >
                    {form.time || "اختر"}
                  </Text>
                  <Clock size={14} color={T.primary} />
                </TouchableOpacity>
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="التاريخ" required>
                <TouchableOpacity
                  style={pickerRow}
                  onPress={() => setCalOpen(true)}
                  activeOpacity={0.8}
                >
                  <ChevronDown size={14} color={T.muted} />
                  <Text
                    style={{
                      fontFamily: form.date
                        ? "Inter_500Medium"
                        : "Inter_400Regular",
                      fontSize: 12,
                      color: form.date ? T.text : T.muted,
                    }}
                  >
                    {form.date || "اختر"}
                  </Text>
                  <Text style={{ fontSize: 14 }}>📅</Text>
                </TouchableOpacity>
              </Field>
            </View>
          </View>

          {/* Category */}
          <Field label="الفئة">
            <TouchableOpacity
              style={pickerRow}
              onPress={() => setCatOpen(!catOpen)}
              activeOpacity={0.8}
            >
              <ChevronDown size={14} color={T.muted} />
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 14,
                  color: T.text,
                }}
              >
                {form.category}
              </Text>
              <View style={{ width: 14 }} />
            </TouchableOpacity>
            {catOpen && (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: T.border,
                  borderRadius: 10,
                  backgroundColor: T.surface,
                  marginTop: 6,
                  overflow: "hidden",
                }}
              >
                {CATEGORIES.map((cat, i) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => {
                      update("category", cat);
                      setCatOpen(false);
                    }}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderBottomWidth: i < CATEGORIES.length - 1 ? 1 : 0,
                      borderBottomColor: T.border,
                      backgroundColor:
                        form.category === cat ? T.primarySoft : T.surface,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 10,
                    }}
                  >
                    {form.category === cat && (
                      <Check size={14} color={T.primary} />
                    )}
                    <Text
                      style={{
                        fontFamily: "Inter_500Medium",
                        fontSize: 14,
                        color: form.category === cat ? T.primary : T.text,
                      }}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Field>

          <Field label="عدد المدعوين" required>
            <TextInput
              style={inputStyle}
              placeholder="مثال: 150"
              placeholderTextColor={T.muted}
              keyboardType="numeric"
              value={form.capacity}
              onChangeText={(v) => update("capacity", v)}
            />
          </Field>
        </SectionCard>

        {/* ── المكان ── */}
        <SectionCard title="المكان">
          <Field label="اسم القاعة / المكان" required>
            <TextInput
              style={inputStyle}
              placeholder="مثال: قاعة الملك فهد للمؤتمرات"
              placeholderTextColor={T.muted}
              value={form.venue}
              onChangeText={(v) => update("venue", v)}
            />
          </Field>

          <Field label="تحديد الموقع على الخريطة">
            <TouchableOpacity
              style={pickerRow}
              onPress={() => setMapOpen(true)}
              activeOpacity={0.8}
            >
              <ChevronLeft size={14} color={T.muted} />
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: form.location ? T.text : T.muted,
                  flex: 1,
                  textAlign: "right",
                  marginHorizontal: 8,
                }}
                numberOfLines={1}
              >
                {form.location || "اضغط لاختيار الموقع من الخريطة"}
              </Text>
              <MapPin size={16} color={T.primary} />
            </TouchableOpacity>
            {form.location ? (
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 11,
                  color: "#16A34A",
                  textAlign: "right",
                  marginTop: 5,
                }}
              >
                ✓ تم تحديد الموقع
              </Text>
            ) : null}
          </Field>
        </SectionCard>

        {/* ── نص الدعوة ── */}
        <SectionCard title="نص الدعوة">
          <Field label="رسالة الدعوة">
            <TextInput
              style={[
                inputStyle,
                {
                  height: 130,
                  textAlignVertical: "top",
                  paddingTop: 12,
                  lineHeight: 22,
                },
              ]}
              placeholder={
                "مثال:\nيسرّنا دعوتكم الكريمة لحضور ...\nونتشرف بحضوركم معنا ..."
              }
              placeholderTextColor={T.muted}
              value={form.invitationText}
              onChangeText={(v) => update("invitationText", v)}
              multiline
            />
          </Field>
        </SectionCard>

        {/* ── التذكير ── */}
        <SectionCard title="التذكير">
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              color: T.muted,
              textAlign: "right",
              marginBottom: 12,
            }}
          >
            سيُرسل تذكير للمدعوين عبر واتساب في الوقت المحدد
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              justifyContent: "flex-end",
            }}
          >
            {REMINDER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => update("reminder", opt.key)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: form.reminder === opt.key ? T.primary : T.border,
                  backgroundColor:
                    form.reminder === opt.key ? T.primarySoft : T.surface,
                }}
                activeOpacity={0.75}
              >
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 13,
                    color: form.reminder === opt.key ? T.primary : T.muted,
                  }}
                >
                  {opt.label}
                </Text>
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    borderWidth: 2,
                    borderColor:
                      form.reminder === opt.key ? T.primary : T.borderDark,
                    backgroundColor:
                      form.reminder === opt.key ? T.primary : T.surface,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {form.reminder === opt.key && (
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: "#FFF",
                      }}
                    />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </SectionCard>

        {/* ── وسائط الدعوة ── */}
        <SectionCard title="وسائط الدعوة">
          {/* Event Logo */}
          <Field label="شعار الفعالية">
            <MediaBtn formKey="eventLogo" acceptVideo={false} />
          </Field>

          {/* Invitation media */}
          <Field label="صورة أو فيديو الدعوة">
            <MediaBtn formKey="invitationMedia" acceptVideo />
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 10,
                color: T.muted,
                textAlign: "right",
                marginTop: 5,
              }}
            >
              الحد الأقصى ٥٠٠ ميغابايت
            </Text>
          </Field>

          {/* QR background */}
          <Field label="خلفية رمز QR">
            <MediaBtn formKey="qrBackground" acceptVideo={false} />
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 10,
                color: T.muted,
                textAlign: "right",
                marginTop: 5,
              }}
            >
              يُفضّل صورة مربعة بدقة عالية
            </Text>
          </Field>
        </SectionCard>

        {/* ── Save Button ── */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{
            backgroundColor: saving ? "#E88AB4" : T.primary,
            borderRadius: 14,
            padding: 17,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 10,
            marginTop: 4,
          }}
          activeOpacity={0.85}
        >
          {saving ? (
            <>
              <ActivityIndicator color="#FFF" size="small" />
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  color: "#FFF",
                }}
              >
                جاري الحفظ…
              </Text>
            </>
          ) : (
            <>
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  fontSize: 16,
                  color: "#FFF",
                }}
              >
                حفظ الفعالية
              </Text>
              <Upload size={18} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 11,
            color: T.muted,
            textAlign: "center",
            marginTop: 10,
            lineHeight: 17,
          }}
        >
          سيصلك تأكيل واتساب فور الحفظ الناجح
        </Text>
      </ScrollView>

      {/* ════════ CALENDAR MODAL ════════ */}
      <Modal visible={calOpen} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(26,9,16,0.45)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: T.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: insets.bottom + 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: T.border,
              }}
            >
              <TouchableOpacity onPress={() => setCalOpen(false)}>
                <X size={22} color={T.text} />
              </TouchableOpacity>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  color: T.text,
                }}
              >
                اختر التاريخ
              </Text>
              <View style={{ width: 22 }} />
            </View>
            <Calendar
              minDate={today}
              onDayPress={(day) => {
                update("date", day.dateString);
                setCalOpen(false);
              }}
              markedDates={
                form.date
                  ? {
                      [form.date]: { selected: true, selectedColor: T.primary },
                    }
                  : {}
              }
              enableSwipeMonths
              theme={{
                backgroundColor: T.surface,
                calendarBackground: T.surface,
                selectedDayBackgroundColor: T.primary,
                selectedDayTextColor: "#FFF",
                todayTextColor: T.primary,
                dayTextColor: T.text,
                textDisabledColor: T.border,
                arrowColor: T.primary,
                monthTextColor: T.text,
                textDayFontFamily: "Inter_400Regular",
                textMonthFontFamily: "Inter_600SemiBold",
                textDayHeaderFontFamily: "Inter_500Medium",
                textDayFontSize: 14,
                textMonthFontSize: 16,
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ════════ TIME MODAL ════════ */}
      <Modal visible={timeOpen} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(26,9,16,0.45)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: T.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: height * 0.55,
              paddingBottom: insets.bottom + 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: T.border,
              }}
            >
              <TouchableOpacity onPress={() => setTimeOpen(false)}>
                <X size={22} color={T.text} />
              </TouchableOpacity>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  color: T.text,
                }}
              >
                اختر الوقت
              </Text>
              <Clock size={18} color={T.primary} />
            </View>
            <FlatList
              data={TIME_LIST}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    update("time", item);
                    setTimeOpen(false);
                  }}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 15,
                    borderBottomWidth: 1,
                    borderBottomColor: T.border,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor:
                      form.time === item ? T.primarySoft : T.surface,
                  }}
                >
                  {form.time === item && <Check size={16} color={T.primary} />}
                  <Text
                    style={{
                      fontFamily:
                        form.time === item
                          ? "Inter_700Bold"
                          : "Inter_400Regular",
                      fontSize: 17,
                      color: form.time === item ? T.primary : T.text,
                    }}
                  >
                    {item}
                  </Text>
                  <Clock
                    size={14}
                    color={form.time === item ? T.primary : T.border}
                  />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ════════ MAP MODAL ════════ */}
      <Modal visible={mapOpen} animationType="slide">
        <View style={{ flex: 1 }}>
          {/* Map Header */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              backgroundColor: T.surface,
              paddingTop: insets.top + 8,
              paddingHorizontal: 20,
              paddingBottom: 14,
              borderBottomWidth: 1,
              borderBottomColor: T.border,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <TouchableOpacity onPress={() => setMapOpen(false)}>
              <X size={22} color={T.text} />
            </TouchableOpacity>
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 15,
                color: T.text,
              }}
            >
              اختر الموقع
            </Text>
            <TouchableOpacity
              onPress={locateMe}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: T.primarySoft,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 7,
              }}
            >
              {locating ? (
                <ActivityIndicator size="small" color={T.primary} />
              ) : (
                <MapPin size={14} color={T.primary} />
              )}
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 12,
                  color: T.primary,
                }}
              >
                موقعي
              </Text>
            </TouchableOpacity>
          </View>

          <MapView
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            region={mapRegion}
            onPress={(e) => setMarkerCoords(e.nativeEvent.coordinate)}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {markerCoords && (
              <Marker coordinate={markerCoords} pinColor={T.primary} />
            )}
          </MapView>

          {/* Hint overlay */}
          {!markerCoords && (
            <View
              style={{
                position: "absolute",
                bottom: insets.bottom + 90,
                left: 0,
                right: 0,
                alignItems: "center",
                pointerEvents: "none",
              }}
            >
              <View
                style={{
                  backgroundColor: "rgba(0,0,0,0.65)",
                  borderRadius: 12,
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 13,
                    color: "#FFF",
                  }}
                >
                  اضغط على الخريطة لتحديد موقع الفعالية
                </Text>
              </View>
            </View>
          )}

          {/* Confirm */}
          <View
            style={{
              position: "absolute",
              bottom: insets.bottom + 20,
              left: 20,
              right: 20,
            }}
          >
            <TouchableOpacity
              onPress={confirmMap}
              style={{
                backgroundColor: markerCoords ? T.primary : "#CBD5E1",
                borderRadius: 14,
                padding: 16,
                alignItems: "center",
              }}
              activeOpacity={0.85}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 15,
                  color: "#FFF",
                }}
              >
                {markerCoords ? "تأكيد الموقع" : "اضغط على الخريطة أولاً"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ════════ LEAVE CONFIRMATION MODAL ════════ */}
      <Modal visible={leaveModalVisible} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(26,9,16,0.6)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 28,
          }}
        >
          <View
            style={{
              backgroundColor: T.surface,
              borderRadius: 22,
              padding: 28,
              width: "100%",
              alignItems: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 24,
              elevation: 24,
            }}
          >
            {/* Icon */}
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: "#FFF1F2",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 26 }}>⚠️</Text>
            </View>

            <Text
              style={{
                fontFamily: "Inter_700Bold",
                fontSize: 18,
                color: T.text,
                textAlign: "center",
                marginBottom: 10,
              }}
            >
              هل تريد مغادرة الصفحة؟
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                color: T.muted,
                textAlign: "center",
                lineHeight: 20,
                marginBottom: 26,
              }}
            >
              لديك بيانات لم يتم حفظها. ستُفقد جميع البيانات المدخلة عند المغادرة.
            </Text>

            {/* Buttons */}
            <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
              <TouchableOpacity
                onPress={doLeave}
                style={{
                  flex: 1,
                  borderWidth: 1.5,
                  borderColor: "#EF4444",
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 14,
                    color: "#EF4444",
                  }}
                >
                  نعم، مغادرة
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleStay}
                style={{
                  flex: 1,
                  backgroundColor: T.primary,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 14,
                    color: "#FFFFFF",
                  }}
                >
                  لا، ابقَ هنا
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingAnimatedView>
  );
}
