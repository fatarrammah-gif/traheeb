import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  Users,
  UserPlus,
  ScanLine,
  MessageSquare,
  X,
  ImagePlus,
  Send,
  FileSpreadsheet,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import useEventStore from "@/store/eventStore";
import fetchToWeb from "@/__create/fetch";

/**
 * Parse an Arabic time string like "6:00 م" or "10:00 ص" into a Date
 * given an ISO date string like "2025-06-02".
 */
function parseEventDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*([صم])/);
  if (!match) return null;
  let [, h, m, period] = match;
  let hours = parseInt(h, 10);
  const minutes = parseInt(m, 10);
  if (period === "م" && hours !== 12) hours += 12;
  if (period === "ص" && hours === 12) hours = 0;
  const date = new Date(`${dateStr}T00:00:00`);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

const C = {
  bg: "#FFFFFF",
  muted: "#F9FAFB",
  fg: "#111827",
  fgMuted: "#6B7280",
  border: "#E5E7EB",
  primary: "#2563EB",
  primarySoft: "#EFF6FF",
  green: "#16A34A",
  greenSoft: "#DCFCE7",
};

const CATEGORY_COLORS = {
  Conference: { bg: "#EFF6FF", text: "#2563EB" },
  Launch: { bg: "#F5F3FF", text: "#7C3AED" },
  Workshop: { bg: "#ECFDF5", text: "#059669" },
  Meetup: { bg: "#FFF7ED", text: "#EA580C" },
  Gala: { bg: "#FFF1F2", text: "#E11D48" },
  Seminar: { bg: "#FFFBEB", text: "#D97706" },
  Other: { bg: "#F3F4F6", text: "#374151" },
};

const STATUS_CONFIG = {
  confirmed: { label: "مؤكد", dot: "#16A34A" },
  invited: { label: "مدعو", dot: "#2563EB" },
  declined: { label: "معتذر", dot: "#EF4444" },
  pending: { label: "معتذر", dot: "#EF4444" },
};

