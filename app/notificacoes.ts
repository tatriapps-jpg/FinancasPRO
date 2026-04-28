import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { buscarLancamentos, buscarTotaisMes } from './database';

const ALERTA_KEY   = '@financaspro:diasAlerta';
const ORC_KEY      = '@financaspro:orcamento';
const NOTIF_ORC_KEY = '@financaspro:notif_orc_mes';

const CH_VENCIMENTOS = 'vencimentos';
const CH_LEMBRETES   = 'lembretes';
const CH_MOTIVACIONAL = 'motivacional';

// ─── Canais Android ───────────────────────────────────────────────────────────

async function garantirCanais() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CH_VENCIMENTOS, {
    name: 'Vencimentos',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(CH_LEMBRETES, {
    name: 'Lembretes Financeiros',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(CH_MOTIVACIONAL, {
    name: 'Motivação',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

// ─── Permissão ────────────────────────────────────────────────────────────────

async function temPermissao(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const { status: novo } = await Notifications.requestPermissionsAsync();
  return novo === 'granted';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ch(channelId: string): object {
  return Platform.OS === 'android' ? { channelId } : {};
}

async function cancelarPorPrefixo(prefix: string) {
  const agendadas = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of agendadas) {
    if (n.identifier.startsWith(prefix)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

function fmtBRL(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── 1. Contas a vencer: 3 dias, 1 dia e no dia ───────────────────────────────

export async function agendarNotificacoesVencimento(): Promise<void> {
  try {
    await garantirCanais();
    if (!(await temPermissao())) return;

    await cancelarPorPrefixo('venc_');

    const diasAlertaStr = await AsyncStorage.getItem(ALERTA_KEY);
    const diasAlerta    = parseInt(diasAlertaStr || '3', 10);
    void diasAlerta; // mantido para compatibilidade; avisos fixos em 3/1/0

    const pendentes = buscarLancamentos().filter((l: any) =>
      (l.status === 'pendente' || l.status === 'parcelado') &&
      l.dataVencimento?.trim()
    );

    const agora      = new Date();
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

      const valorFmt = fmtBRL(Number(l.valor || 0));

      for (const { diasAntes, sufixo, label } of [
        { diasAntes: 3, sufixo: '3d', label: 'em 3 dias' },
        { diasAntes: 1, sufixo: '1d', label: 'amanhã' },
        { diasAntes: 0, sufixo: '0d', label: 'hoje' },
      ]) {
        const dataNotif = new Date(dataVenc);
        dataNotif.setDate(dataNotif.getDate() - diasAntes);
        dataNotif.setHours(8, 0, 0, 0);
        if (dataNotif <= agora) continue;

        await Notifications.scheduleNotificationAsync({
          identifier: `venc_${l.id}_${sufixo}`,
          content: {
            title: '💸 Vencimento próximo',
            body: `${l.descricao} — ${valorFmt} vence ${label}`,
            data: { lancamentoId: l.id },
            sound: true,
            ...ch(CH_VENCIMENTOS),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: dataNotif,
          },
        });
      }
    }
  } catch {
    // não-crítico
  }
}

// ─── 2. Alerta de orçamento: 80% e 100% ──────────────────────────────────────
// Chamado após cada lançamento salvo. Usa chave @financaspro:notif_orc_mes
// (formato "YYYY-MM:80,100") para disparar cada limiar no máximo uma vez por mês.

export async function verificarAlertaOrcamento(): Promise<void> {
  try {
    await garantirCanais();
    if (!(await temPermissao())) return;

    const orcStr   = await AsyncStorage.getItem(ORC_KEY);
    const orcamento = parseFloat(orcStr || '0');
    if (!orcamento || orcamento <= 0) return;

    const agora = new Date();
    const mes   = agora.getMonth() + 1;
    const ano   = agora.getFullYear();
    const { totalGasto } = buscarTotaisMes(mes, ano);
    const pct = (totalGasto / orcamento) * 100;

    const chaveMes = `${ano}-${String(mes).padStart(2, '0')}`;
    const salvo    = await AsyncStorage.getItem(NOTIF_ORC_KEY);
    const [mesSalvo, listaStr] = (salvo ?? ':').split(':');
    const jaNotificado = new Set<string>(
      mesSalvo === chaveMes ? listaStr.split(',').filter(Boolean) : []
    );

    let mudou = false;

    if (pct >= 100 && !jaNotificado.has('100')) {
      await Notifications.scheduleNotificationAsync({
        identifier: 'orcamento_100',
        content: {
          title: '🚨 Orçamento esgotado!',
          body: `Você atingiu 100% do orçamento mensal de ${fmtBRL(orcamento)}.`,
          sound: true,
          ...ch(CH_LEMBRETES),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2,
          repeats: false,
        },
      });
      jaNotificado.add('100');
      mudou = true;
    } else if (pct >= 80 && !jaNotificado.has('80')) {
      await Notifications.scheduleNotificationAsync({
        identifier: 'orcamento_80',
        content: {
          title: '⚠️ Orçamento quase no limite',
          body: `${pct.toFixed(0)}% do orçamento de ${fmtBRL(orcamento)} já foi usado.`,
          sound: true,
          ...ch(CH_LEMBRETES),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2,
          repeats: false,
        },
      });
      jaNotificado.add('80');
      mudou = true;
    }

    if (mudou) {
      await AsyncStorage.setItem(
        NOTIF_ORC_KEY,
        `${chaveMes}:${[...jaNotificado].join(',')}`
      );
    }
  } catch {
    // não-crítico
  }
}

// ─── 3. Resumo diário às 20h ──────────────────────────────────────────────────

async function agendarResumoDiario(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: 'diario_20h',
    content: {
      title: '🌙 Fala, Dinheiro!',
      body: 'Hora de revisar os gastos do dia. Tudo registrado?',
      sound: true,
      ...ch(CH_LEMBRETES),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });
}

// ─── 4. Lembrete semanal — domingo às 10h ─────────────────────────────────────

async function agendarLembreteSemanal(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: 'semanal_domingo',
    content: {
      title: '📊 Resumo da semana',
      body: 'Como foi sua semana financeira? Abra o app e confira receitas e despesas.',
      sound: true,
      ...ch(CH_LEMBRETES),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // 1 = domingo
      hour: 10,
      minute: 0,
    },
  });
}

// ─── 5. Motivacional — 3 dias sem lançar ─────────────────────────────────────
// Chamado após cada lançamento salvo. Cancela o lembrete anterior e reagenda
// para daqui a 3 dias — se o usuário sumir por 3 dias, a notificação dispara.

export async function resetarLembreteMotivacional(): Promise<void> {
  try {
    await cancelarPorPrefixo('motivacional_');
    await garantirCanais();
    if (!(await temPermissao())) return;

    const tresADias = new Date();
    tresADias.setDate(tresADias.getDate() + 3);
    tresADias.setHours(10, 0, 0, 0);

    await Notifications.scheduleNotificationAsync({
      identifier: 'motivacional_3d',
      content: {
        title: '💪 Faz tempo que não te vejo!',
        body: 'Não deixe os lançamentos acumularem — dois minutinhos e tudo fica em dia!',
        sound: true,
        ...ch(CH_MOTIVACIONAL),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: tresADias,
      },
    });
  } catch {
    // não-crítico
  }
}

// ─── Setup inicial (chamado em _layout.tsx) ───────────────────────────────────
// Agenda diário e semanal apenas se ainda não estiverem na fila, evitando
// duplicatas a cada abertura do app.

export async function configurarNotificacoes(): Promise<void> {
  try {
    await garantirCanais();
    if (!(await temPermissao())) return;

    const agendadas = await Notifications.getAllScheduledNotificationsAsync();
    const ids = new Set(agendadas.map(n => n.identifier));

    await Promise.all([
      ids.has('diario_20h')     ? Promise.resolve() : agendarResumoDiario(),
      ids.has('semanal_domingo') ? Promise.resolve() : agendarLembreteSemanal(),
    ]);
  } catch {
    // não-crítico
  }
}
