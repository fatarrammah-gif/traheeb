import { useState, useCallback } from "react";
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
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
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
import useUpload from "@/utils/useUpload";

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
  const { addEvent } = useEventStore();
  const { user } = useAppAuthStore();
  const [upload, { loading: uploading }] = useUpload();

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

  const uploadAsset = async (asset) => {
    if (!asset) return null;
    const { url, error } = await upload({ reactNativeAsset: asset });
    if (error) throw new Error(error);
    return url;
  };

  // ── WhatsApp confirmation ──
  const sendConfirmation = useCallback(
    (eventName) => {
      if (!user?.phone) return;
      const phone = user.phone.replace(/[^0-9]/g, "");
      const msg = encodeURIComponent(
        `✅ تم إضافة الفعالية بنجاح!\n\n📋 *${eventName}*\n\nيمكنك الآن إدارة ضيوفك وإرسال الدعوات من تراحيب. 🎉`,
      );
      Linking.openURL(`whatsapp://send?phone=${phone}&text=${msg}`).catch(
        () => {},
      );
    },
    [user],
  );

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
    if (!form.venue.trim()) {
      Alert.alert("حقل مطلوب", "يرجى إدخال اسم المكان.");
      return;
    }
    setSaving(true);
    try {
      const [logoUrl, mediaUrl, qrBgUrl] = await Promise.all([
        uploadAsset(form.eventLogo),
        uploadAsset(form.invitationMedia),
        uploadAsset(form.qrBackground),
      ]);
      addEvent({
        ...form,
        capacity: parseInt(form.capacity) || 100,
        eventLogoUrl: logoUrl,
        invitationMediaUrl: mediaUrl,
        qrBackgroundUrl: qrBgUrl,
      });
      sendConfirmation(form.name);
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
    } catch {
      Alert.alert("خطأ", "حدث خطأ أثناء الحفظ. حاول مجدداً.");
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
      <StatusBar style="dark" />

      {/* ── Header ── */}
      <View
        style={{
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
        <View style={{ width: 36 }} />
        <View style={{ alignItems: "center" }}>
          <Text
            style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: T.text }}
          >
            إنشاء فعالية
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 11,
              color: T.muted,
              marginTop: 1,
            }}
          >
            ادخل تفاصيل الفعالية الجديدة
          </Text>
        </View>
        <Image
          source={{ uri: LOGO }}
          style={{ width: 52, height: 76 }}
          contentFit="contain"
        />
      </View>

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
              <Field label="الوقت">
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

          <Field label="السعة (عدد المدعوين)">
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
          disabled={saving || uploading}
          style={{
            backgroundColor: saving || uploading ? "#E88AB4" : T.primary,
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
          {saving || uploading ? (
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
    </KeyboardAvoidingAnimatedView>
  );
}
