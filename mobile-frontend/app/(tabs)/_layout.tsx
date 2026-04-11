import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

export default function TabLayout() {
  // We removed useAuth from here because it's already handled in app/_layout.tsx
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#fff', 
        tabBarInactiveTintColor: '#94a3b8',
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
        ),
      }}
    >
      <Tabs.Screen
        name="Home"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTabWrapper : styles.inactiveTabWrapper}>
              {focused && <View style={styles.notchFiller} />}
              <View style={focused ? styles.activeIconCircle : null}>
                <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
              </View>
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="Camera"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTabWrapper : styles.inactiveTabWrapper}>
              {focused && <View style={styles.notchFiller} />}
              <View style={focused ? styles.activeIconCircle : null}>
                <Ionicons name={focused ? "camera" : "camera-outline"} size={26} color={color} />
              </View>
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="ReadDocument"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTabWrapper : styles.inactiveTabWrapper}>
              {focused && <View style={styles.notchFiller} />}
              <View style={focused ? styles.activeIconCircle : null}>
                <Ionicons name={focused ? "document-text" : "document-text-outline"} size={24} color={color} />
              </View>
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="History"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTabWrapper : styles.inactiveTabWrapper}>
              {focused && <View style={styles.notchFiller} />}
              <View style={focused ? styles.activeIconCircle : null}>
                <Ionicons name={focused ? "time" : "time-outline"} size={24} color={color} />
              </View>
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTabWrapper : styles.inactiveTabWrapper}>
              {focused && <View style={styles.notchFiller} />}
              <View style={focused ? styles.activeIconCircle : null}>
                <Ionicons name={focused ? "settings" : "settings-outline"} size={24} color={color} />
              </View>
            </View>
          ),
        }}
      />

      {/* Adding this to hide the auto-generated index icon if it exists */}
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 20,
    left: 15,
    right: 15,
    backgroundColor: 'rgba(18, 10, 46, 0.9)', 
    borderRadius: 25,
    height: 70,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inactiveTabWrapper: { alignItems: 'center', justifyContent: 'center' },
  activeTabWrapper: { alignItems: 'center', justifyContent: 'center', top: -15 },
  activeIconCircle: {
    width: 55, height: 55, borderRadius: 27.5,
    backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#a855f7', shadowOpacity: 0.4, shadowRadius: 10, elevation: 5,
    borderWidth: 4, borderColor: '#08041a',
  },
  notchFiller: {
    position: 'absolute', top: 15, width: 70, height: 35,
    backgroundColor: '#08041a', borderBottomLeftRadius: 35, borderBottomRightRadius: 35, zIndex: -1,
  }
});