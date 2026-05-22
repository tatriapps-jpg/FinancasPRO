import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { initConnection, endConnection } from 'react-native-iap';
import { initDB, garantirContaEspecie } from './database';
import { configurarNotificacoes } from './notificacoes';
import { ThemeProvider, useTheme } from './theme';

const PIN_KEY          = '@financaspro:pin';
const DESBLOQUEADO_KEY = '@faladinheiro:desbloqueado';

// ── Contexto global de desbloqueio ──────────────────────────────────────────
type PremiumCtx = { desbloqueado: boolean; setDesbloqueado: (v: boolean) => void };
const PremiumContext = createContext<PremiumCtx>({ desbloqueado: false, setDesbloqueado: () => {} });
export function usePremium() { return useContext(PremiumContext); }

function RootContent() {
  const [pronto, setPronto]             = useState(false);
  const [temPin, setTemPin]             = useState(false);
  const [desbloqueado, setDesbloqueado] = useState(false);
  const { isDark } = useTheme();

  useEffect(() => {
    initDB();
    inicializar();

    // Inicializa IAP (necessário para react-native-iap funcionar nas telas filhas)
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      initConnection().catch(() => {});
    }

    return () => {
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        endConnection().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (pronto) {
      router.replace('/pin');
    }
  }, [pronto]);

  async function inicializar() {
    const [pin, status] = await Promise.all([
      AsyncStorage.getItem(PIN_KEY),
      AsyncStorage.getItem(DESBLOQUEADO_KEY),
    ]);
    setDesbloqueado(status === 'true');
    setTemPin(!!pin);
    await garantirContaEspecie();
    setPronto(true);
    configurarNotificacoes().catch(() => {});
  }

  // alias para manter compatibilidade interna
  async function verificarPin() {
    const pin = await AsyncStorage.getItem(PIN_KEY);
    setTemPin(!!pin);
    setPronto(true);
  }

  if (!pronto) {
    return <View style={{ flex: 1, backgroundColor: isDark ? '#12151e' : '#f4f6fb' }} />;
  }

  return (
    <PremiumContext.Provider value={{ desbloqueado, setDesbloqueado }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="pin" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="novo-lancamento" options={{ headerShown: false }} />
        <Stack.Screen name="editar-lancamento" options={{ headerShown: false }} />
        <Stack.Screen name="cartoes" options={{ headerShown: false }} />
        <Stack.Screen name="contas" options={{ headerShown: false }} />
        <Stack.Screen name="categorias" options={{ headerShown: false }} />
        <Stack.Screen name="camera" options={{ headerShown: false }} />
        <Stack.Screen name="qrcode" options={{ headerShown: false }} />
        <Stack.Screen name="voz" options={{ headerShown: false }} />
        <Stack.Screen name="paywall" options={{ headerShown: false }} />
        <Stack.Screen name="politica" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </PremiumContext.Provider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootContent />
    </ThemeProvider>
  );
}
