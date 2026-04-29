import { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import {
  Calendar,
  Users,
  CheckCircle2,
  ChevronLeft,
  MapPin,
  Clock,
  Bell,
} from "lucide-react-native";
import useEventStore from "@/store/eventStore";
import useAppAuthStore from "@/store/appAuthStore";

const { width } = Dimensions.get("window");

const LOGO =
  "https://ucarecdn.com/278bc8d9-495d-4b72-8e2d-e62ccc73919a/-/format/auto/";
const HEADER_BG =
  "https://ucarecdn.com/07fefeb7-b296-4f2f-ac67-4c908643b6d6/-/format/auto/";

const BANNER_IMAGES = [
  {
    uri: "https://ucarecdn.com/e32c1d4d-496a-4b3d-9b93-ed23368d8407/-/format/auto/",
    id: "1",
  },
  {
    uri: "https://ucarecdn.com/572450f0-5aae-4984-bfca-9098111ebe99/-/format/auto/",
    id: "2",
  },
  {
    uri: "https://ucarecdn.com/7b942358-ac2e-4581-89f8-b434b031066f/-/format/auto/",
    id: "3",
  },
];

const T = {
  bg: "#FFF9FB",
  surface: "#FFFFFF",
  primary: "#C2185B",
  primarySoft: "#FFF0F7",
  accent: "#C8991A",
  accentSoft: "#FFF8E7",
  text: "#1A0910",
  muted: "#7A5568",
  border: "#F2E0EB",
};

const CATEGORY_COLORS = {
  مؤتمر: { bg: "#FFF0F7", text: "#C2185B" },
  إطلاق: { bg: "#F5F3FF", text: "#7C3AED" },
  "ورشة عمل": { bg: "#ECFDF5", text: "#059669" },
  لقاء: { bg: "#FFF7ED", text: "#EA580C" },
  حفل: { bg: "#FFF1F2", text: "#E11D48" },
  ندوة: { bg: "#FFFBEB", text: "#D97706" },
  أخرى: { bg: "#F3F4F6", text: "#374151" },
};

function BannerSlider() {
  const flatRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const BANNER_H = Math.round(width * 0.48);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % BANNER_IMAGES.length;
        try {
          flatRef.current?.scrollToIndex({ index: next, animated: true });
        } catch {}
        return next;
      });
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={{ marginBottom: 22 }}>
      <FlatList
        ref={flatRef}
        data={BANNER_IMAGES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveIndex(idx);
        }}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: 16, height: BANNER_H }}>
            <Image
              source={{ uri: item.uri }}
              style={{ width: "100%", height: BANNER_H, borderRadius: 14 }}
              contentFit="cover"
              transition={300}
            />
          </View>
        )}
      />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          gap: 6,
          marginTop: 10,
        }}
      >
        {BANNER_IMAGES.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === activeIndex ? 20 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === activeIndex ? T.primary : T.border,
            }}
          />
        ))}
      </View>
    </View>
  );
}

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { events } = useEventStore();
  const { user } = useAppAuthStore();
  const [notifCount] = useState(3);

  const totalGuests = events.reduce((acc, e) => acc + e.guests.length, 0);
  const confirmedGuests = events.reduce(
    (acc, e) => acc + e.guests.filter((g) => g.status === "confirmed").length,
    0,
  );
  const invitedGuests = events.reduce(
    (acc, e) => acc + e.guests.filter((g) => g.status === "invited").length,
    0,
  );

  const stats = [
    {
      label: "الفعاليات",
      value: events.length,
      icon: Calendar,
      color: T.primary,
      bg: T.primarySoft,
    },
    {
      label: "الضيوف",
      value: totalGuests,
      icon: Users,
      color: "#059669",
      bg: "#ECFDF5",
    },
    {
      label: "مؤكد",
      value: confirmedGuests,
      icon: CheckCircle2,
      color: T.accent,
      bg: T.accentSoft,
    },
  ];

  const catColor = (cat) =>
    CATEGORY_COLORS[cat] || { bg: T.primarySoft, text: T.primary };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar style="light" />

      {/* ══════════════ PREMIUM LUXURY HEADER ══════════════ */}
      <View
        style={{
          overflow: "hidden",
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          shadowColor: "#8A004F",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.28,
          shadowRadius: 20,
          elevation: 14,
        }}
      >
        {/* Layer 1 — Decorative background image */}
        <Image
          source={{ uri: HEADER_BG }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
          contentFit="cover"
        />

        {/* Layer 2 — Gradient overlay: #8A004F → #C2185B → #D81B72 at 135deg */}
        <LinearGradient
          colors={["#8A004F", "#C2185B", "#D81B72"]}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.8,
          }}
        />

        {/* Header Content */}
        <View
          style={{
            paddingTop: insets.top + 14,
            paddingHorizontal: 22,
            paddingBottom: 32,
          }}
        >
          {/* Top row: bell left · greeting right */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 18,
            }}
          >
            {/* Notification Bell — left */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "rgba(255,255,255,0.15)",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.25)",
              }}
            >
              <Bell size={20} color="#FFFFFF" />
              {notifCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: 7,
                    right: 7,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: "#F4C430",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1.5,
                    borderColor: "#FFFFFF",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_700Bold",
                      fontSize: 8,
                      color: "#5C3A00",
                    }}
                  >
                    {notifCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Greeting — right aligned (RTL) */}
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.80)",
                  letterSpacing: 0.4,
                }}
              >
                مرحباً بك 👋
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  fontSize: 20,
                  color: "#FFFFFF",
                  letterSpacing: -0.3,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {user?.name || "بعودتك"}
              </Text>
            </View>
          </View>

          {/* Logo — centered with subtle glow ring */}
          <View style={{ alignItems: "center", marginTop: 4, marginBottom: 2 }}>
            <View
              style={{
                position: "absolute",
                width: 118,
                height: 118,
                borderRadius: 59,
                backgroundColor: "rgba(255,255,255,0.08)",
              }}
            />
            <Image
              source={{ uri: LOGO }}
              style={{ width: 88, height: 128 }}
              contentFit="contain"
            />
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 24,
          paddingBottom: insets.bottom + 80,
        }}
      >
        {/* Banner Slider */}
        <BannerSlider />

        {/* Stats Row */}
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginBottom: 24,
            paddingHorizontal: 16,
          }}
        >
          {stats.map((s) => (
            <View
              key={s.label}
              style={{
                flex: 1,
                backgroundColor: T.surface,
                borderWidth: 1,
                borderColor: T.border,
                borderRadius: 16,
                padding: 14,
                shadowColor: "#8A004F",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.07,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: s.bg,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 10,
                  alignSelf: "flex-end",
                }}
              >
                <s.icon size={17} color={s.color} />
              </View>
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  fontSize: 24,
                  color: T.text,
                  textAlign: "right",
                }}
              >
                {s.value}
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 11,
                  color: T.muted,
                  marginTop: 2,
                  textAlign: "right",
                }}
              >
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Section Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
            paddingHorizontal: 16,
          }}
        >
          <TouchableOpacity onPress={() => router.push("/(tabs)/events")}>
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: T.primary,
              }}
            >
              عرض الكل
            </Text>
          </TouchableOpacity>
          <Text
            style={{
              fontFamily: "Inter_700Bold",
              fontSize: 16,
              color: T.text,
            }}
          >
            الفعاليات القادمة
          </Text>
        </View>

        {/* Events List */}
        <View style={{ gap: 10, paddingHorizontal: 16 }}>
          {events.map((event) => {
            const cc = catColor(event.category);
            return (
              <TouchableOpacity
                key={event.id}
                onPress={() => router.push(`/(tabs)/events/${event.id}`)}
                activeOpacity={0.8}
                style={{
                  backgroundColor: T.surface,
                  borderWidth: 1,
                  borderColor: T.border,
                  borderRadius: 16,
                  padding: 16,
                  borderRightWidth: 4,
                  borderRightColor: T.primary,
                  shadowColor: "#8A004F",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    marginBottom: 10,
                  }}
                >
                  <ChevronLeft
                    size={16}
                    color={T.muted}
                    style={{ marginTop: 2 }}
                  />
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text
                      style={{
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 14,
                        color: T.text,
                        marginBottom: 5,
                        lineHeight: 20,
                        textAlign: "right",
                      }}
                      numberOfLines={1}
                    >
                      {event.name}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        marginBottom: 3,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Inter_400Regular",
                          fontSize: 11,
                          color: T.muted,
                        }}
                      >
                        {event.date} · {event.time}
                      </Text>
                      <Clock size={11} color={T.muted} />
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Inter_400Regular",
                          fontSize: 11,
                          color: T.muted,
                        }}
                      >
                        {event.venue}
                      </Text>
                      <MapPin size={11} color={T.muted} />
                    </View>
                  </View>
                </View>

                <View
                  style={{
                    height: 1,
                    backgroundColor: T.border,
                    marginBottom: 10,
                  }}
                />

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    justifyContent: "flex-end",
                  }}
                >
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: T.border,
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
                        color: T.muted,
                      }}
                    >
                      {event.guests.length} / {event.capacity}
                    </Text>
                    <Users size={11} color={T.muted} />
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
        </View>

        {/* Pending invitations */}
        {invitedGuests > 0 && (
          <View
            style={{
              marginTop: 16,
              marginHorizontal: 16,
              backgroundColor: T.accentSoft,
              borderWidth: 1,
              borderColor: "#E6D06A",
              borderRadius: 16,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: T.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                  color: T.accent,
                  textAlign: "right",
                }}
              >
                {invitedGuests} دعوات معلقة
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 11,
                  color: "#A07810",
                  marginTop: 2,
                  textAlign: "right",
                }}
              >
                ضيوف في انتظار التأكيد
              </Text>
            </View>
          </View>
        )}

        {/* Create CTA — uses same gradient */}
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/create")}
          style={{
            marginTop: 16,
            marginHorizontal: 16,
            borderRadius: 16,
            overflow: "hidden",
            shadowColor: "#8A004F",
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
            elevation: 7,
          }}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={["#8A004F", "#C2185B", "#D81B72"]}
            locations={[0, 0.45, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ padding: 16, alignItems: "center" }}
          >
            <Text
              style={{
                fontFamily: "Inter_700Bold",
                fontSize: 15,
                color: "#FFFFFF",
              }}
            >
              + إنشاء فعالية جديدة
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
