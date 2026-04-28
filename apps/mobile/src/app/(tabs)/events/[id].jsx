import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  Users,
  UserPlus,
  QrCode,
  Send,
} from "lucide-react-native";
import useEventStore from "@/store/eventStore";

const C = {
  bg: "#FFFFFF",
  muted: "#F9FAFB",
  fg: "#111827",
  fgMuted: "#6B7280",
  border: "#E5E7EB",
  primary: "#2563EB",
  primarySoft: "#EFF6FF",
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
  pending: { label: "معلق", dot: "#D97706" },
};

export default function EventDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { events } = useEventStore();

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
  const confirmed = event.guests.filter((g) => g.status === "confirmed").length;
  const invited = event.guests.filter((g) => g.status === "invited").length;

  const sendWhatsApp = (guest) => {
    const phone = guest.phone.replace(/[^0-9]/g, "");
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${guest.ticketId}`;
    const msg = encodeURIComponent(
      `مرحباً ${guest.name}! 🎉\n\nأنت مدعو إلى *${event.name}*.\n\n📅 ${event.date} في ${event.time}\n📍 ${event.venue}، ${event.location}\n\n🎟 رقم تذكرتك: *${guest.ticketId}*\n\nامسح رمز QR من هنا: ${qrUrl}\n\nنراك هناك!`,
    );
    Linking.openURL(`whatsapp://send?phone=${phone}&text=${msg}`).catch(() =>
      Alert.alert("واتساب غير متاح", "يرجى تثبيت واتساب لإرسال الدعوات."),
    );
  };

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
              value: event.guests.length,
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

        {/* Guest List */}
        {event.guests.length > 0 && (
          <View
            style={{
              backgroundColor: C.bg,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
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
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: C.fgMuted,
                }}
              >
                {event.guests.length} ضيف
              </Text>
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

            {event.guests.map((guest, i) => {
              const sc = STATUS_CONFIG[guest.status] || STATUS_CONFIG.pending;
              return (
                <View
                  key={guest.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 13,
                    borderBottomWidth: i < event.guests.length - 1 ? 1 : 0,
                    borderBottomColor: C.border,
                  }}
                >
                  {/* Action Buttons */}
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <TouchableOpacity
                      onPress={() =>
                        router.push({
                          pathname: "/(tabs)/events/barcode",
                          params: { eventId: event.id, guestId: guest.id },
                        })
                      }
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: C.border,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: C.muted,
                      }}
                    >
                      <QrCode size={14} color={C.fgMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => sendWhatsApp(guest)}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "#BFDBFE",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: C.primarySoft,
                      }}
                    >
                      <Send size={13} color={C.primary} />
                    </TouchableOpacity>
                  </View>

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

        {event.guests.length === 0 && (
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
    </View>
  );
}
