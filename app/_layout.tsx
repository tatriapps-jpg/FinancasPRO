import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { initDB } from './database';

export default function RootLayout() {
  useEffect(() => {
    initDB();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack>
        <Stack.Screen name="pin" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="novo-lancamento" options={{ headerShown: false }} />
        <Stack.Screen name="editar-lancamento" options={{ headerShown: false }} />
        <Stack.Screen name="cartoes" options={{ headerShown: false }} />
        <Stack.Screen name="camera" options={{ headerShown: false }} />
        <Stack.Screen name="qrcode" options={{ headerShown: false }} />
        <Stack.Screen name="voz" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}