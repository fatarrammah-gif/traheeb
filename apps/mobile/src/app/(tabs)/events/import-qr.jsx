/**
 * Import externally-created QR tokens screen.
 *
 * Flow:
 *   1. Pick an Excel/CSV file → POST /api/events/[id]/imported-qr/preview
 *      (parses, classifies against existing tokens, writes nothing)
 *   2. Review: N new codes + a toggleable list of duplicates (tokens that
 *      already belong to a guest or a previous import) — each toggle grants
 *      one extra admission chance on that code.
 *   3. Apply → POST /api/events/[id]/imported-qr with the selection.
 */
import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { ArrowLeft, FileSpreadsheet } from "lucide-react-native";
import fetchToWeb from "@/__create/fetch";

const C = {
  bg: "#FFFFFF",
  muted: "#F9FAFB",
  fg: "#111827",
  fgMuted: "#6B7280",
  border: "#E5E7EB",
  primary: "#2563EB",
  primarySoft: "#EFF6FF",
};

export default function ImportQRScreen() {
  const { eventId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState(null); // { newTokens, duplicates, skipped }
  const [extendMap, setExtendMap] = useState({}); // token -> boolean

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
          "text/comma-separated-values",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;

      setLoading(true);
      setPreview(null);

      const asset = result.assets[0];
      const fileBase64 = await new File(asset.uri).base64();

      const res = await fetchToWeb(`/api/events/${eventId}/imported-qr/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64 }),
      });
      const data = await res.json();

      if (!res.ok) {
        Alert.alert("خطأ", data.error || "تعذر معالجة الملف");
        return;
      }

      setPreview(data);
      // Default every duplicate to "extend" = on
      const defaults = {};
      for (const d of data.duplicates) defaults[d.token] = true;
      setExtendMap(defaults);
    } catch (err) {
      Alert.alert("خطأ", "تعذر قراءة الملف");
    } finally {
      setLoading(false);
    }
  };

  const toggleExtend = (token) => {
    setExtendMap((prev) => ({ ...prev, [token]: !prev[token] }));
  };

  const applyImport = async () => {
    if (!preview) return;
    setApplying(true);
    try {
      const extendTokens = preview.duplicates
        .filter((d) => extendMap[d.token])
        .map((d) => d.token);

      const res = await fetchToWeb(`/api/events/${eventId}/imported-qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newTokens: preview.newTokens, extendTokens }),
      });
      const data = await res.json();

      if (!res.ok) {
        Alert.alert("خطأ", data.error || "تعذر تطبيق الاستيراد");
        return;
      }

      Alert.alert(
        "تم الاستيراد",
        `تمت إضافة ${data.added} رمز جديد، ومنح فرصة دخول إضافية لـ ${data.extended} رمز.`,
        [{ text: "تم", onPress: () => router.back() }]
      );
    } catch {
      Alert.alert("خطأ", "تعذر تطبيق الاستيراد");
    } finally {
      setApplying(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={C.fg} />
        </TouchableOpacity>
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 17, color: C.fg }}>
          استيراد رموز QR
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 16 }}
      >
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: C.fgMuted, lineHeight: 20 }}>
          اختر ملف Excel أو CSV يحتوي على عمود واحد من رموز QR الصادرة مسبقاً
          خارج النظام. الرموز الجديدة تُضاف كبطاقات قابلة للمسح مرة واحدة. أما
          الرموز الموجودة بالفعل، فيمكنك منحها فرصة دخول إضافية.
        </Text>

        <TouchableOpacity
          onPress={pickFile}
          disabled={loading}
          style={{
            backgroundColor: C.primary,
            borderRadius: 12,
            padding: 15,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: loading ? 0.6 : 1,
          }}
          activeOpacity={0.85}
        >
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#FFFFFF" }}>
            {loading ? "جارٍ المعالجة..." : "اختيار ملف"}
          </Text>
          <FileSpreadsheet size={18} color="#FFFFFF" />
        </TouchableOpacity>

        {loading && <ActivityIndicator color={C.primary} />}

        {preview && (
          <View style={{ gap: 12 }}>
            <View
              style={{
                backgroundColor: C.primarySoft,
                borderRadius: 12,
                padding: 14,
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.primary }}>
                {preview.newTokens.length} رمز جديد
              </Text>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.primary }}>
                {preview.duplicates.length} موجود مسبقاً
              </Text>
            </View>

            {preview.duplicates.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.fg }}>
                  منح فرصة دخول إضافية
                </Text>
                {preview.duplicates.map((d) => (
                  <View
                    key={d.token}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: C.muted,
                      borderRadius: 10,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: C.border,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.fg }}>
                        {d.source === "guest" ? d.guestName : "بطاقة مستوردة"}
                      </Text>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: C.fgMuted }}>
                        {d.maxScans} دخولات، مستخدم {d.scanCount}
                      </Text>
                    </View>
                    <Switch
                      value={!!extendMap[d.token]}
                      onValueChange={() => toggleExtend(d.token)}
                    />
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              onPress={applyImport}
              disabled={applying}
              style={{
                backgroundColor: "#1A0910",
                borderRadius: 12,
                padding: 15,
                alignItems: "center",
                opacity: applying ? 0.6 : 1,
              }}
              activeOpacity={0.85}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#E6D06A" }}>
                {applying ? "جارٍ التطبيق..." : "تطبيق الاستيراد"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
