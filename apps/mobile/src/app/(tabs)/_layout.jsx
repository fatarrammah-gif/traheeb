import { Tabs } from "expo-router";
import {
  Home,
  Calendar,
  PlusCircle,
  MoreHorizontal,
} from "lucide-react-native";


export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#F2E0EB",
          paddingTop: 4,
        },
        tabBarActiveTintColor: "#C8005A",
        tabBarInactiveTintColor: "#7A5568",
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "Inter_500Medium",
        },
      }}
    >
      {/* RTL tab order — المزيد leftmost, الرئيسية rightmost */}
      <Tabs.Screen
        name="more"
        options={{
          title: "المزيد",
          tabBarIcon: ({ color }) => <MoreHorizontal color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "فعالية جديدة",
          tabBarIcon: ({ color }) => <PlusCircle color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "الفعاليات",
          tabBarIcon: ({ color }) => <Calendar color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ color }) => <Home color={color} size={22} />,
        }}
      />
      {/* Hidden screens — accessible via router.push, not shown in tab bar */}
      <Tabs.Screen
        name="whatsapp-connect"
        options={{ href: null }}
      />
    </Tabs>
  );
}
