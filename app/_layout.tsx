import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { initConnection, endConnection } from 'react-native-iap';
import { salvarBackupAutomatico } from './backup';
import { initDB, garantirContaEspecie, initTransferencias } from './database';
import { executarBackupAutomatico } from './driveBackup';
import { configurarNotificacoes } from './notificacoes';
import { ThemeProvider, useTheme } from './theme';

const PIN_KEY          = '@financaspro:pin';
const DESBLOQUEADO_KEY = '@faladinheiro:desbloqueado';
const ONBOARDING_KEY   = '@financaspro:onboardingConcluido';
const PIN_PULADO_KEY   = '@financaspro:pinPulado';

// ── Contexto global de desbloqueio ──────────────────────────────────────────
type PremiumCtx = { desbloqueado: boolean; setDesbloqueado: (v: boolean) => void };
const PremiumContext = createContext<PremiumCtx>({ desbloqueado: false, setDesbloqueado: () => {} });
export function usePremium() { return useContext(PremiumContext); }

function RootContent() {
  const [pronto, setPronto]             = useState(false);
  const [temPin, setTemPin]             = useState(false);
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [rotaInicial, setRotaInicial]   = useState<string | null>(null);
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
    if (pronto && rotaInicial) {
      router.replace(rotaInicial as any);
    }
  }, [pronto, rotaInicial]);

  // Backup automático e silencioso: sempre que o app vai para segundo plano,
  // salva uma cópia local dos dados. Serve de rede de segurança para o fluxo
  // "Esqueci meu PIN" — nunca sai do aparelho, não usa servidor nenhum.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'background' || estado === 'inactive') {
        salvarBackupAutomatico();
      }
    });
    return () => sub.remove();
  }, []);

  async function inicializar() {
    const [pin, status, onboardingConcluido, pinPulado] = await Promise.all([
      AsyncStorage.getItem(PIN_KEY),
      AsyncStorage.getItem(DESBLOQUEADO_KEY),
      AsyncStorage.getItem(ONBOARDING_KEY),
      AsyncStorage.getItem(PIN_PULADO_KEY),
    ]);
    setDesbloqueado(status === 'true');
    setTemPin(!!pin);
    await garantirContaEspecie();
    initTransferencias();

    // Quem ainda não passou pelo onboarding vai direto pra ele — mostrar valor
    // (e a experiência de voz) antes de qualquer tela de segurança/formulário.
    // O PIN só é pedido depois, ao final do onboarding (e pode ser adiado dali).
    let rota = '/pin';
    if (onboardingConcluido !== 'true') {
      rota = '/onboarding';
    } else if (!pin && pinPulado === 'true') {
      rota = '/(tabs)';
    }
    setRotaInicial(rota);
    setPronto(true);
    configurarNotificacoes().catch(() => {});
    // Backup automático no Drive: silencioso, best-effort, nunca bloqueia o
    // app (só roda se o usuário já conectou o Drive nas Configurações).
    executarBackupAutomatico().catch(() => {});
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
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="novo-lancamento" options={{ headerShown: false }} />
        <Stack.Screen name="editar-lancamento" options={{ headerShown: false }} />
        <Stack.Screen name="cartoes" options={{ headerShown: false }} />
        <Stack.Screen name="contas" options={{ headerShown: false }} />
        <Stack.Screen name="dinheiro" options={{ headerShown: false }} />
        <Stack.Screen name="categorias" options={{ headerShown: false }} />
        <Stack.Screen name="camera" options={{ headerShown: false }} />
        <Stack.Screen name="qrcode" options={{ headerShown: false }} />
        <Stack.Screen name="voz" options={{ headerShown: false }} />
        <Stack.Screen name="paywall" options={{ headerShown: false }} />
        <Stack.Screen name="politica" options={{ headerShown: false }} />
        <Stack.Screen name="transferencias" options={{ headerShown: false }} />
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
