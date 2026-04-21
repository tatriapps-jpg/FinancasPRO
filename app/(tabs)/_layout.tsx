import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

function TabBarIcon({ symbol }: { symbol: string }) {
  return <Text style={{ fontSize: 22 }}>{symbol}</Text>;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
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
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: () => <TabBarIcon symbol="🏠" /> }} />
      <Tabs.Screen name="lancamentos" options={{ title: 'Lançamentos', tabBarIcon: () => <TabBarIcon symbol="📋" /> }} />
      <Tabs.Screen name="orcamento" options={{ title: 'Orçamento', tabBarIcon: () => <TabBarIcon symbol="💰" /> }} />
      <Tabs.Screen name="relatorios" options={{ title: 'Relatórios', tabBarIcon: () => <TabBarIcon symbol="📊" /> }} />
      <Tabs.Screen name="configuracoes" options={{ title: 'Config.', tabBarIcon: () => <TabBarIcon symbol="⚙️" /> }} />
      <Tabs.Screen name="cartoes" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
