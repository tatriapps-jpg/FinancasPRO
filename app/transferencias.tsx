import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { creditarConta, debitarConta } from './contas';
import { buscarTransferenciasPorConta, gerarId, inserirTransferencia } from './database';
import HelpModal, { helpBtnStyle, helpTxtStyle } from './HelpModal';
import { Colors, useTheme } from './theme';

const CONTAS_KEY = '@financaspro:contas';
type Conta = { id: string; nome: string; banco: string; tipo: string; saldo: string; };

export default function TransferenciasScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [contas, setContas] = useState<Conta[]>([]);
  const [origemId, setOrigemId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [valor, setValor] = useState('');
  const [obs, setObs] = useState('');
  const [data, setData] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [modalOrigem, setModalOrigem] = useState(false);
  const [modalDestino, setModalDestino] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);

  useEffect(() => { carregarContas(); }, []);
  async function carregarContas() {
    const saved = await AsyncStorage.getItem(CONTAS_KEY);
    if (saved) setContas(JSON.parse(saved));
  }
  function formatarData(d: Date) {
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  }
  function nomeConta(id: string) {
    if (id === 'especie_fixa') return 'Dinheiro em Espécie';
    const c = contas.find(c => c.id === id);
    return c ? `${c.nome} — ${c.banco}` : '';
  }

  async function transferir() {
    if (!origemId) { Alert.alert('Atenção', 'Selecione a conta de origem.'); return; }
    if (!destinoId) { Alert.alert('Atenção', 'Selecione a conta de destino.'); return; }
    if (origemId === destinoId) { Alert.alert('Atenção', 'Origem e destino não podem ser iguais.'); return; }
    const valorNum = parseFloat(valor.replace(',', '.'));
    if (!valorNum || valorNum <= 0) { Alert.alert('Atenção', 'Digite um valor válido.'); return; }
    await debitarConta(origemId, valorNum);
    await creditarConta(destinoId, valorNum);
    inserirTransferencia({ id: gerarId(), contaOrigemId: origemId, contaDestinoId: destinoId, valor: valorNum, data: formatarData(data), obs });
    Alert.alert('✅ Transferência realizada!', `R$ ${valorNum.toFixed(2).replace('.', ',')} transferido com sucesso.`, [{ text: 'OK', onPress: () => router.back() }]);
  }

  const todasContas = contas;
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transferências</Text>
        <TouchableOpacity onPress={() => setHelpVisible(true)} style={helpBtnStyle}>
          <Text style={helpTxtStyle}>?</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 200 }}>
        <Text style={styles.lbl}>Conta de origem</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setModalOrigem(true)}>
          <Text style={[styles.selectorTxt, !origemId && { color: colors.textMuted }]}>
            {origemId ? nomeConta(origemId) : 'Selecione a conta...'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.lbl}>Conta de destino</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setModalDestino(true)}>
          <Text style={[styles.selectorTxt, !destinoId && { color: colors.textMuted }]}>
            {destinoId ? nomeConta(destinoId) : 'Selecione a conta...'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.lbl}>Valor R$</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: 150,00"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          value={valor}
          onChangeText={setValor}
        />
        <Text style={styles.lbl}>Data</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setShowPicker(true)}>
          <Text style={styles.selectorTxt}>{formatarData(data)}</Text>
        </TouchableOpacity>
        {showPicker && (
          <DateTimePicker value={data} mode="date" display="default"
            onChange={(_: any, d?: Date) => { setShowPicker(false); if (d) setData(d); }} />
        )}
        <Text style={styles.lbl}>Observação (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: aluguel, presente..."
          placeholderTextColor={colors.textMuted}
          value={obs}
          onChangeText={setObs}
        />
        <TouchableOpacity style={styles.btnTransferir} onPress={transferir}>
          <Text style={styles.btnTransferirTxt}>🔄 Transferir</Text>
        </TouchableOpacity>
      </ScrollView>
      <ModalContas visible={modalOrigem} contas={todasContas} colors={colors}
        onSelect={(id: string) => { setOrigemId(id); setModalOrigem(false); }}
        onClose={() => setModalOrigem(false)} />
      <ModalContas visible={modalDestino} contas={todasContas} colors={colors}
        onSelect={(id: string) => { setDestinoId(id); setModalDestino(false); }}
        onClose={() => setModalDestino(false)} />
    </KeyboardAvoidingView>
      <HelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        title="Transferências"
        tips={[
          { titulo: 'O que é', texto: 'Registre transferências de dinheiro entre suas contas bancárias ou para Dinheiro em Espécie.' },
          { titulo: 'Como usar', texto: 'Selecione a conta de origem, a conta de destino, o valor e a data.' },
          { titulo: 'Extrato', texto: 'As transferências aparecem no extrato de cada conta envolvida.' },
          { titulo: 'Sem impacto no orçamento', texto: 'Transferências não são contadas como despesa nem receita — apenas movimentam saldo entre contas.' },
          { titulo: 'Botão não responde?', texto: 'Role a tela para cima para deixar o botão Transferir totalmente visível antes de tocar.' },
        ]}
      />
    </View>
  );
}

function ModalContas({ visible, contas, onSelect, onClose, colors }: any) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.75)', justifyContent:'flex-end' }}>
        <View style={{ backgroundColor:colors.card, borderRadius:24, padding:24, maxHeight:'70%' }}>
          <Text style={{ fontSize:17, fontWeight:'700', color:colors.text, marginBottom:16 }}>Selecione a conta</Text>
          <ScrollView>
            {contas.map((c: any) => (
              <TouchableOpacity key={c.id} onPress={() => onSelect(c.id)}
                style={{ padding:14, borderBottomWidth:1, borderBottomColor:colors.borderLight }}>
                <Text style={{ fontSize:14, fontWeight:'600', color:colors.text }}>{c.nome}</Text>
                <Text style={{ fontSize:12, color:colors.textMuted }}>{c.banco}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={onClose} style={{ marginTop:16, marginBottom:32, alignItems:'center' }}>
            <Text style={{ color:'#5294ff', fontWeight:'600', fontSize:15 }}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex:1, backgroundColor:c.bg },
    header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, paddingTop:50, borderBottomWidth:1, borderBottomColor:c.borderSoft },
    backBtn: { padding:4, width:70 },
    backTxt: { fontSize:16, color:'#5294ff', fontWeight:'600', flexShrink:1 },
    headerTitle: { fontSize:17, fontWeight:'700', color:c.text },
    lbl: { fontSize:11.5, fontWeight:'500', color:c.textSec, marginBottom:5, marginTop:14 },
    selector: { backgroundColor:c.input, borderWidth:1, borderColor:c.border, borderRadius:11, padding:13 },
    selectorTxt: { fontSize:14, color:c.text },
    input: { backgroundColor:c.input, borderWidth:1, borderColor:c.border, borderRadius:11, padding:13, color:c.text, fontSize:14 },
    btnTransferir: { marginTop:28, backgroundColor:'#5294ff', borderRadius:14, padding:16, alignItems:'center' },
    btnTransferirTxt: { color:'#fff', fontSize:16, fontWeight:'700' },
  });
}
