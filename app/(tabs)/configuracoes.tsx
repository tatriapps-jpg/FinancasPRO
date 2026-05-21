import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, Linking, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { buscarCartoes, buscarTodosLancamentos, restaurarCartoes, restaurarLancamentos, zerarLancamentos } from '../database';
import HelpModal, { helpBtnStyle, helpTxtStyle } from '../HelpModal';
import { Colors, useTheme } from '../theme';

const ORC_KEY = '@financaspro:orcamento';

export default function ConfiguracoesScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = makeStyles(colors);

  const [helpVisible, setHelpVisible] = useState(false);
  const [modalZerar, setModalZerar] = useState(false);
  const [modalResetTotal, setModalResetTotal] = useState(false);
  const [pinResetInput, setPinResetInput] = useState('');
  const [modalResetOrcamento, setModalResetOrcamento] = useState(false);
  const [modalRestaurar, setModalRestaurar] = useState(false);
  const [modalAjuda, setModalAjuda] = useState(false);
  const [modalNome, setModalNome] = useState(false);
  const [backupInfo, setBackupInfo] = useState<any>(null);
  const [vozVelocidade, setVozVelocidade] = useState(1.3);
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [nomeInput, setNomeInput] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('@financaspro:vozVelocidade').then(v => {
      if (v) setVozVelocidade(parseFloat(v));
    });
    AsyncStorage.getItem('@financaspro:nomeUsuario').then(v => {
      if (v) setNomeUsuario(v);
    });
  }, []);

  async function salvarNome() {
    const nome = nomeInput.trim();
    await AsyncStorage.setItem('@financaspro:nomeUsuario', nome);
    setNomeUsuario(nome);
    setModalNome(false);
  }

  async function salvarVozVelocidade(v: number) {
    setVozVelocidade(v);
    await AsyncStorage.setItem('@financaspro:vozVelocidade', String(v));
  }

  async function resetPin() {
    await AsyncStorage.removeItem('@financaspro:pin');
    router.replace('/pin');
  }

  async function fazerBackup() {
    try {
      const lancamentos = buscarTodosLancamentos();
      const cartoes = buscarCartoes();
      const contas = await AsyncStorage.getItem('@financaspro:contas');
      const orcamento = await AsyncStorage.getItem('@financaspro:orcamento');
      const alerta = await AsyncStorage.getItem('@financaspro:diasAlerta');
      const catDesp = await AsyncStorage.getItem('@financaspro:categorias_despesa');
      const catRec = await AsyncStorage.getItem('@financaspro:categorias_receita');

      const backup = {
        versao: '1.0',
        data: new Date().toISOString(),
        lancamentos,
        cartoes,
        contas: contas ? JSON.parse(contas) : [],
        orcamento: orcamento || '5000',
        diasAlerta: alerta || '3',
        categoriasDespesa: catDesp ? JSON.parse(catDesp) : [],
        categoriasReceita: catRec ? JSON.parse(catRec) : [],
      };

      const json = JSON.stringify(backup, null, 2);
      const dataHoje = new Date().toISOString().split('T')[0];
      const path = FileSystem.documentDirectory + `FalaDinheiro_backup_${dataHoje}.json`;

      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });

      const podeCompartilhar = await Sharing.isAvailableAsync();
      if (podeCompartilhar) {
        await Sharing.shareAsync(path, {
          mimeType: 'application/json',
          dialogTitle: 'Salvar backup do Fala, Dinheiro!',
        });
      } else {
        Alert.alert('Backup criado!', `Arquivo salvo em:\n${path}`);
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível criar o backup.');
    }
  }

  async function selecionarBackup() {
    try {
      const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory!);
      const backups = files.filter(f => f.startsWith('FalaDinheiro_backup_') && f.endsWith('.json'));
      if (backups.length === 0) {
        Alert.alert('Nenhum backup encontrado', 'Faça um backup antes de restaurar.');
        return;
      }
      backups.sort().reverse();
      const path = FileSystem.documentDirectory + backups[0];
      const json = await FileSystem.readAsStringAsync(path);
      const dados = JSON.parse(json);
      setBackupInfo({ ...dados, arquivo: backups[0] });
      setModalRestaurar(true);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível ler o backup.');
    }
  }

  async function confirmarRestauracao() {
    try {
      if (!backupInfo) return;
      restaurarLancamentos(backupInfo.lancamentos || []);
      restaurarCartoes(backupInfo.cartoes || []);
      await AsyncStorage.setItem('@financaspro:contas', JSON.stringify(backupInfo.contas || []));
      if (backupInfo.orcamento) await AsyncStorage.setItem('@financaspro:orcamento', backupInfo.orcamento);
      if (backupInfo.diasAlerta) await AsyncStorage.setItem('@financaspro:diasAlerta', backupInfo.diasAlerta);
      if (backupInfo.categoriasDespesa) await AsyncStorage.setItem('@financaspro:categorias_despesa', JSON.stringify(backupInfo.categoriasDespesa));
      if (backupInfo.categoriasReceita) await AsyncStorage.setItem('@financaspro:categorias_receita', JSON.stringify(backupInfo.categoriasReceita));
      setModalRestaurar(false);
      Alert.alert('✅ Restaurado!', 'Todos os dados foram restaurados com sucesso.');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível restaurar o backup.');
    }
  }

  async function resetarOrcamento() {
    await AsyncStorage.removeItem(ORC_KEY);
    setModalResetOrcamento(false);
    Alert.alert('✅ Pronto!', 'O orçamento mensal foi resetado.');
  }

  function executarZerar() {
    zerarLancamentos();
    setModalZerar(false);
    Alert.alert('✅ Pronto!', 'Todos os lançamentos foram apagados.');
  }

  async function executarResetTotal() {
    const pinSalvo = await AsyncStorage.getItem('@financaspro:pin');
    if (pinResetInput !== pinSalvo) {
      Alert.alert('PIN incorreto', 'Digite o PIN correto para confirmar o reset.');
      return;
    }
    zerarLancamentos();
    restaurarCartoes([]);
    await AsyncStorage.multiRemove(['@financaspro:contas','@financaspro:orcamento','@financaspro:diasAlerta','@financaspro:categorias_despesa','@financaspro:categorias_receita','@financaspro:nomeUsuario','@financaspro:pin']);
    setModalResetTotal(false);
    setPinResetInput('');
    Alert.alert('✅ Reset concluído', 'O aplicativo foi restaurado ao estado inicial.', [{ text: 'OK', onPress: () => router.replace('/pin') }]);
  }

  const fmt = (d: string) => {
    const data = new Date(d);
    return `${data.getDate().toString().padStart(2,'0')}/${(data.getMonth()+1).toString().padStart(2,'0')}/${data.getFullYear()} ${data.getHours().toString().padStart(2,'0')}:${data.getMinutes().toString().padStart(2,'0')}`;
  };

  const ajudaItens = [
    { ico: '📋', titulo: 'Lançamentos', desc: 'Toque em + para adicionar. Toque para editar, pressione e segure para excluir.' },
    { ico: '💳', titulo: 'Parcelamento', desc: 'Selecione Crédito, escolha o cartão e as parcelas. O app calcula os vencimentos automaticamente.' },
    { ico: '📊', titulo: 'Orçamento', desc: 'Define o limite mensal de gastos. Só despesas são descontadas — receitas não interferem.' },
    { ico: '🔔', titulo: 'Alertas', desc: 'Na tela inicial toque no banner verde para configurar o prazo de aviso de vencimentos.' },
    { ico: '💾', titulo: 'Backup', desc: 'Em Configurações → Dados → Fazer Backup. Guarde o arquivo em local seguro.' },
    { ico: '🔐', titulo: 'PIN', desc: 'Em Configurações → Alterar PIN. Anote seu PIN em local seguro.' },
    { ico: '🏷️', titulo: 'Categorias', desc: 'Personalize suas categorias em Configurações → Gerenciar Categorias.' },
    { ico: '📈', titulo: 'Relatórios', desc: 'Use as setas para navegar entre meses e ver comparativos de gastos por categoria.' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Configurações</Text>
          <Text style={styles.headerSub}>Fala, Dinheiro!</Text>
        </View>
        <TouchableOpacity onPress={() => setHelpVisible(true)} style={helpBtnStyle}>
          <Text style={helpTxtStyle}>?</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>APARÊNCIA</Text>
      <View style={styles.group}>
        <View style={styles.row}>
          <Text style={styles.rowIco}>{isDark ? '🌙' : '☀️'}</Text>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Tema {isDark ? 'Escuro' : 'Claro'}</Text>
            <Text style={styles.rowSub}>{isDark ? 'Interface escura ativa' : 'Interface clara ativa'}</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#d1d5db', true: 'rgba(82,148,255,0.4)' }}
            thumbColor={isDark ? '#5294ff' : '#f4f4f4'}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowIco}>🔊</Text>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Velocidade da voz</Text>
            <Text style={styles.rowSub}>Velocidade da leitura em voz alta</Text>
          </View>
        </View>
        <View style={styles.vozBtns}>
          {([{ label: '🐢 Lenta', v: 1.0 }, { label: '▶️ Normal', v: 1.3 }, { label: '⚡ Rápida', v: 1.6 }] as const).map(({ label, v }) => (
            <TouchableOpacity
              key={v}
              style={[styles.vozBtn, vozVelocidade === v && styles.vozBtnOn]}
              onPress={() => salvarVozVelocidade(v)}
            >
              <Text style={[styles.vozBtnTxt, vozVelocidade === v && styles.vozBtnTxtOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={styles.sectionTitle}>CONTA E SEGURANÇA</Text>
      <View style={styles.group}>
        <TouchableOpacity style={styles.row} onPress={resetPin}>
          <Text style={styles.rowIco}>🔐</Text>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Alterar PIN</Text>
            <Text style={styles.rowSub}>Trocar senha de acesso</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} onPress={() => router.replace('/pin')}>
          <Text style={styles.rowIco}>🔒</Text>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Bloquear App</Text>
            <Text style={styles.rowSub}>Voltar para a tela de PIN</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>CARTÕES E CONTAS</Text>
      <View style={styles.group}>
        <TouchableOpacity style={styles.row} onPress={() => router.push('/cartoes' as any)}>
          <Text style={styles.rowIco}>💳</Text>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Meus Cartões</Text>
            <Text style={styles.rowSub}>Cadastrar e gerenciar cartões</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} onPress={() => router.push('/contas' as any)}>
          <Text style={styles.rowIco}>🏦</Text>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Minhas Contas</Text>
            <Text style={styles.rowSub}>Cadastrar contas bancárias</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>CATEGORIAS</Text>
      <View style={styles.group}>
        <TouchableOpacity style={styles.row} onPress={() => router.push('/categorias' as any)}>
          <Text style={styles.rowIco}>🏷️</Text>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Gerenciar Categorias</Text>
            <Text style={styles.rowSub}>Criar, editar e excluir categorias</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>DADOS</Text>
      <View style={styles.group}>
        <TouchableOpacity style={styles.row} onPress={fazerBackup}>
          <Text style={styles.rowIco}>💾</Text>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Fazer Backup</Text>
            <Text style={styles.rowSub}>Exportar todos os dados em JSON</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} onPress={selecionarBackup}>
          <Text style={styles.rowIco}>📥</Text>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Restaurar Backup</Text>
            <Text style={styles.rowSub}>Recuperar dados de um backup anterior</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} onPress={() => setModalZerar(true)}>
          <Text style={styles.rowIco}>🗑️</Text>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Zerar Lançamentos</Text>
            <Text style={styles.rowSub}>Apagar todos os lançamentos</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} onPress={() => setModalResetOrcamento(true)}>
          <Text style={styles.rowIco}>🔄</Text>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Resetar Orçamento</Text>
            <Text style={styles.rowSub}>Zerar o limite mensal definido</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} onPress={() => { setPinResetInput(''); setModalResetTotal(true); }}>
          <Text style={styles.rowIco}>⚠️</Text>
          <View style={styles.rowInfo}>
            <Text style={[styles.rowTitle, { color: '#f25555' }]}>Resetar Aplicativo</Text>
            <Text style={styles.rowSub}>Apaga todos os dados e volta ao início</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>SOBRE</Text>
      <View style={styles.group}>
        <TouchableOpacity style={styles.row} onPress={() => setModalAjuda(true)}>
          <Text style={styles.rowIco}>❓</Text>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Ajuda</Text>
            <Text style={styles.rowSub}>Como usar o Fala, Dinheiro!</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('mailto:tatriapps@gmail.com')}>
          <Text style={styles.rowIco}>📧</Text>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Contato / Suporte</Text>
            <Text style={styles.rowSub}>tatriapps@gmail.com</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} onPress={() => router.push('/politica' as any)}>
          <Text style={styles.rowIco}>🔒</Text>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Política de Privacidade</Text>
            <Text style={styles.rowSub}>Como tratamos seus dados</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowIco}>💰</Text>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Fala, Dinheiro!</Text>
            <Text style={styles.rowSub}>Versão 1.0.0 · TaTri Apps © 2026</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 40 }} />

      {/* Modal Reset Total */}
      <Modal visible={modalResetTotal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalIco}>⚠️</Text>
            <Text style={styles.modalTitle}>Resetar Aplicativo</Text>
            <Text style={styles.modalSub}>Esta ação apaga todos os dados: lançamentos, contas, cartões, categorias e configurações.</Text>
            <TextInput style={styles.modalInput} placeholder="Digite seu PIN..." placeholderTextColor={colors.textMuted} value={pinResetInput} onChangeText={setPinResetInput} keyboardType="numeric" secureTextEntry maxLength={6} autoFocus />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => { setModalResetTotal(false); setPinResetInput(''); }}>
                <Text style={styles.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnSave, { backgroundColor: '#f25555' }]} onPress={executarResetTotal}>
                <Text style={styles.btnSaveTxt}>Resetar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Nome */}
      <Modal visible={modalNome} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalIco}>👤</Text>
            <Text style={styles.modalTitle}>Meu nome</Text>
            <Text style={styles.modalSub}>Como deseja ser chamado no app?</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Digite seu nome..."
              placeholderTextColor={colors.textMuted}
              value={nomeInput}
              onChangeText={setNomeInput}
              autoFocus
              maxLength={30}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setModalNome(false)}>
                <Text style={styles.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={salvarNome}>
                <Text style={styles.btnSaveTxt}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Zerar */}
      <Modal visible={modalZerar} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalIco}>⚠️</Text>
            <Text style={styles.modalTitle}>Zerar Lançamentos</Text>
            <Text style={styles.modalSub}>Todos os lançamentos serão apagados permanentemente. Cartões, contas e configurações serão mantidos.</Text>
            <Text style={styles.modalAviso}>Recomendamos fazer um backup antes!</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setModalZerar(false)}>
                <Text style={styles.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnDanger} onPress={executarZerar}>
                <Text style={styles.btnDangerTxt}>Zerar tudo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Reset Orçamento */}
      <Modal visible={modalResetOrcamento} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalIco}>🔄</Text>
            <Text style={styles.modalTitle}>Resetar Orçamento</Text>
            <Text style={styles.modalSub}>O limite mensal será removido e o orçamento ficará desativado.</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setModalResetOrcamento(false)}>
                <Text style={styles.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnDanger} onPress={resetarOrcamento}>
                <Text style={styles.btnDangerTxt}>Resetar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Restaurar */}
      <Modal visible={modalRestaurar} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalIco}>📥</Text>
            <Text style={styles.modalTitle}>Restaurar Backup</Text>
            {backupInfo && (
              <>
                <Text style={styles.modalSub}>Arquivo: {backupInfo.arquivo}</Text>
                <Text style={styles.modalSub}>Data: {fmt(backupInfo.data)}</Text>
                <Text style={styles.modalSub}>Lançamentos: {backupInfo.lancamentos?.length || 0}</Text>
                <Text style={styles.modalSub}>Cartões: {backupInfo.cartoes?.length || 0}</Text>
                <Text style={styles.modalSub}>Contas: {backupInfo.contas?.length || 0}</Text>
              </>
            )}
            <Text style={styles.modalAviso}>Os dados atuais serão substituídos pelo backup!</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setModalRestaurar(false)}>
                <Text style={styles.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={confirmarRestauracao}>
                <Text style={styles.btnSaveTxt}>Restaurar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <HelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        title="Como usar as Configurações"
        tips={[
          'APARÊNCIA: alterne entre tema claro e escuro, e ajuste a velocidade da leitura por voz.',
          'CONTA E SEGURANÇA: defina seu nome, altere o PIN ou bloqueie o app imediatamente.',
          'CARTÕES E CONTAS: cadastre cartões de crédito e contas bancárias para uso nos lançamentos.',
          'CATEGORIAS: crie, edite ou exclua categorias personalizadas de despesa e receita.',
          'DADOS: faça backup de todos os dados em JSON, restaure um backup anterior ou apague todos os lançamentos.',
          'Resetar Orçamento remove o limite mensal definido — o card de orçamento voltará a exibir "Não definido".',
          'SOBRE: acesse a ajuda rápida, envie feedback por e-mail ou leia a política de privacidade.',
        ]}
      />

      {/* Modal Ajuda */}
      <Modal visible={modalAjuda} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalBox, { maxHeight: '90%' }]}>
            <Text style={styles.modalIco}>❓</Text>
            <Text style={styles.modalTitle}>Ajuda Rápida</Text>
            <ScrollView style={{ marginBottom: 16 }} showsVerticalScrollIndicator={false}>
              {ajudaItens.map((item, i) => (
                <View key={i} style={styles.ajudaRow}>
                  <Text style={styles.ajudaIco}>{item.ico}</Text>
                  <View style={styles.ajudaInfo}>
                    <Text style={styles.ajudaTitulo}>{item.titulo}</Text>
                    <Text style={styles.ajudaDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.btnAjudaVoltar} onPress={() => setModalAjuda(false)}>
              <Text style={styles.btnAjudaVoltarTxt}>←</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex:1, backgroundColor:c.bg },
    header: { padding:22, paddingTop:50, flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between' },
    headerTitle: { fontSize:22, fontWeight:'700', color:c.text },
    headerSub: { fontSize:13, color:c.textMuted, marginTop:2 },
    sectionTitle: { fontSize:11, fontWeight:'600', color:c.textMuted, letterSpacing:0.8, paddingHorizontal:22, paddingTop:20, paddingBottom:8 },
    group: { marginHorizontal:16, backgroundColor:c.card, borderRadius:16, borderWidth:1, borderColor:c.border, overflow:'hidden' },
    row: { flexDirection:'row', alignItems:'center', padding:16 },
    rowIco: { fontSize:22, marginRight:14 },
    rowInfo: { flex:1 },
    rowTitle: { fontSize:14, fontWeight:'500', color:c.text },
    rowSub: { fontSize:12, color:c.textMuted, marginTop:2 },
    rowArrow: { fontSize:20, color:c.textMuted },
    divider: { height:1, backgroundColor:c.borderLight, marginLeft:52 },
    modalBg: { flex:1, backgroundColor:'rgba(0,0,0,0.75)', justifyContent:'center', padding:24 },
    modalBox: { backgroundColor:c.card, borderRadius:20, padding:24, borderWidth:1, borderColor:c.border },
    modalIco: { fontSize:36, textAlign:'center', marginBottom:8 },
    modalTitle: { fontSize:17, fontWeight:'700', color:c.text, marginBottom:10, textAlign:'center' },
    modalSub: { fontSize:13, color:c.textSec, marginBottom:6, textAlign:'center' },
    modalAviso: { fontSize:12, color:'#f7b731', marginTop:8, marginBottom:16, textAlign:'center', fontStyle:'italic' },
    modalBtns: { flexDirection:'row', gap:10 },
    modalInput: { backgroundColor:c.input, borderWidth:1, borderColor:c.border, borderRadius:11, padding:12, color:c.text, fontSize:15, marginBottom:16 },
    btnCancel: { flex:1, padding:13, backgroundColor:c.input, borderRadius:11, alignItems:'center', borderWidth:1, borderColor:c.border },
    btnCancelTxt: { color:c.textSec, fontWeight:'600', fontSize:14 },
    btnSave: { padding:13, backgroundColor:'#5294ff', borderRadius:11, alignItems:'center', flex:1 },
    btnSaveTxt: { color:'#fff', fontWeight:'600', fontSize:14 },
    btnDanger: { flex:1, padding:13, backgroundColor:'#f25555', borderRadius:11, alignItems:'center' },
    btnDangerTxt: { color:'#fff', fontWeight:'600', fontSize:14 },
    vozBtns: { flexDirection:'row', gap:8, paddingHorizontal:16, paddingBottom:14 },
    vozBtn: { flex:1, paddingVertical:9, borderRadius:10, alignItems:'center', backgroundColor:c.input, borderWidth:1, borderColor:c.border },
    vozBtnOn: { backgroundColor:'rgba(82,148,255,0.15)', borderColor:'#5294ff' },
    vozBtnTxt: { fontSize:12, color:c.textSec, fontWeight:'600' },
    vozBtnTxtOn: { color:'#5294ff' },
    ajudaRow: { flexDirection:'row', paddingVertical:12, borderBottomWidth:1, borderBottomColor:c.borderLight },
    ajudaIco: { fontSize:24, marginRight:14, width:32 },
    ajudaInfo: { flex:1 },
    ajudaTitulo: { fontSize:13, fontWeight:'700', color:c.text, marginBottom:3 },
    ajudaDesc: { fontSize:12, color:c.textSec, lineHeight:18 },
    btnAjudaVoltar: { alignItems:'center', paddingVertical:12 },
    btnAjudaVoltarTxt: { fontSize:28, color:'#5294ff' },
  });
}