export default function EventDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { events, fetchEventDetail } = useEventStore();

  // ── Compose-message modal state ──────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  // targets: 'all' | string[] (guest IDs)
  const [msgTargets, setMsgTargets] = useState("all");
  const [msgTargetName, setMsgTargetName] = useState("");
  const [msgText, setMsgText] = useState("");
  const [msgImage, setMsgImage] = useState(null); // { uri, base64, mimeType }
  const [sending, setSending] = useState(false);

  // ── Imported QR tokens summary ───────────────────────────────────────────
  const [importedSummary, setImportedSummary] = useState(null); // { total, used, remaining }

  const fetchImportedSummary = async () => {
    try {
      const res = await fetchToWeb(`/api/events/${id}/imported-qr`);
      if (!res.ok) return;
      const data = await res.json();
      setImportedSummary(data);
    } catch {}
  };

  useEffect(() => {
    fetchEventDetail(id).catch(() => {});
    fetchImportedSummary();
    // Poll every 10 seconds so guest statuses update automatically
    // when guests reply نعم / لا on WhatsApp
    const interval = setInterval(() => {
      fetchEventDetail(id).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchImportedSummary();
    }, [id])
  );

  const event = events.find((e) => e.id === id);
  if (!event) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Inter_400Regular", color: C.fgMuted }}>
          الفعالية غير موجودة.
        </Text>
      </View>
    );
  }

  const catColor = CATEGORY_COLORS[event.category] || {
    bg: C.primarySoft,
    text: C.primary,
  };
  const guestList = event.guests ?? [];
  const confirmed = guestList.filter((g) => g.status === "confirmed").length;
  const invited = guestList.filter((g) => g.status === "invited").length;

  // Show scanner button 2 hours before event start time
  const showScanner = useMemo(() => {
    const eventTime = parseEventDateTime(event.date, event.time);
    if (!eventTime) return false;
    const twoHoursBefore = new Date(eventTime.getTime() - 2 * 60 * 60 * 1000);
    return new Date() >= twoHoursBefore;
  }, [event.date, event.time]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function openModalForAll() {
    setMsgTargets("all");
    setMsgTargetName("جميع الضيوف");
    setMsgText("");
    setMsgImage(null);
    setModalVisible(true);
  }

  function openModalForGuest(guest) {
    setMsgTargets([guest.id]);
    setMsgTargetName(guest.name);
    setMsgText("");
    setMsgImage(null);
    setModalVisible(true);
  }

  function closeModal() {
    if (sending) return;
    setModalVisible(false);
    setMsgImage(null);
    setMsgText("");
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("تنبيه", "يجب منح إذن الوصول إلى المعرض");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const mimeType = asset.mimeType || "image/jpeg";
      setMsgImage({ uri: asset.uri, base64: asset.base64, mimeType });
    }
  }

  async function sendMessage() {
    if (!msgText.trim()) {
      Alert.alert("تنبيه", "يرجى كتابة نص الرسالة");
      return;
    }
    setSending(true);
    try {
      const body = {
        guestIds: msgTargets,
        text: msgText.trim(),
      };
      if (msgImage?.base64) {
        body.imageBase64 = msgImage.base64;
        body.imageMimeType = msgImage.mimeType;
      }

      const res = await fetchToWeb(`/api/events/${id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        Alert.alert("خطأ", data.error || "فشل إرسال الرسالة");
        return;
      }

      const failedCount = data.failed?.length ?? 0;
      if (failedCount > 0) {
        Alert.alert(
          "تم الإرسال جزئياً",
          `تم الإرسال لـ ${data.sent} ضيف.\nفشل الإرسال لـ ${failedCount} ضيف.`
        );
      } else {
        Alert.alert("تم", `تم إرسال الرسالة لـ ${data.sent} ضيف بنجاح`);
      }
      setModalVisible(false);
      setMsgText("");
      setMsgImage(null);
    } catch (e) {
      Alert.alert("خطأ", "حدث خطأ في الإرسال");
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.muted }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View
        style={{
          backgroundColor: C.bg,
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={C.fg} />
        </TouchableOpacity>
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 16,
            color: C.fg,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {event.name}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 80,
          gap: 12,
        }}
      >
        {/* Event Info Card */}
        <View
          style={{
            backgroundColor: C.bg,
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: 12,
            padding: 20,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_700Bold",
              fontSize: 20,
              color: C.fg,
              letterSpacing: -0.4,
              marginBottom: 8,
              textAlign: "right",
            }}
          >
            {event.name}
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginBottom: 16,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 5,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 12,
                  color: C.fgMuted,
                }}
              >
                {event.capacity} مقعد
              </Text>
              <Users size={12} color={C.fgMuted} />
            </View>
            <View
              style={{
                backgroundColor: catColor.bg,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 5,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 12,
                  color: catColor.text,
                }}
              >
                {event.category}
              </Text>
            </View>
          </View>

          <View
            style={{ height: 1, backgroundColor: C.border, marginBottom: 16 }}
          />

          {/* Meta */}
          <View style={{ gap: 10 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 11,
                    color: C.fgMuted,
                  }}
                >
                  التاريخ
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 13,
                    color: C.fg,
                  }}
                >
                  {event.date}
                </Text>
              </View>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: C.muted,
                  borderWidth: 1,
                  borderColor: C.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Calendar size={14} color={C.fgMuted} />
              </View>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 11,
                    color: C.fgMuted,
                  }}
                >
                  الوقت
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 13,
                    color: C.fg,
                  }}
                >
                  {event.time}
                </Text>
              </View>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: C.muted,
                  borderWidth: 1,
                  borderColor: C.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Clock size={14} color={C.fgMuted} />
              </View>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 11,
                    color: C.fgMuted,
                  }}
                >
                  المكان
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 13,
                    color: C.fg,
                    textAlign: "right",
                  }}
                >
                  {event.venue}، {event.location}
                </Text>
              </View>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: C.muted,
                  borderWidth: 1,
                  borderColor: C.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MapPin size={14} color={C.fgMuted} />
              </View>
            </View>
          </View>

          {event.description ? (
            <>
              <View
                style={{
                  height: 1,
                  backgroundColor: C.border,
                  marginVertical: 16,
                }}
              />
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: C.fgMuted,
                  lineHeight: 20,
                  textAlign: "right",
                }}
              >
                {event.description}
              </Text>
            </>
          ) : null}
        </View>

        {/* Stats Row */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            {
              label: "إجمالي الضيوف",
              value: guestList.length,
              color: C.primary,
            },
            { label: "مؤكد", value: confirmed, color: "#16A34A" },
            { label: "مدعو", value: invited, color: "#D97706" },
          ].map((s) => (
            <View
              key={s.label}
              style={{
                flex: 1,
                backgroundColor: C.bg,
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 12,
                padding: 14,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  fontSize: 22,
                  color: s.color,
                }}
              >
                {s.value}
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 10,
                  color: C.fgMuted,
                  marginTop: 2,
                  textAlign: "center",
                }}
              >
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Invite Button */}
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: "/(tabs)/events/invite",
              params: { eventId: event.id },
            })
          }
          style={{
            backgroundColor: C.primary,
            borderRadius: 12,
            padding: 15,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
          activeOpacity={0.85}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 14,
              color: "#FFFFFF",
            }}
          >
            دعوة من جهات الاتصال
          </Text>
          <UserPlus size={18} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Import QR Codes Button */}
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: "/(tabs)/events/import-qr",
              params: { eventId: event.id },
            })
          }
          style={{
            backgroundColor: C.muted,
            borderRadius: 12,
            padding: 15,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderWidth: 1,
            borderColor: C.border,
          }}
          activeOpacity={0.85}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 14,
              color: C.fg,
            }}
          >
            استيراد رموز QR
            {importedSummary?.total > 0
              ? ` (${importedSummary.remaining}/${importedSummary.total} متبقي)`
              : ""}
          </Text>
          <FileSpreadsheet size={18} color={C.fg} />
        </TouchableOpacity>

        {/* Scanner Button — visible 2h before event */}
        {showScanner && (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/(tabs)/events/scanner",
                params: { eventId: event.id },
              })
            }
            style={{
              backgroundColor: "#1A0910",
              borderRadius: 12,
              padding: 15,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderWidth: 1,
              borderColor: "#E6D06A",
            }}
            activeOpacity={0.85}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
                color: "#E6D06A",
              }}
            >
              مسح رموز QR عند الدخول
            </Text>
            <ScanLine size={18} color="#E6D06A" />
          </TouchableOpacity>
        )}

        {/* Guest List */}
        {guestList.length > 0 && (
          <View
            style={{
              backgroundColor: C.bg,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* List header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: C.border,
              }}
            >
              {/* Send to all button */}
              <TouchableOpacity
                onPress={openModalForAll}
                activeOpacity={0.75}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  backgroundColor: C.greenSoft,
                  borderWidth: 1,
                  borderColor: "#BBF7D0",
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 12,
                    color: C.green,
                  }}
                >
                  رسالة للكل
                </Text>
                <MessageSquare size={13} color={C.green} />
              </TouchableOpacity>

              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                  color: C.fg,
                }}
              >
                قائمة الضيوف
              </Text>
            </View>

            {guestList.map((guest, i) => {
              const sc = STATUS_CONFIG[guest.status] || STATUS_CONFIG.pending;
              return (
                <View
                  key={guest.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 13,
                    borderBottomWidth: i < guestList.length - 1 ? 1 : 0,
                    borderBottomColor: C.border,
                  }}
                >
                  {/* Per-guest message button */}
                  <TouchableOpacity
                    onPress={() => openModalForGuest(guest)}
                    activeOpacity={0.7}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      backgroundColor: C.muted,
                      borderWidth: 1,
                      borderColor: C.border,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 6,
                    }}
                  >
                    <MessageSquare size={14} color={C.fgMuted} />
                  </TouchableOpacity>

                  {/* Companions tag */}
                  {(guest.companions || 0) > 0 && (
                    <View
                      style={{
                        borderWidth: 1,
                        borderColor: "#E6D06A",
                        borderRadius: 999,
                        paddingHorizontal: 9,
                        paddingVertical: 4,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        marginRight: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Inter_500Medium",
                          fontSize: 11,
                          color: "#A07810",
                        }}
                      >
                        {guest.companions} مرافق
                      </Text>
                    </View>
                  )}

                  {/* Status pill */}
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: C.border,
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      marginHorizontal: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: sc.dot,
                      }}
                    />
                    <Text
                      style={{
                        fontFamily: "Inter_500Medium",
                        fontSize: 11,
                        color: C.fgMuted,
                      }}
                    >
                      {sc.label}
                    </Text>
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text
                      style={{
                        fontFamily: "Inter_500Medium",
                        fontSize: 13,
                        color: C.fg,
                        textAlign: "right",
                      }}
                    >
                      {guest.name}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 11,
                        color: C.fgMuted,
                      }}
                    >
                      {guest.ticketId}
                    </Text>
                  </View>

                  {/* Avatar */}
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      backgroundColor: C.primarySoft,
                      borderWidth: 1,
                      borderColor: "#BFDBFE",
                      alignItems: "center",
                      justifyContent: "center",
                      marginLeft: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 13,
                        color: C.primary,
                      }}
                    >
                      {guest.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {guestList.length === 0 && (
          <View
            style={{
              backgroundColor: C.bg,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 12,
              padding: 32,
              alignItems: "center",
            }}
          >
            <Users size={36} color={C.border} />
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 14,
                color: C.fgMuted,
                marginTop: 12,
              }}
            >
              لا يوجد ضيوف بعد
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                color: C.fgMuted,
                marginTop: 4,
                textAlign: "center",
              }}
            >
              اضغط على "دعوة من جهات الاتصال" لإضافة الضيوف وإرسال الدعوات عبر
              واتساب.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Compose Message Modal ───────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          {/* Backdrop */}
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
            activeOpacity={1}
            onPress={closeModal}
          />

          {/* Sheet */}
          <View
            style={{
              backgroundColor: C.bg,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: insets.bottom + 24,
              gap: 16,
            }}
          >
            {/* Modal header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <TouchableOpacity onPress={closeModal} activeOpacity={0.7}>
                <X size={20} color={C.fgMuted} />
              </TouchableOpacity>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 15,
                  color: C.fg,
                  textAlign: "right",
                }}
              >
                رسالة واتساب لـ {msgTargetName}
              </Text>
            </View>

            {/* Text input */}
            <TextInput
              value={msgText}
              onChangeText={setMsgText}
              placeholder="اكتب رسالتك هنا..."
              placeholderTextColor={C.fgMuted}
              multiline
              textAlign="right"
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                color: C.fg,
                backgroundColor: C.muted,
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 10,
                padding: 14,
                minHeight: 110,
                textAlignVertical: "top",
              }}
            />

            {/* Image preview */}
            {msgImage && (
              <View style={{ position: "relative", alignSelf: "flex-end" }}>
                <Image
                  source={{ uri: msgImage.uri }}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: C.border,
                  }}
                />
                <TouchableOpacity
                  onPress={() => setMsgImage(null)}
                  style={{
                    position: "absolute",
                    top: -8,
                    left: -8,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: "#EF4444",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            {/* Bottom row: attach image + send */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              {/* Send button */}
              <TouchableOpacity
                onPress={sendMessage}
                disabled={sending}
                style={{
                  flex: 1,
                  backgroundColor: sending ? "#93C5FD" : C.primary,
                  borderRadius: 10,
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
                activeOpacity={0.85}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text
                      style={{
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 14,
                        color: "#fff",
                      }}
                    >
                      إرسال
                    </Text>
                    <Send size={16} color="#fff" />
                  </>
                )}
              </TouchableOpacity>

              {/* Attach image button */}
              <TouchableOpacity
                onPress={pickImage}
                disabled={sending}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  backgroundColor: C.muted,
                  borderWidth: 1,
                  borderColor: C.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                activeOpacity={0.75}
              >
                <ImagePlus size={20} color={msgImage ? C.primary : C.fgMuted} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
