import { Tabs } from "expo-router";
import React from "react";

import { SearchIcon, SyncIcon } from "@/components/icons";
import { useTheme } from "@/theme/ThemeProvider";

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.borderSubtle },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: theme.typography.weight.medium },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Rechercher",
          tabBarIcon: ({ color }) => <SearchIcon size={21} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: "Sync",
          tabBarIcon: ({ color }) => <SyncIcon size={21} color={String(color)} />,
        }}
      />
    </Tabs>
  );
}
