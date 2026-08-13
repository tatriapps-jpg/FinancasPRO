// Backup automático no Google Drive — usa a pasta oculta "appDataFolder"
// (visível só para este app, não aparece no Drive do usuário). Tudo aqui é
// silencioso e best-effort: qualquer falha (sem internet, sem espaço, login
// recusado, etc.) é engolida e NUNCA deve travar ou afetar o uso normal do
// app. O backup local em backup.ts continua sendo a rede de segurança
// principal; isso é uma camada extra caso o aparelho seja perdido/danificado.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { montarBackup } from './backup';

// Import defensivo: se o módulo nativo não estiver disponível (ex.: rodando
// em ambiente sem o módulo compilado), o resto do app continua funcionando.
let GoogleSignin: any = null;
let isSuccessResponse: any = null;
let isNoSavedCredentialFoundResponse: any = null;
try {
  const mod = require('@react-native-google-signin/google-signin');
  GoogleSignin = mod.GoogleSignin;
  isSuccessResponse = mod.isSuccessResponse;
  isNoSavedCredentialFoundResponse = mod.isNoSavedCredentialFoundResponse;
} catch {
  // módulo nativo não disponível — recurso fica desligado
}

const CONECTADO_KEY = '@faladinheiro:driveConectado';
const ULTIMO_BACKUP_KEY = '@faladinheiro:ultimoBackupDrive';
const EMAIL_KEY = '@faladinheiro:driveEmail';
const DRIVE_FILE_NAME = 'faladinheiro_backup.json';
const SCOPES = ['https://www.googleapis.com/auth/drive.appdata'];

let configurado = false;
function configurar() {
  if (!GoogleSignin || configurado) return;
  GoogleSignin.configure({ scopes: SCOPES });
  configurado = true;
}

export function driveDisponivel() {
  return !!GoogleSignin;
}

export async function statusDrive(): Promise<{ conectado: boolean; email: string | null; ultimoBackup: string | null }> {
  const [conectado, email, ultimoBackup] = await Promise.all([
    AsyncStorage.getItem(CONECTADO_KEY),
    AsyncStorage.getItem(EMAIL_KEY),
    AsyncStorage.getItem(ULTIMO_BACKUP_KEY),
  ]);
  return { conectado: conectado === 'true', email, ultimoBackup };
}

// Conecta interativamente (mostra a tela de login do Google) — usar a partir
// de um toque do usuário nas Configurações. Faz o primeiro backup na hora.
export async function conectarDrive(): Promise<{ sucesso: boolean; email?: string; erro?: string }> {
  if (!GoogleSignin) return { sucesso: false, erro: 'Este recurso não está disponível nesta versão do app.' };
  try {
    configurar();
    await GoogleSignin.hasPlayServices();
    const resposta = await GoogleSignin.signIn();
    if (!isSuccessResponse(resposta)) {
      return { sucesso: false, erro: 'Login cancelado.' };
    }
    const email = resposta.data?.user?.email || null;
    await AsyncStorage.setItem(CONECTADO_KEY, 'true');
    if (email) await AsyncStorage.setItem(EMAIL_KEY, email);

    const envio = await enviarBackupAgora();
    if (!envio.sucesso) {
      // Login funcionou, mas o envio falhou (ex.: sem espaço). Mantém
      // conectado — o app tenta de novo automaticamente depois.
      return { sucesso: true, email: email || undefined, erro: envio.erro };
    }
    return { sucesso: true, email: email || undefined };
  } catch (e: any) {
    return { sucesso: false, erro: e?.message || 'Não foi possível conectar ao Google Drive.' };
  }
}

export async function desconectarDrive() {
  try {
    if (GoogleSignin) {
      configurar();
      await GoogleSignin.signOut();
    }
  } catch {
    // silencioso
  }
  await AsyncStorage.multiRemove([CONECTADO_KEY, EMAIL_KEY, ULTIMO_BACKUP_KEY]);
}

async function obterAccessToken(): Promise<string | null> {
  if (!GoogleSignin) return null;
  configurar();
  try {
    // Tenta usar a sessão já guardada no aparelho (sem mostrar nada pro
    // usuário). Só falha se o usuário nunca conectou ou revogou o acesso.
    const silenciosa = await GoogleSignin.signInSilently();
    if (isNoSavedCredentialFoundResponse && isNoSavedCredentialFoundResponse(silenciosa)) {
      return null;
    }
    const tokens = await GoogleSignin.getTokens();
    return tokens?.accessToken || null;
  } catch {
    return null;
  }
}

async function buscarIdArquivoExistente(accessToken: string): Promise<string | null> {
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27${DRIVE_FILE_NAME}%27&fields=files(id)`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Falha ao consultar Drive (${res.status})`);
  const dados = await res.json();
  return dados?.files?.[0]?.id || null;
}

async function criarArquivo(accessToken: string, conteudo: string) {
  const boundary = 'faladinheiro_boundary_' + Date.now();
  const metadata = { name: DRIVE_FILE_NAME, parents: ['appDataFolder'] };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${conteudo}\r\n` +
    `--${boundary}--`;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`Falha ao criar backup no Drive (${res.status})`);
}

async function atualizarArquivo(accessToken: string, fileId: string, conteudo: string) {
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: conteudo,
  });
  if (!res.ok) throw new Error(`Falha ao atualizar backup no Drive (${res.status})`);
}

// Envia o backup agora, de forma imediata (usado pelo botão manual e logo
// após conectar). Retorna sucesso/erro para poder mostrar feedback na tela.
export async function enviarBackupAgora(): Promise<{ sucesso: boolean; erro?: string }> {
  if (!GoogleSignin) return { sucesso: false, erro: 'Recurso indisponível.' };
  try {
    const token = await obterAccessToken();
    if (!token) return { sucesso: false, erro: 'Não conectado ao Google Drive.' };

    const backup = await montarBackup();
    const temConteudo = (backup.lancamentos?.length || 0) > 0 || (backup.cartoes?.length || 0) > 0 || (backup.contas?.length || 0) > 0;
    if (!temConteudo) return { sucesso: false, erro: 'Ainda não há dados para fazer backup.' };

    const conteudo = JSON.stringify(backup);
    const idExistente = await buscarIdArquivoExistente(token);
    if (idExistente) {
      await atualizarArquivo(token, idExistente, conteudo);
    } else {
      await criarArquivo(token, conteudo);
    }
    await AsyncStorage.setItem(ULTIMO_BACKUP_KEY, new Date().toISOString());
    return { sucesso: true };
  } catch (e: any) {
    return { sucesso: false, erro: e?.message || 'Não foi possível enviar o backup ao Drive.' };
  }
}

// Chamado automaticamente pelo app (ex.: ao abrir). Nunca lança erro, nunca
// bloqueia — se o usuário não conectou o Drive, não sem espaço, não tem
// internet, etc., simplesmente não faz nada. No máximo 1x a cada 20 horas
// para não gastar bateria/dados à toa.
export async function executarBackupAutomatico() {
  try {
    if (!GoogleSignin) return;
    const conectado = (await AsyncStorage.getItem(CONECTADO_KEY)) === 'true';
    if (!conectado) return;

    const ultimo = await AsyncStorage.getItem(ULTIMO_BACKUP_KEY);
    if (ultimo) {
      const horasDesde = (Date.now() - new Date(ultimo).getTime()) / (1000 * 60 * 60);
      if (horasDesde < 20) return;
    }
    await enviarBackupAgora();
  } catch {
    // silencioso — backup no Drive nunca pode afetar o uso do app
  }
}
