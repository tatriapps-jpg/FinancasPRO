import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { buscarCartoes, buscarTodosLancamentos, buscarTransferencias } from './database';

// Backup automático e silencioso — fica só no armazenamento do próprio app,
// nunca sai do aparelho. Serve como rede de segurança caso o usuário use
// "Esqueci meu PIN" (que precisa apagar os dados atuais por segurança).
const AUTOBACKUP_PATH = FileSystem.documentDirectory + 'FalaDinheiro_autobackup.json';

export async function montarBackup() {
  const lancamentos = buscarTodosLancamentos();
  const cartoes = buscarCartoes();
  const transferencias = buscarTransferencias();
  const contas = await AsyncStorage.getItem('@financaspro:contas');
  const orcamento = await AsyncStorage.getItem('@financaspro:orcamento');
  const alerta = await AsyncStorage.getItem('@financaspro:diasAlerta');
  const catDesp = await AsyncStorage.getItem('@financaspro:categorias_despesa');
  const catRec = await AsyncStorage.getItem('@financaspro:categorias_receita');
  const nomeUsuario = await AsyncStorage.getItem('@financaspro:nomeUsuario');

  return {
    versao: '1.0',
    data: new Date().toISOString(),
    lancamentos,
    cartoes,
    transferencias,
    contas: contas ? JSON.parse(contas) : [],
    orcamento: orcamento || '5000',
    diasAlerta: alerta || '3',
    categoriasDespesa: catDesp ? JSON.parse(catDesp) : [],
    categoriasReceita: catRec ? JSON.parse(catRec) : [],
    nomeUsuario: nomeUsuario || '',
  };
}

export async function salvarBackupAutomatico() {
  try {
    const backup = await montarBackup();
    // Não sobrescreve o autobackup com uma base vazia (ex.: logo após um reset,
    // antes de haver qualquer lançamento) — evita perder um backup bom por engano.
    const temConteudo = (backup.lancamentos?.length || 0) > 0 || (backup.cartoes?.length || 0) > 0 || (backup.contas?.length || 0) > 0;
    if (!temConteudo) return;
    await FileSystem.writeAsStringAsync(AUTOBACKUP_PATH, JSON.stringify(backup), { encoding: FileSystem.EncodingType.UTF8 });
  } catch {
    // silencioso — nunca deve travar o uso do app
  }
}

export async function lerBackupAutomatico(): Promise<any | null> {
  try {
    const info = await FileSystem.getInfoAsync(AUTOBACKUP_PATH);
    if (!info.exists) return null;
    const json = await FileSystem.readAsStringAsync(AUTOBACKUP_PATH);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function apagarBackupAutomatico() {
  try {
    await FileSystem.deleteAsync(AUTOBACKUP_PATH, { idempotent: true });
  } catch {
    // silencioso
  }
}
