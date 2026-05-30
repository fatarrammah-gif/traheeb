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
import {
  ArrowLeft,
  Search,
  Check,
  Send,
  Users,
  Plus,
  Minus,
  X,
} from "lucide-react-native";
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
  const { events, inviteGuests } = useEventStore();

  const event = events.find((e) => e.id === eventId);

  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  // selectedMap: { [contactId]: { contact, displayName, companions } }
  const [selectedMap, setSelectedMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [sending, setSending] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

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

  const selectedList = Object.values(selectedMap);
  const selectedCount = selectedList.length;

  const toggleSelect = (contact) => {
    setSelectedMap((prev) => {
      if (prev[contact.id]) {
        const next = { ...prev };
        delete next[contact.id];
        return next;
      }
      return {
        ...prev,
        [contact.id]: { contact, displayName: contact.name, companions: 0 },
      };
    });
  };

  const isSelected = (contact) => !!selectedMap[contact.id];

  const updateDisplayName = (contactId, name) => {
    setSelectedMap((prev) => ({
      ...prev,
      [contactId]: { ...prev[contactId], displayName: name },
    }));
  };

  const updateCompanions = (contactId, delta) => {
    setSelectedMap((prev) => ({
      ...prev,
      [contactId]: {
        ...prev[contactId],
        companions: Math.max(0, (prev[contactId]?.companions || 0) + delta),
      },
    }));
  };

  const removeFromSelected = (contactId) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      delete next[contactId];
      return next;
    });
  };

  const sendInvitations = useCallback(async () => {
    if (!event || selectedList.length === 0) return;
    setSending(true);

    try {
      const guests = selectedList.map(({ contact, displayName, companions }) => ({
        name: displayName,
        phone: contact.phoneNumbers[0].number,
        companions,
      }));

      const result = await inviteGuests(eventId, guests);

      if (result?.whatsappDisconnected) {
        Alert.alert(
          "تم حفظ المدعوين ✓",
          "واتساب غير متصل حالياً — اربط حسابك من الإعدادات ثم ستصل الدعوات تلقائياً.",
          [
            { text: "ربط واتساب", onPress: () => router.replace("/(tabs)/whatsapp-connect") },
            { text: "لاحقاً", onPress: () => router.back() },
          ],
        );
      } else {
        Alert.alert(
          "تم إرسال الدعوات!",
          `سيتم إرسال ${selectedList.length} دعوة عبر واتساب.`,
          [{ text: "حسناً", onPress: () => router.back() }],
        );
      }
    } catch (err) {
      Alert.alert("خطأ", err.message || "تعذر إرسال الدعوات. حاول مجدداً.");
    } finally {
      setSending(false);
    }
  }, [event, selectedList, eventId, inviteGuests, router]);

  if (!event) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Inter_400Regular", color: C.fgMuted }}>
          الفعالية غير موجودة.
        </Text>
      </View>
    );
  }

  /* ══════════════════════════════════════════
     STEP 2 — REVIEW: edit names + companions
  ══════════════════════════════════════════ */
  if (reviewMode) {
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity
              onPress={() => setReviewMode(false)}
              activeOpacity={0.7}
            >
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
                مراجعة قائمة المدعوين
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
                {selectedCount} {selectedCount === 1 ? "ضيف" : "ضيوف"} — عدّل
                الأسماء وحدد عدد المرافقين
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 100,
            gap: 12,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {selectedList.map(({ contact, displayName, companions }) => (
            <View
              key={contact.id}
              style={{
                backgroundColor: C.bg,
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 14,
                padding: 16,
              }}
            >
              {/* Row header: label + remove */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    removeFromSelected(contact.id);
                    if (selectedCount === 1) setReviewMode(false);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <X size={13} color="#EF4444" />
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 12,
                      color: "#EF4444",
                    }}
                  >
                    حذف
                  </Text>
                </TouchableOpacity>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 11,
                    color: C.fgMuted,
                  }}
                >
                  اسم المدعو
                </Text>
              </View>

              {/* Editable name */}
              <TextInput
                value={displayName}
                onChangeText={(v) => updateDisplayName(contact.id, v)}
                style={{
                  borderWidth: 1,
                  borderColor: C.border,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  color: C.fg,
                  textAlign: "right",
                  backgroundColor: C.muted,
                  marginBottom: 8,
                }}
              />

              {/* Phone */}
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 11,
                  color: C.fgMuted,
                  textAlign: "right",
                  marginBottom: 16,
                }}
              >
                {contact.phoneNumbers[0]?.number}
              </Text>

              {/* Companions counter */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: C.muted,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 18,
                  }}
                >
                  {/* Plus */}
                  <TouchableOpacity
                    onPress={() => updateCompanions(contact.id, 1)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: C.primarySoft,
                      borderWidth: 1,
                      borderColor: "#BFDBFE",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    activeOpacity={0.7}
                  >
                    <Plus size={16} color={C.primary} />
                  </TouchableOpacity>

                  {/* Count */}
                  <Text
                    style={{
                      fontFamily: "Inter_700Bold",
                      fontSize: 20,
                      color: C.fg,
                      minWidth: 28,
                      textAlign: "center",
                    }}
                  >
                    {companions}
                  </Text>

                  {/* Minus */}
                  <TouchableOpacity
                    onPress={() => updateCompanions(contact.id, -1)}
                    disabled={companions === 0}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: companions === 0 ? C.muted : "#FEF2F2",
                      borderWidth: 1,
                      borderColor:
                        companions === 0 ? C.border : "#FECACA",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    activeOpacity={0.7}
                  >
                    <Minus
                      size={16}
                      color={companions === 0 ? C.fgMuted : "#EF4444"}
                    />
                  </TouchableOpacity>
                </View>

                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 13,
                    color: C.fgMuted,
                  }}
                >
                  عدد المرافقين
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Bottom Send */}
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
                  إرسال {selectedCount} دعوة عبر واتساب
                </Text>
                <Send size={16} color="#FFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingAnimatedView>
    );
  }

  /* ══════════════════════════════════════════
     STEP 1 — SELECT CONTACTS
  ══════════════════════════════════════════ */
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
          {selectedCount > 0 && (
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
                {selectedCount} محدد
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
                  {/* Selected pill */}
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

      {/* Bottom bar — opens review step */}
      {selectedCount > 0 && (
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
          <TouchableOpacity
            onPress={() => setReviewMode(true)}
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
                fontSize: 15,
                color: "#FFF",
              }}
            >
              مراجعة وإرسال ({selectedCount})
            </Text>
            <Send size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingAnimatedView>
  );
}
