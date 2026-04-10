import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { initDB } from './database';

const PIN_KEY = '@financaspro:pin';

export default function RootLayout() {
  const [pronto, setPronto] = useState(false);
  const [temPin, setTemPin] = useState(false);

  useEffect(() => {
    initDB();
    verificarPin();
  }, []);

  useEffect(() => {
    if (pronto && temPin) {
      router.replace('/pin');
    }
  }, [pronto, temPin]);

  async function verificarPin() {
    const pin = await AsyncStorage.getItem(PIN_KEY);
    setTemPin(!!pin);
    setPronto(true);
  }

  if (!pronto) {
    return <View style={{ flex: 1, backgroundColor: '#12151e' }} />;
  }

  return (
    <>
      <StatusBar style="light" />
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
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}