import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { buscarLancamentos } from './database';

const ALERTA_KEY = '@financaspro:diasAlerta';
const CHANNEL_ID = 'vencimentos';

async function garantirCanal() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Vencimentos',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }
}

export async function agendarNotificacoesVencimento(): Promise<void> {
  try {
    await garantirCanal();

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: novo } = await Notifications.requestPermissionsAsync();
      if (novo !== 'granted') return;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();

    const diasAlertaStr = await AsyncStorage.getItem(ALERTA_KEY);
    const diasAlerta = parseInt(diasAlertaStr || '3', 10);

    const todos = buscarLancamentos();
    const pendentes = todos.filter((l: any) =>
      (l.status === 'pendente' || l.status === 'parcelado') &&
      l.dataVencimento?.trim()
    );

    const agora = new Date();
    const hojeInicio = new Date(agora);
    hojeInicio.setHours(0, 0, 0, 0);
    const limite = new Date(hojeInicio);
    limite.setDate(limite.getDate() + 30);

    for (const l of pendentes) {
      const parts = (l.dataVencimento as string).split('/');
      if (parts.length !== 3) continue;
      const [dia, mes, ano] = parts.map(Number);
      const dataVenc = new Date(ano, mes - 1, dia);

      if (dataVenc < hojeInicio || dataVenc > limite) continue;

      // Dispara diasAlerta dias antes; mínimo = hoje às 8h
      const dataNotif = new Date(dataVenc);
      dataNotif.setDate(dataNotif.getDate() - diasAlerta);
      if (dataNotif < hojeInicio) dataNotif.setTime(hojeInicio.getTime());
      dataNotif.setHours(8, 0, 0, 0);

      if (dataNotif <= agora) continue;

      const valorFmt = 'R$ ' + Number(l.valor || 0).toFixed(2).replace('.', ',');

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💸 Vencimento próximo',
          body: `${l.descricao} — ${valorFmt} vence em ${l.dataVencimento}`,
          data: { lancamentoId: l.id },
          sound: true,
          ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: dataNotif,
        },
      });
    }
  } catch {
    // Notificações são não-críticas — falha silenciosa
  }
}
