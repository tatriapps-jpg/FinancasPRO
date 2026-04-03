import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { buscarTodosLancamentos, restaurarLancamentos, zerarLancamentos } from '../database';

export default function ConfiguracoesScreen() {
  const [modalZerar, setModalZerar] = useState(false);
  const [modalRestaurar, setModalRestaurar] = useState(false);
  const [backupInfo, setBackupInfo] = useState<any>(null);

  async function resetPin() {
    await AsyncStorage.removeItem('@financaspro:pin');
    router.replace('/pin');
  }

  async function fazerBackup() {
    try {
      const lancamentos = buscarTodosLancamentos();
      const cartoes = await AsyncStorage.getItem('@financaspro:cartoes');
      const contas = await AsyncStorage.getItem('@financaspro:contas');
      const orcamento = await AsyncStorage.getItem('@financaspro:orcamento');
      const alerta = await AsyncStorage.getItem('@financaspro:diasAlerta');
      const catDesp = await AsyncStorage.getItem('@financaspro:categorias_despesa');
      const catRec = await AsyncStorage.getItem('@financaspro:categorias_receita');

      const backup = {
        versao: '1.0',
        data: new Date().toISOString(),
        lancamentos,
        cartoes: cartoes ? JSON.parse(cartoes) : [],
        contas: contas ? JSON.parse(contas) : [],
        orcamento: orcamento || '5000',
        diasAlerta: alerta || '3',
        categoriasDespesa: catDesp ? JSON.parse(catDesp) : [],
        categoriasReceita: catRec ? JSON.parse(catRec) : [],
      };

      const json = JSON.stringify(backup, null, 2);
      const dataHoje = new Date().toISOString().split('T')[0];
      const path = FileSystem.documentDirectory + `FinancasPRO_backup_${dataHoje}.json`;

      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });

      const podeCompartilhar = await Sharing.isAvailableAsync();
      if (podeCompartilhar) {
        await Sharing.shareAsync(path, {
          mimeType: 'application/json',
          dialogTitle: 'Salvar backup do FinançasPRO',
        });
      } else {
        Alert.alert('Backup criado!', `Arquivo salvo em:\n${path}`);
      }
    } catch (e) {
      Alert.alert('Erro', 'Nao foi possivel criar o backup.');
    }
  }

  async function selecionarBackup() {
    try {
      const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory!);
      const backups = files.filter(f => f.startsWith('FinancasPRO_backup_') && f.endsWith('.json'));
      if (backups.length === 0) {
        Alert.alert('Nenhum backup encontrado', 'Faca um backup antes de restaurar.');
        return;
      }
      backups.sort().reverse();
      const path = FileSystem.documentDirectory + backups[0];
      const json = await FileSystem.readAsStringAsync(path);
      const dados = JSON.parse(json);
      setBackupInfo({ ...dados, arquivo: backups[0] });
      setModalRestaurar(true);
    } catch (e) {
      Alert.alert('Erro', 'Nao foi possivel ler o backup.');
    }
  }

  async function confirmarRestauracao() {
    try {
      if (!backupInfo) return;
      restaurarLancamentos(backupInfo.lancamentos || []);
      await AsyncStorage.setItem('@financaspro:cartoes', JSON.stringify(backupInfo.cartoes || []));
      await AsyncStorage.setItem('@financaspro:contas', JSON.stringify(backupInfo.contas || []));
      if (backupInfo.orcamento) await AsyncStorage.setItem('@financaspro:orcamento', backupInfo.orcamento);
      if (backupInfo.diasAlerta) await AsyncStorage.setItem('@financaspro:diasAlerta', backupInfo.diasAlerta);
      if (backupInfo.categoriasDespesa) await AsyncStorage.setItem('@financaspro:categorias_despesa', JSON.stringify(backupInfo.categoriasDespesa));
      if (backupInfo.categoriasReceita) await AsyncStorage.setItem('@financaspro:categorias_receita', JSON.stringify(backupInfo.categoriasReceita));
      setModalRestaurar(false);
      Alert.alert('✅ Restaurado!', 'Todos os dados foram restaurados com sucesso.');
    } catch (e) {
      Alert.alert('Erro', 'Nao foi possivel restaurar o backup.');
    }
  }

  function executarZerar() {
    zerarLancamentos();
    setModalZerar(false);
    Alert.alert('✅ Pronto!', 'Todos os lancamentos foram apagados.');
  }

  const fmt = (d: string) => {
    const data = new Date(d);
    return `${data.getDate().toString().padStart(2,'0')}/${(data.getMonth()+1).toString().padStart(2,'0')}/${data.getFullYear()} ${data.getHours().toString().padStart(2,'0')}:${data.getMinutes().toString().padStart(2,'0')}`;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Configurações</Text>
        <Text style={styles.headerSub}>FinançasPRO</Text>
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
      </View>

      <Text style={styles.sectionTitle}>SOBRE</Text>
      <View style={styles.group}>
        <View style={styles.row}>
          <Text style={styles.rowIco}>💰</Text>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>FinançasPRO</Text>
            <Text style={styles.rowSub}>Versão 1.0.0</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 40 }} />

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#12151e' },
  header: { padding:22, paddingTop:50 },
  headerTitle: { fontSize:22, fontWeight:'700', color:'#f0f3ff' },
  headerSub: { fontSize:13, color:'#6b779a', marginTop:2 },
  sectionTitle: { fontSize:11, fontWeight:'600', color:'#6b779a', letterSpacing:0.8, paddingHorizontal:22, paddingTop:20, paddingBottom:8 },
  group: { marginHorizontal:16, backgroundColor:'#1c2133', borderRadius:16, borderWidth:1, borderColor:'rgba(255,255,255,0.18)', overflow:'hidden' },
  row: { flexDirection:'row', alignItems:'center', padding:16 },
  rowIco: { fontSize:22, marginRight:14 },
  rowInfo: { flex:1 },
  rowTitle: { fontSize:14, fontWeight:'500', color:'#f0f3ff' },
  rowSub: { fontSize:12, color:'#6b779a', marginTop:2 },
  rowArrow: { fontSize:20, color:'#6b779a' },
  divider: { height:1, backgroundColor:'rgba(255,255,255,0.06)', marginLeft:52 },
  modalBg: { flex:1, backgroundColor:'rgba(0,0,0,0.75)', justifyContent:'center', padding:24 },
  modalBox: { backgroundColor:'#1c2133', borderRadius:20, padding:24, borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  modalIco: { fontSize:36, textAlign:'center', marginBottom:8 },
  modalTitle: { fontSize:17, fontWeight:'700', color:'#f0f3ff', marginBottom:10, textAlign:'center' },
  modalSub: { fontSize:13, color:'#aab4d0', marginBottom:6, textAlign:'center' },
  modalAviso: { fontSize:12, color:'#f7b731', marginTop:8, marginBottom:16, textAlign:'center', fontStyle:'italic' },
  modalBtns: { flexDirection:'row', gap:10 },
  btnCancel: { flex:1, padding:13, backgroundColor:'#2a3148', borderRadius:11, alignItems:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  btnCancelTxt: { color:'#aab4d0', fontWeight:'600', fontSize:14 },
  btnSave: { flex:1, padding:13, backgroundColor:'#5294ff', borderRadius:11, alignItems:'center' },
  btnSaveTxt: { color:'#fff', fontWeight:'600', fontSize:14 },
  btnDanger: { flex:1, padding:13, backgroundColor:'#f25555', borderRadius:11, alignItems:'center' },
  btnDangerTxt: { color:'#fff', fontWeight:'600', fontSize:14 },
});