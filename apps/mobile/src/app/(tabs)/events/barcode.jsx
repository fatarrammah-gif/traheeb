import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Linking,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { ArrowLeft, Share2, Send, Copy } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
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

const STATUS_CONFIG = {
  confirmed: { label: "مؤكد", dot: "#16A34A" },
  invited: { label: "مدعو", dot: "#2563EB" },
  pending: { label: "معلق", dot: "#D97706" },
};

export default function BarcodeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { eventId, guestId } = useLocalSearchParams();
  const { events } = useEventStore();

  const event = events.find((e) => e.id === eventId);
  const guest = event?.guests.find((g) => g.id === guestId);

  if (!event || !guest) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: C.bg,
        }}
      >
        <Text style={{ fontFamily: "Inter_400Regular", color: C.fgMuted }}>
          التذكرة غير موجودة.
        </Text>
      </View>
    );
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${guest.ticketId}&bgcolor=ffffff&color=111827&margin=2`;
  const sc = STATUS_CONFIG[guest.status] || STATUS_CONFIG.pending;

  const sendViaWhatsApp = () => {
    const phone = guest.phone.replace(/[^0-9]/g, "");
    const msg = encodeURIComponent(
      `مرحباً ${guest.name}! 🎉\n\nإليك تذكرتك لفعالية *${event.name}*.\n\n📅 ${event.date} في ${event.time}\n📍 ${event.venue}، ${event.location}\n\n🎟 رقم التذكرة: *${guest.ticketId}*\n\nرمز QR: ${qrUrl}\n\nيرجى إظهاره عند المدخل. نراك هناك!`,
    );
    Linking.openURL(`whatsapp://send?phone=${phone}&text=${msg}`).catch(() =>
      Alert.alert("واتساب غير متاح", "يرجى تثبيت واتساب لمشاركة هذه التذكرة."),
    );
  };

  const copyTicketId = async () => {
    await Clipboard.setStringAsync(guest.ticketId);
    Alert.alert("تم النسخ!", `تم نسخ رقم التذكرة ${guest.ticketId}.`);
  };

  const shareTicket = async () => {
    await Share.share({
      message: `🎟 تذكرة ${guest.name} لفعالية ${event.name}\n\nرقم التذكرة: ${guest.ticketId}\nالتاريخ: ${event.date} في ${event.time}\nالمكان: ${event.venue}\n\nرمز QR: ${qrUrl}`,
      title: `تذكرة — ${event.name}`,
    });
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
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 16,
              color: C.fg,
              textAlign: "right",
            }}
          >
            التذكرة
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 11,
              color: C.fgMuted,
              marginTop: 2,
              textAlign: "right",
            }}
          >
            {guest.name}
          </Text>
        </View>
        <TouchableOpacity onPress={shareTicket} activeOpacity={0.7}>
          <Share2 size={20} color={C.fgMuted} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View
        style={{
          flex: 1,
          padding: 20,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Ticket Card */}
        <View
          style={{
            backgroundColor: C.bg,
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: 16,
            width: "100%",
            overflow: "hidden",
          }}
        >
          {/* Ticket Top */}
          <View style={{ backgroundColor: C.fg, padding: 20 }}>
            <Text
              style={{
                fontFamily: "Inter_700Bold",
                fontSize: 18,
                color: "#FFFFFF",
                letterSpacing: -0.4,
                marginBottom: 4,
                textAlign: "right",
              }}
              numberOfLines={2}
            >
              {event.name}
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                color: "#9CA3AF",
                textAlign: "right",
              }}
            >
              {event.date} · {event.time}
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                color: "#9CA3AF",
                marginTop: 2,
                textAlign: "right",
              }}
            >
              {event.venue}، {event.location}
            </Text>
          </View>

          {/* Dashed Tear Line */}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: C.muted,
                marginLeft: -10,
                borderWidth: 1,
                borderColor: C.border,
              }}
            />
            <View
              style={{
                flex: 1,
                borderTopWidth: 1,
                borderTopColor: C.border,
                borderStyle: "dashed",
              }}
            />
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: C.muted,
                marginRight: -10,
                borderWidth: 1,
                borderColor: C.border,
              }}
            />
          </View>

          {/* QR Code Section */}
          <View style={{ padding: 28, alignItems: "center" }}>
            {/* Guest info */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                marginBottom: 24,
                width: "100%",
              }}
            >
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
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 15,
                    color: C.fg,
                    textAlign: "right",
                  }}
                >
                  {guest.name}
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                    color: C.fgMuted,
                    textAlign: "right",
                  }}
                >
                  {guest.phone}
                </Text>
              </View>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  backgroundColor: C.primarySoft,
                  borderWidth: 1,
                  borderColor: "#BFDBFE",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_700Bold",
                    fontSize: 16,
                    color: C.primary,
                  }}
                >
                  {guest.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            </View>

            {/* QR Code */}
            <View
              style={{
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 12,
                padding: 12,
                backgroundColor: C.bg,
                marginBottom: 20,
              }}
            >
              <Image
                source={{ uri: qrUrl }}
                style={{ width: 220, height: 220, borderRadius: 4 }}
                contentFit="contain"
                placeholder={{ color: C.muted }}
              />
            </View>

            {/* Ticket ID */}
            <TouchableOpacity
              onPress={copyTicketId}
              style={{
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: C.muted,
              }}
              activeOpacity={0.7}
            >
              <Copy size={14} color={C.fgMuted} />
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 15,
                  color: C.fg,
                  letterSpacing: 1,
                }}
              >
                {guest.ticketId}
              </Text>
            </TouchableOpacity>

            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 11,
                color: C.fgMuted,
                marginTop: 8,
              }}
            >
              اضغط لنسخ رقم التذكرة
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={{ width: "100%", gap: 10, marginTop: 16 }}>
          <TouchableOpacity
            onPress={sendViaWhatsApp}
            style={{
              backgroundColor: "#16A34A",
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
                color: "#FFF",
              }}
            >
              إرسال عبر واتساب
            </Text>
            <Send size={17} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={shareTicket}
            style={{
              backgroundColor: C.bg,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 12,
              padding: 14,
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
                color: C.fg,
              }}
            >
              مشاركة التذكرة
            </Text>
            <Share2 size={16} color={C.fg} />
          </TouchableOpacity>
        </View>

        <View style={{ height: insets.bottom + 20 }} />
      </View>
    </View>
  );
}
