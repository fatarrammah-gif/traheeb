import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Contacts from "expo-contacts";
import { ArrowLeft, Search, Check, Send, Users } from "lucide-react-native";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
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

export default function InviteContacts() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { eventId } = useLocalSearchParams();
  const { events, addGuestsToEvent } = useEventStore();

  const event = events.find((e) => e.id === eventId);

  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });
      const withPhone = data
        .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0 && c.name)
        .sort((a, b) => a.name.localeCompare(b.name));
      setContacts(withPhone);
      setLoading(false);
    })();
  }, []);

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleSelect = (contact) => {
    setSelected((prev) =>
      prev.find((c) => c.id === contact.id)
        ? prev.filter((c) => c.id !== contact.id)
        : [...prev, contact],
    );
  };

  const isSelected = (contact) => !!selected.find((c) => c.id === contact.id);

  const sendInvitations = useCallback(async () => {
    if (!event || selected.length === 0) return;

    setSending(true);

    const newGuests = selected.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phoneNumbers[0].number,
    }));

    addGuestsToEvent(eventId, newGuests);

    const delay = (ms) => new Promise((res) => setTimeout(res, ms));

    for (const contact of selected) {
      const phone = contact.phoneNumbers[0].number.replace(/[^0-9]/g, "");
      const ticketId =
        "TKT-" + Math.random().toString(36).substr(2, 6).toUpperCase();
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${ticketId}`;
      const msg = encodeURIComponent(
        `مرحباً ${contact.name}! 🎉\n\nأنت مدعو إلى *${event.name}*.\n\n📅 ${event.date} في ${event.time}\n📍 ${event.venue}، ${event.location}\n\n🎟 رقم التذكرة: *${ticketId}*\nرمز QR: ${qrUrl}\n\nنراك هناك!`,
      );
      const url = `whatsapp://send?phone=${phone}&text=${msg}`;
      const canOpen = await Linking.canOpenURL(url).catch(() => false);
      if (canOpen) {
        await Linking.openURL(url);
        await delay(1200);
      }
    }

    setSending(false);
    Alert.alert(
      "تم إرسال الدعوات!",
      `تم إرسال ${selected.length} دعوة عبر واتساب.`,
      [{ text: "حسناً", onPress: () => router.back() }],
    );
  }, [event, selected, eventId, addGuestsToEvent, router]);

  if (!event) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Inter_400Regular", color: C.fgMuted }}>
          الفعالية غير موجودة.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingAnimatedView
      style={{ flex: 1, backgroundColor: C.muted }}
      behavior="padding"
    >
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
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
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
              دعوة الضيوف
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
              {event.name}
            </Text>
          </View>
          {selected.length > 0 && (
            <View
              style={{
                backgroundColor: C.primary,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 12,
                  color: "#FFF",
                }}
              >
                {selected.length} محدد
              </Text>
            </View>
          )}
        </View>

        {/* Search */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: C.muted,
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 9,
          }}
        >
          <Search size={15} color={C.fgMuted} />
          <TextInput
            placeholder="البحث في جهات الاتصال…"
            placeholderTextColor={C.fgMuted}
            value={search}
            onChangeText={setSearch}
            style={{
              flex: 1,
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: C.fg,
              textAlign: "right",
            }}
          />
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color={C.primary} />
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              color: C.fgMuted,
              marginTop: 12,
            }}
          >
            جاري تحميل جهات الاتصال…
          </Text>
        </View>
      ) : permissionDenied ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
          }}
        >
          <Users size={48} color={C.border} />
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 16,
              color: C.fg,
              marginTop: 16,
              textAlign: "center",
            }}
          >
            مطلوب إذن الوصول لجهات الاتصال
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              color: C.fgMuted,
              marginTop: 8,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            يرجى السماح بالوصول إلى جهات اتصالك في الإعدادات لتتمكن من دعوة
            الضيوف.
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            style={{
              marginTop: 20,
              backgroundColor: C.primary,
              borderRadius: 10,
              paddingHorizontal: 24,
              paddingVertical: 12,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
                color: "#FFF",
              }}
            >
              فتح الإعدادات
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Contact Count Row */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingVertical: 10,
              backgroundColor: C.muted,
              borderBottomWidth: 1,
              borderBottomColor: C.border,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 12,
                color: C.fgMuted,
                textAlign: "right",
              }}
            >
              {filtered.length} جهة اتصال برقم هاتف
            </Text>
          </View>

          {/* Contact List */}
          <View
            style={{
              backgroundColor: C.bg,
              borderBottomWidth: 1,
              borderBottomColor: C.border,
            }}
          >
            {filtered.length === 0 && (
              <View style={{ padding: 40, alignItems: "center" }}>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 13,
                    color: C.fgMuted,
                  }}
                >
                  لم يتم العثور على جهات اتصال
                </Text>
              </View>
            )}
            {filtered.map((contact, i) => {
              const sel = isSelected(contact);
              const phone = contact.phoneNumbers[0]?.number || "";
              return (
                <TouchableOpacity
                  key={contact.id}
                  onPress={() => toggleSelect(contact)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    paddingVertical: 13,
                    borderBottomWidth: i < filtered.length - 1 ? 1 : 0,
                    borderBottomColor: C.border,
                    backgroundColor: sel ? C.primarySoft : C.bg,
                  }}
                >
                  {/* Selected indicator */}
                  {sel && (
                    <View
                      style={{
                        backgroundColor: C.primarySoft,
                        borderWidth: 1,
                        borderColor: "#BFDBFE",
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        marginRight: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Inter_500Medium",
                          fontSize: 11,
                          color: C.primary,
                        }}
                      >
                        محدد
                      </Text>
                    </View>
                  )}

                  {/* Info */}
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text
                      style={{
                        fontFamily: "Inter_500Medium",
                        fontSize: 14,
                        color: C.fg,
                        textAlign: "right",
                      }}
                    >
                      {contact.name}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 12,
                        color: C.fgMuted,
                        marginTop: 2,
                      }}
                    >
                      {phone}
                    </Text>
                  </View>

                  {/* Avatar */}
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      backgroundColor: sel ? C.primary : C.muted,
                      borderWidth: 1,
                      borderColor: sel ? C.primary : C.border,
                      alignItems: "center",
                      justifyContent: "center",
                      marginLeft: 14,
                    }}
                  >
                    {sel ? (
                      <Check size={18} color="#FFF" />
                    ) : (
                      <Text
                        style={{
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 15,
                          color: C.fgMuted,
                        }}
                      >
                        {contact.name.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Bottom Send Bar */}
      {selected.length > 0 && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: C.bg,
            borderTopWidth: 1,
            borderTopColor: C.border,
            padding: 16,
            paddingBottom: insets.bottom + 12,
          }}
        >
          <View
            style={{
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 10,
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 12,
                  color: C.fg,
                  textAlign: "right",
                }}
              >
                سيتلقى {selected.length}{" "}
                {selected.length === 1 ? "ضيف" : "ضيوف"} دعوات عبر واتساب
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
                بما في ذلك رمز QR الخاص بالتذكرة
              </Text>
            </View>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                backgroundColor: "#ECFDF5",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Send size={12} color="#16A34A" />
            </View>
          </View>
          <TouchableOpacity
            onPress={sendInvitations}
            disabled={sending}
            style={{
              backgroundColor: sending ? "#93C5FD" : C.primary,
              borderRadius: 12,
              padding: 15,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 15,
                    color: "#FFF",
                  }}
                >
                  إرسال {selected.length} دعوة عبر واتساب
                </Text>
                <Send size={16} color="#FFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingAnimatedView>
  );
}
