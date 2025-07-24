import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; // ✅ required for icons

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
      <Tabs.Screen
        name="personalinfo"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" color={color} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}
