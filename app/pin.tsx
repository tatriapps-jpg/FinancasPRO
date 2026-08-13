import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import { lerBackupAutomatico } from './backup';
import { restaurarCartoes, restaurarLancamentos, restaurarTransferencias, zerarLancamentos } from './database';
import { Colors, useTheme } from './theme';

const PIN_KEY = '@financaspro:pin';
const BIO_KEY = '@financaspro:biometriaAtiva';
const PIN_PULADO_KEY = '@financaspro:pinPulado';

export default function PinScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'verify'|'create'|'confirm'>('verify');
  const [newPin, setNewPin] = useState('');
  const [title, setTitle] = useState('Digite seu PIN');
  const [subtitle, setSubtitle] = useState('');

  const [bioDisponivel, setBioDisponivel] = useState(false);
  const [bioAtiva, setBioAtiva] = useState(false);
  const [modalEsqueci, setModalEsqueci] = useState(false);
  const [confirmApagar, setConfirmApagar] = useState('');
  const jaTentouAuto = useRef(false);

  useEffect(() => {
    checkPin();
  }, []);

  async function checkPin() {
    const saved = await AsyncStorage.getItem(PIN_KEY);
    const hardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = hardware ? await LocalAuthentication.isEnrolledAsync() : false;
    const disponivel = hardware && enrolled;
    setBioDisponivel(disponivel);

    if (!saved) {
      setMode('create');
      setTitle('Crie seu PIN');
      setSubtitle('Digite 4 dígitos para proteger o app');
      return;
    }

    const bioPref = await AsyncStorage.getItem(BIO_KEY);
    const ativa = disponivel && bioPref === 'true';
    setBioAtiva(ativa);

    if (ativa && !jaTentouAuto.current) {
      jaTentouAuto.current = true;
      setTimeout(() => tentarBiometria(), 400);
    }
  }

  async function tentarBiometria() {
    try {
      const resultado = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Desbloquear Fala, Dinheiro!',
        cancelLabel: 'Usar PIN',
        disableDeviceFallback: false,
      });
      if (resultado.success) {
        router.replace('/(tabs)');
      }
    } catch {
      // usuário cancelou ou biometria indisponível no momento — segue com o PIN normalmente
    }
  }

  function pressKey(n: string) {
    if (pin.length >= 4) return;
    const newVal = pin + n;
    setPin(newVal);
    setError('');

    if (newVal.length === 4) {
      setTimeout(() => handlePin(newVal), 150);
    }
  }

  async function handlePin(value: string) {
    if (mode === 'verify') {
      const saved = await AsyncStorage.getItem(PIN_KEY);
      if (value === saved) {
        router.replace('/(tabs)');
      } else {
        Vibration.vibrate(400);
        setError('PIN incorreto. Tente novamente.');
        setPin('');
      }
    } else if (mode === 'create') {
      setNewPin(value);
      setMode('confirm');
      setTitle('Confirme seu PIN');
      setSubtitle('Digite o PIN novamente');
      setPin('');
    } else if (mode === 'confirm') {
      if (value === newPin) {
        await AsyncStorage.setItem(PIN_KEY, value);
        await ofertarBiometriaSeDisponivel();
      } else {
        Vibration.vibrate(400);
        setError('PINs não coincidem. Tente novamente.');
        setMode('create');
        setNewPin('');
        setTitle('Crie seu PIN');
        setSubtitle('Digite 4 dígitos para proteger o app');
        setPin('');
      }
    }
  }

  async function prosseguirAposPin() {
    const onboardingConcluido = await AsyncStorage.getItem('@financaspro:onboardingConcluido');
    router.replace(onboardingConcluido === 'true' ? '/(tabs)' : '/onboarding');
  }

  async function pularCriacaoPin() {
    await AsyncStorage.setItem(PIN_PULADO_KEY, 'true');
    await prosseguirAposPin();
  }

  async function ofertarBiometriaSeDisponivel() {
    async function prosseguir() {
      await AsyncStorage.removeItem(PIN_PULADO_KEY);
      await prosseguirAposPin();
    }

    const hardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = hardware ? await LocalAuthentication.isEnrolledAsync() : false;

    if (!hardware || !enrolled) {
      await prosseguir();
      return;
    }

    Alert.alert(
      '🔓 Desbloqueio rápido',
      'Quer usar sua digital ou reconhecimento facial (o mesmo que você usa para desbloquear o celular) para abrir o app, além do PIN?',
      [
        { text: 'Agora não', style: 'cancel', onPress: prosseguir },
        {
          text: 'Ativar',
          onPress: async () => {
            await AsyncStorage.setItem(BIO_KEY, 'true');
            await prosseguir();
          },
        },
      ],
    );
  }

  function delKey() {
    setPin(pin.slice(0, -1));
    setError('');
  }

  function irParaCriarPin() {
    setMode('create');
    setTitle('Crie seu PIN');
    setSubtitle('Digite 4 dígitos para proteger o app');
    setPin('');
  }

  async function restaurarDoAutobackup(dados: any) {
    restaurarLancamentos(dados.lancamentos || []);
    restaurarCartoes(dados.cartoes || []);
    restaurarTransferencias(dados.transferencias || []);
    await AsyncStorage.setItem('@financaspro:contas', JSON.stringify(dados.contas || []));
    if (dados.orcamento) await AsyncStorage.setItem('@financaspro:orcamento', dados.orcamento);
    if (dados.diasAlerta) await AsyncStorage.setItem('@financaspro:diasAlerta', dados.diasAlerta);
    if (dados.categoriasDespesa) await AsyncStorage.setItem('@financaspro:categorias_despesa', JSON.stringify(dados.categoriasDespesa));
    if (dados.categoriasReceita) await AsyncStorage.setItem('@financaspro:categorias_receita', JSON.stringify(dados.categoriasReceita));
    if (dados.nomeUsuario) await AsyncStorage.setItem('@financaspro:nomeUsuario', dados.nomeUsuario);
    await AsyncStorage.setItem('@financaspro:onboardingConcluido', 'true');
  }

  async function confirmarEsqueci() {
    if (confirmApagar.trim().toUpperCase() !== 'APAGAR') {
      Alert.alert('Digite "APAGAR"', 'Para confirmar, digite a palavra APAGAR no campo indicado.');
      return;
    }

    zerarLancamentos();
    restaurarCartoes([]);
    restaurarTransferencias([]);
    await AsyncStorage.multiRemove([
      '@financaspro:contas',
      '@financaspro:orcamento',
      '@financaspro:diasAlerta',
      '@financaspro:categorias_despesa',
      '@financaspro:categorias_receita',
      '@financaspro:nomeUsuario',
      '@financaspro:onboardingConcluido',
      PIN_KEY,
      BIO_KEY,
    ]);
    setModalEsqueci(false);
    setConfirmApagar('');

    // O backup automático fica salvo em arquivo, separado dos dados que acabamos
    // de limpar — então normalmente ainda está disponível para restaurar.
    const autobackup = await lerBackupAutomatico();
    if (autobackup) {
      const dataBackup = new Date(autobackup.data);
      const dataFmt = `${dataBackup.getDate().toString().padStart(2,'0')}/${(dataBackup.getMonth()+1).toString().padStart(2,'0')} às ${dataBackup.getHours().toString().padStart(2,'0')}:${dataBackup.getMinutes().toString().padStart(2,'0')}`;
      const qtd = autobackup.lancamentos?.length || 0;
      Alert.alert(
        '💾 Encontramos um backup',
        `Existe uma cópia automática salva em ${dataFmt} (${qtd} lançamento${qtd === 1 ? '' : 's'}). Quer restaurar antes de continuar?`,
        [
          { text: 'Começar do zero', style: 'cancel', onPress: irParaCriarPin },
          {
            text: 'Restaurar',
            onPress: async () => {
              await restaurarDoAutobackup(autobackup);
              irParaCriarPin();
            },
          },
        ],
      );
    } else {
      Alert.alert('Pronto', 'O app foi reiniciado. Crie um novo PIN para continuar.', [
        { text: 'OK', onPress: irParaCriarPin },
      ]);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>💰</Text>
      <Text style={styles.appName}>Fala, Dinheiro!</Text>
      <Text style={styles.appSub}>Controle Financeiro Pessoal</Text>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <Text style={styles.title}>{title}</Text>

      <View style={styles.dots}>
        {[0,1,2,3].map(i => (
          <View key={i} style={[
            styles.dot,
            pin.length > i && styles.dotFilled,
            error ? styles.dotError : null
          ]} />
        ))}
      </View>

      <Text style={styles.error}>{error || ' '}</Text>

      <View style={styles.pad}>
        {['1','2','3','4','5','6','7','8','9'].map(n => (
          <TouchableOpacity key={n} style={styles.key} onPress={() => pressKey(n)}>
            <Text style={styles.keyNum}>{n}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.keyEmpty} />
        <TouchableOpacity style={styles.key} onPress={() => pressKey('0')}>
          <Text style={styles.keyNum}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.key, styles.keyDel]} onPress={delKey}>
          <Text style={styles.keyNum}>⌫</Text>
        </TouchableOpacity>
      </View>

      {mode === 'verify' && bioAtiva && (
        <TouchableOpacity style={styles.bioBtn} onPress={tentarBiometria}>
          <Text style={styles.bioBtnTxt}>🔓 Usar biometria</Text>
        </TouchableOpacity>
      )}

      {mode === 'verify' && (
        <TouchableOpacity style={styles.esqueciBtn} onPress={() => setModalEsqueci(true)}>
          <Text style={styles.esqueciTxt}>Esqueci meu PIN</Text>
        </TouchableOpacity>
      )}

      {mode === 'create' && (
        <TouchableOpacity style={styles.esqueciBtn} onPress={pularCriacaoPin}>
          <Text style={styles.esqueciTxt}>Configurar depois, em Configurações</Text>
        </TouchableOpacity>
      )}

      <Modal visible={modalEsqueci} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalIco}>⚠️</Text>
            <Text style={styles.modalTitle}>Esqueci meu PIN</Text>
            <Text style={styles.modalSub}>
              Como seus dados ficam só no seu celular (sem servidor), não existe forma de recuperar o PIN em si — a única saída é apagar o acesso atual e começar de novo.
            </Text>
            <Text style={styles.modalSub}>
              O app guarda uma cópia automática dos seus dados no aparelho. Se ela existir, vamos oferecer pra restaurar logo em seguida — mas se ela estiver desatualizada ou não existir, o que não foi salvo se perde.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder='Digite "APAGAR" para confirmar'
              placeholderTextColor={colors.textMuted}
              value={confirmApagar}
              onChangeText={setConfirmApagar}
              autoCapitalize="characters"
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => { setModalEsqueci(false); setConfirmApagar(''); }}>
                <Text style={styles.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnDanger} onPress={confirmarEsqueci}>
                <Text style={styles.btnDangerTxt}>Apagar e recomeçar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex:1, backgroundColor:c.bg, alignItems:'center', justifyContent:'center', padding:24 },
    logo: { fontSize:48, marginBottom:8 },
    appName: { fontSize:24, fontWeight:'700', color:c.text, marginBottom:4 },
    appSub: { fontSize:13, color:c.textMuted, marginBottom:32 },
    subtitle: { fontSize:12, color:c.textMuted, marginBottom:4 },
    title: { fontSize:15, fontWeight:'500', color:c.textSec, marginBottom:24 },
    dots: { flexDirection:'row', gap:16, marginBottom:8 },
    dot: { width:15, height:15, borderRadius:10, borderWidth:2, borderColor:c.textMuted },
    dotFilled: { backgroundColor:'#5294ff', borderColor:'#5294ff' },
    dotError: { backgroundColor:'#f25555', borderColor:'#f25555' },
    error: { fontSize:12, color:'#f25555', marginBottom:24, height:18 },
    pad: { flexDirection:'row', flexWrap:'wrap', width:270, gap:12, justifyContent:'center' },
    key: { width:78, height:68, backgroundColor:c.input, borderRadius:16, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:c.border },
    keyDel: { backgroundColor:c.card },
    keyEmpty: { width:78, height:68 },
    keyNum: { fontSize:22, fontWeight:'600', color:c.text },
    bioBtn: { marginTop:22, paddingVertical:10, paddingHorizontal:18, borderRadius:12, backgroundColor:c.input, borderWidth:1, borderColor:c.border },
    bioBtnTxt: { fontSize:14, fontWeight:'600', color:'#5294ff' },
    esqueciBtn: { marginTop:16, padding:8 },
    esqueciTxt: { fontSize:13, color:c.textMuted, textDecorationLine:'underline' },
    modalBg: { flex:1, backgroundColor:'rgba(0,0,0,0.75)', justifyContent:'center', padding:24 },
    modalBox: { backgroundColor:c.card, borderRadius:20, padding:24, borderWidth:1, borderColor:c.border },
    modalIco: { fontSize:36, textAlign:'center', marginBottom:8 },
    modalTitle: { fontSize:17, fontWeight:'700', color:c.text, marginBottom:10, textAlign:'center' },
    modalSub: { fontSize:13, color:c.textSec, marginBottom:10, textAlign:'center' },
    modalInput: { backgroundColor:c.input, borderWidth:1, borderColor:c.border, borderRadius:11, padding:12, color:c.text, fontSize:15, marginTop:4, marginBottom:16, textAlign:'center' },
    modalBtns: { flexDirection:'row', gap:10 },
    btnCancel: { flex:1, padding:13, backgroundColor:c.input, borderRadius:11, alignItems:'center', borderWidth:1, borderColor:c.border },
    btnCancelTxt: { color:c.textSec, fontWeight:'600', fontSize:14 },
    btnDanger: { flex:1, padding:13, backgroundColor:'#f25555', borderRadius:11, alignItems:'center' },
    btnDangerTxt: { color:'#fff', fontWeight:'600', fontSize:13, textAlign:'center' },
  });
}
