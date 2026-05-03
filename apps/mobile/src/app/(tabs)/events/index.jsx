import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Search,
  Calendar,
  MapPin,
  Users,
  ChevronRight,
} from "lucide-react-native";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import useEventStore from "@/store/eventStore";

const C = {
  bg: "#FFFFFF",
  muted: "#FFF5F9",
  fg: "#1A0910",
  fgMuted: "#7A5568",
  border: "#F2E0EB",
  primary: "#C8005A",
  primarySoft: "#FFF0F7",
};

const CATEGORY_COLORS = {
  مؤتمر: { bg: "#FFF0F7", text: "#C8005A" },
  إطلاق: { bg: "#F5F3FF", text: "#7C3AED" },
  "ورشة عمل": { bg: "#ECFDF5", text: "#059669" },
  لقاء: { bg: "#FFF7ED", text: "#EA580C" },
  حفل: { bg: "#FFF1F2", text: "#E11D48" },
  ندوة: { bg: "#FFFBEB", text: "#D97706" },
  أخرى: { bg: "#F3F4F6", text: "#374151" },
};

const FILTERS = ["الكل", "مؤتمر", "ورشة عمل", "إطلاق", "لقاء"];

export default function EventsList() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { events } = useEventStore();

  const [search, setSearch] = useState("");
  // change initial filter to match the Arabic "All" pill
  const [activeFilter, setActiveFilter] = useState("الكل");

  const filtered = events.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.venue.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      activeFilter === "الكل" || e.category === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const catColor = (cat) =>
    CATEGORY_COLORS[cat] || { bg: C.primarySoft, text: C.primary };

  const getConfirmedCount = (guests) =>
    (guests ?? []).filter((g) => g.status === "confirmed").length;

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
        <Text
          style={{
            fontFamily: "Inter_700Bold",
            fontSize: 22,
            color: C.fg,
            letterSpacing: -0.5,
            marginBottom: 14,
            textAlign: "right",
          }}
        >
          الفعاليات
        </Text>

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
            placeholder="البحث في الفعاليات…"
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

      {/* Filter Pills */}
      <View
        style={{
          backgroundColor: C.bg,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
          paddingVertical: 10,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{
            paddingHorizontal: 20,
            gap: 8,
            flexDirection: "row",
          }}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setActiveFilter(f)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: activeFilter === f ? C.primary : C.border,
                backgroundColor: activeFilter === f ? C.primarySoft : C.bg,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 12,
                  color: activeFilter === f ? C.primary : C.fgMuted,
                }}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 80,
          gap: 10,
        }}
      >
        {filtered.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <Calendar size={40} color={C.border} />
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 14,
                color: C.fgMuted,
                marginTop: 12,
              }}
            >
              لم يتم العثور على فعاليات
            </Text>
          </View>
        )}

        {filtered.map((event) => {
          const cc = catColor(event.category);
          const confirmed = getConfirmedCount(event.guests);
          return (
            <TouchableOpacity
              key={event.id}
              onPress={() => router.push(`/(tabs)/events/${event.id}`)}
              activeOpacity={0.8}
              style={{
                backgroundColor: C.bg,
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 12,
                padding: 16,
              }}
            >
              {/* Title Row */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 15,
                    color: C.fg,
                    flex: 1,
                    lineHeight: 22,
                    textAlign: "right",
                  }}
                  numberOfLines={2}
                >
                  {event.name}
                </Text>
                <ChevronRight
                  size={16}
                  color={C.fgMuted}
                  style={{ marginTop: 3, marginLeft: 8 }}
                />
              </View>

              {/* Meta */}
              <View style={{ gap: 4, marginBottom: 12 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Calendar size={12} color={C.fgMuted} />
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 12,
                      color: C.fgMuted,
                    }}
                  >
                    {event.date} · {event.time}
                  </Text>
                </View>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <MapPin size={12} color={C.fgMuted} />
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 12,
                      color: C.fgMuted,
                    }}
                  >
                    {event.venue}, {event.location}
                  </Text>
                </View>
              </View>

              {/* Divider */}
              <View
                style={{
                  height: 1,
                  backgroundColor: C.border,
                  marginBottom: 12,
                }}
              />

              {/* Footer */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                {confirmed > 0 && (
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
                    <Text
                      style={{
                        fontFamily: "Inter_500Medium",
                        fontSize: 11,
                        color: C.fgMuted,
                      }}
                    >
                      {confirmed} مؤكد
                    </Text>
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: "#16A34A",
                      }}
                    />
                  </View>
                )}
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: C.border,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 11,
                      color: C.fgMuted,
                    }}
                  >
                    {event.guests.length} ضيف
                  </Text>
                  <Users size={11} color={C.fgMuted} />
                </View>
                <View
                  style={{
                    backgroundColor: cc.bg,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 11,
                      color: cc.text,
                    }}
                  >
                    {event.category}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </KeyboardAvoidingAnimatedView>
  );
}
