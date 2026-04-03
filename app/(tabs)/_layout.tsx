import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TabBarIcon({ symbol }: { symbol: string }) {
  return <Text style={{ fontSize: 22 }}>{symbol}</Text>;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1c2133',
          borderTopColor: 'rgba(255,255,255,0.1)',
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#5294ff',
        tabBarInactiveTintColor: '#6b779a',
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