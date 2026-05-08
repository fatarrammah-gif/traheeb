import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import {
  Info,
  User,
  Mail,
  Share2,
  LogOut,
  ChevronLeft,
  MessageCircle,
} from "lucide-react-native";
import useAppAuthStore from "@/store/appAuthStore";

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
};

function MenuItem({ icon: Icon, label, onPress, danger, color }) {
  const iconColor = danger ? "#DC2626" : color || T.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 18,
        paddingVertical: 15,
        backgroundColor: T.surface,
        borderBottomWidth: 1,
        borderBottomColor: T.border,
      }}
    >
      <ChevronLeft size={16} color={T.muted} />
      <Text
        style={{
          fontFamily: "Inter_500Medium",
          fontSize: 15,
          color: danger ? "#DC2626" : T.text,
          flex: 1,
          textAlign: "right",
          marginRight: 14,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: danger ? "#FEF2F2" : T.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} color={iconColor} />
      </View>
    </TouchableOpacity>
  );
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAppAuthStore();

  const handleShare = async () => {
    await Share.share({
      message:
        "🎉 جرّب تراحيب — التطبيق الأذكى لإدارة الفعاليات وإرسال الدعوات عبر واتساب!\n\nحمّل التطبيق الآن.",
      title: "تراحيب - إدارة الفعاليات",
    });
  };

  const handleContact = () => {
    Linking.openURL("mailto:info@taraheeb.com").catch(() =>
      Alert.alert("تواصل معنا", "البريد الإلكتروني: info@taraheeb.com"),
    );
  };

  const handleLogout = () => {
    Alert.alert("تسجيل الخروج", "هل أنت متأكد من رغبتك في تسجيل الخروج؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "تسجيل الخروج",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/auth");
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View
        style={{
          backgroundColor: T.surface,
          paddingTop: insets.top + 10,
          paddingHorizontal: 20,
          paddingBottom: 18,
          borderBottomWidth: 1,
          borderBottomColor: T.border,
          alignItems: "center",
        }}
      >
        <Image
          source={{ uri: LOGO }}
          style={{ width: 80, height: 117 }}
          contentFit="contain"
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      >
        {/* User Card */}
        <View
          style={{
            backgroundColor: T.surface,
            margin: 16,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: T.border,
            padding: 18,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 16,
                color: T.text,
              }}
            >
              {user?.name || "مستخدم تراحيب"}
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                color: T.muted,
                marginTop: 3,
              }}
            >
              {user?.phone || ""}
            </Text>
            <View
              style={{
                marginTop: 8,
                backgroundColor: T.accentSoft,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderWidth: 1,
                borderColor: "#E6D06A",
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 11,
                  color: T.accent,
                }}
              >
                عضو نشط
              </Text>
            </View>
          </View>
          <View
            style={{
              width: 54,
              height: 54,
              borderRadius: 999,
              backgroundColor: T.primarySoft,
              borderWidth: 1.5,
              borderColor: T.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_700Bold",
                fontSize: 22,
                color: T.primary,
              }}
            >
              {(user?.name || "م").charAt(0)}
            </Text>
          </View>
        </View>

        {/* Menu Group */}
        <View
          style={{
            backgroundColor: T.surface,
            borderRadius: 14,
            marginHorizontal: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: T.border,
            overflow: "hidden",
          }}
        >
          <MenuItem
            icon={Info}
            label="عن تراحيب"
            onPress={() =>
              Alert.alert(
                "عن تراحيب",
                "تراحيب هو تطبيق متكامل لإدارة الفعاليات وإرسال الدعوات عبر واتساب مع رموز QR فريدة لكل ضيف.\n\nالإصدار 1.0.0",
              )
            }
          />
          <MenuItem
            icon={User}
            label="حسابي"
            onPress={() =>
              Alert.alert(
                "حسابي",
                `الاسم: ${user?.name || "-"}\nالهاتف: ${user?.phone || "-"}\nالدولة: ${user?.country || "-"}`,
              )
            }
          />
          <MenuItem
            icon={MessageCircle}
            label="ربط واتساب"
            onPress={() => router.push("/(tabs)/whatsapp-connect")}
          />
          <MenuItem icon={Mail} label="تواصل معنا" onPress={handleContact} />
          <MenuItem
            icon={Share2}
            label="مشاركة التطبيق"
            onPress={handleShare}
          />
        </View>

        {/* Logout */}
        <View
          style={{
            backgroundColor: T.surface,
            borderRadius: 14,
            marginHorizontal: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: "#FECACA",
            overflow: "hidden",
          }}
        >
          <MenuItem
            icon={LogOut}
            label="تسجيل الخروج"
            onPress={handleLogout}
            danger
          />
        </View>

        {/* Footer */}
        <View style={{ alignItems: "center", paddingVertical: 10 }}>
          <Image
            source={{ uri: LOGO }}
            style={{ width: 52, height: 76, opacity: 0.2 }}
            contentFit="contain"
          />
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 11,
              color: T.muted,
              marginTop: 6,
            }}
          >
            تراحيب — جميع الحقوق محفوظة © 2025
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
