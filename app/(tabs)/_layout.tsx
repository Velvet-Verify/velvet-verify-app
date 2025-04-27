// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { ConnectionsProvider, useConnections } from '@/src/context/ConnectionsContext';
import { useAuth } from '@/src/context/AuthContext';
import { HapticTab } from '@/components/common/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

/* ------------------------------------------------------------------------ */
/* outer wrapper provides context                                           */
/* ------------------------------------------------------------------------ */
export default function TabLayout() {
  const { user }   = useAuth();
  const scheme     = useColorScheme() ?? 'light';
  if (!user) return null;

  return (
    <ConnectionsProvider>
      <InnerTabs colorScheme={scheme} />
    </ConnectionsProvider>
  );
}

/* ------------------------------------------------------------------------ */
/* inner component can read alertCount                                      */
/* ------------------------------------------------------------------------ */
function InnerTabs({ colorScheme }: { colorScheme: 'light' | 'dark' }) {
  const { alertCount } = useConnections();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: { position: 'absolute' },
          default: {},
        }),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="connections"
        options={{
          title: 'Connections',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="paperplane.fill" color={color} />
          ),
          tabBarBadge: alertCount ? alertCount : undefined,   // <-- NEW
        }}
      />
    </Tabs>
  );
}