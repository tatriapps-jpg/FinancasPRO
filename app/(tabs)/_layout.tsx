import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

const VOZ_TOOLTIP_KEY = '@faladinheiro:vozFabTooltip';

function TabBarIcon({ symbol }: { symbol: string }) {
  return <Text style={{ fontSize: 22 }}>{symbol}</Text>;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(VOZ_TOOLTIP_KEY).then(v => {
      if (!v) {
        setShowTooltip(true);
        AsyncStorage.setItem(VOZ_TOOLTIP_KEY, '1');
        setTimeout(() => setShowTooltip(false), 4000);
      }
    });
  }, []);

  function handleVozPress() {
    setShowTooltip(false);
    router.push('/voz');
  }

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.borderSoft,
            borderTopWidth: 1,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom + 6,
            paddingTop: 6,
          },
          tabBarActiveTintColor: '#5294ff',
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen name="index"         options={{ title: 'Resumo',      tabBarIcon: () => <TabBarIcon symbol="🏠" /> }} />
        <Tabs.Screen name="lancamentos"   options={{ title: 'Lançamentos', tabBarIcon: () => <TabBarIcon symbol="📋" /> }} />
        <Tabs.Screen name="orcamento"     options={{ title: 'Orçamento',   tabBarIcon: () => <TabBarIcon symbol="💰" /> }} />
        <Tabs.Screen name="relatorios"    options={{ title: 'Relatórios',  tabBarIcon: () => <TabBarIcon symbol="📊" /> }} />
        <Tabs.Screen name="configuracoes" options={{ title: 'Config.',     tabBarIcon: () => <TabBarIcon symbol="⚙️" /> }} />
        <Tabs.Screen name="cartoes" options={{ href: null }} />
        <Tabs.Screen name="explore"  options={{ href: null }} />
      </Tabs>

      {/* FAB de voz — flutua ACIMA da tab bar, sem bloquear as abas */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 60 + insets.bottom + 4,
          alignItems: 'center',
          zIndex: 999,
        }}
      >
        {showTooltip && (
          <View
            pointerEvents="none"
            style={{
              backgroundColor: 'rgba(0,0,0,0.78)',
              borderRadius: 8,
              paddingHorizontal: 14,
              paddingVertical: 8,
              marginBottom: 8,
              maxWidth: 220,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
              Toque aqui para lançar por voz
            </Text>
          </View>
        )}
        <TouchableOpacity
          onPress={handleVozPress}
          activeOpacity={0.85}
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: '#5294ff',
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 10,
            shadowColor: '#5294ff',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
          }}
        >
          <Text style={{ fontSize: 22 }}>🎤</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
