import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as XLSX from 'xlsx';
import { buscarTodosLancamentos, buscarTransferenciasPorConta } from './database';
import HelpModal, { helpBtnStyle, helpTxtStyle } from './HelpModal';
import { Colors, useTheme } from './theme';

const CONTAS_KEY = '@financaspro:contas';

export default function DinheiroScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [helpVisible, setHelpVisible] = useState(false);
  const [saldo, setSaldo] = useState(0);
  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);
  const [modalEditar, setModalEditar] = useState(false);
  const [novoSaldoInput, setNovoSaldoInput] = useState('');
  const [exportando, setExportando] = useState(false);

  useFocusEffect(useCallback(() => { carregarDados(); }, []));

  async function carregarDados() {
    const saved = await AsyncStorage.getItem(CONTAS_KEY);
    const lista = saved ? JSON.parse(saved) : [];
    const especie = lista.find((c: any) => c.id === 'especie_fixa');
    setSaldo(especie ? parseFloat(especie.saldo) || 0 : 0);
    const toDate = (d: string) => { const p = d?.split('/'); if (!p || p.length !== 3) return 0; return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0])).getTime(); };
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    const doMesAtual = (data: string) => {
      const p = data?.split('/');
      if (!p || p.length !== 3) return false;
      return Number(p[1]) - 1 === mesAtual && Number(p[2]) === anoAtual;
    };
    const todos = buscarTodosLancamentos();
    const movs = todos
      .filter((l: any) => (l.formaPag === 'Dinheiro' || l.formaPag === 'Espécie' || l.contaId === 'especie_fixa') && doMesAtual(l.data))
      .sort((a: any, b: any) => toDate(b.data) - toDate(a.data));
    const transf = buscarTransferenciasPorConta('especie_fixa');
    const nomeConta = (id: string) => {
      if (id === 'especie_fixa') return 'Dinheiro em Espécie';
      const c = lista.find((x: any) => x.id === id);
      return c ? c.nome : id;
    };
    const linhasTransf = transf
      .filter((t: any) => doMesAtual(t.data))
      .map((t: any) => {
        const ehEntrada = t.contaDestinoId === 'especie_fixa';
        return {
          id: t.id,
          descricao: ehEntrada ? `Transferência de ${nomeConta(t.contaOrigemId)}` : `Transferência para ${nomeConta(t.contaDestinoId)}`,
          valor: t.valor,
          tipo: ehEntrada ? 'receita' : 'despesa',
          data: t.data || '',
          formaPag: 'Transferência',
          status: 'concluído',
        };
      });
    setMovimentacoes([...movs, ...linhasTransf].sort((a, b) => toDate(b.data) - toDate(a.data)));
  }

  async function editarSaldo() {
    const valorStr = novoSaldoInput.trim().replace(',', '.');
    const valor = parseFloat(valorStr);
    if (isNaN(valor)) { Alert.alert('Atenção', 'Digite um valor válido.'); return; }
    const saved = await AsyncStorage.getItem(CONTAS_KEY);
    const lista = saved ? JSON.parse(saved) : [];
    const jaExiste = lista.some((c: any) => c.id === 'especie_fixa');
    let novas;
    if (jaExiste) {
      novas = lista.map((c: any) => c.id === 'especie_fixa' ? { ...c, saldo: String(valor) } : c);
    } else {
      novas = [...lista, { id: 'especie_fixa', nome: 'Dinheiro em Espécie', banco: 'Espécie', tipo: 'Espécie', saldo: String(valor) }];
    }
    await AsyncStorage.setItem(CONTAS_KEY, JSON.stringify(novas));
    setSaldo(valor);
    setModalEditar(false);
    setNovoSaldoInput('');
  }

  async function gerarExtrato() {
    try {
      setExportando(true);
      if (movimentacoes.length === 0) {
        Alert.alert('Sem movimentações', 'Nenhum lançamento em dinheiro encontrado.');
        return;
      }
      const totalEntradasEsp = movimentacoes.filter((l: any) => l.tipo === 'receita').reduce((s: number, l: any) => s + (l.valor || 0), 0);
      const totalSaidasEsp = movimentacoes.filter((l: any) => l.tipo === 'despesa').reduce((s: number, l: any) => s + (l.valor || 0), 0);
      const saldoInicialEsp = Math.round((saldo - totalEntradasEsp + totalSaidasEsp) * 100) / 100;
      const fmtVal = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const linhaInicial = { 'Data': '', 'Descrição': 'Saldo inicial', 'Categoria': '', 'Tipo': '', 'Valor': fmtVal(saldoInicialEsp), 'Status': '' };
      const linhaFinal = { 'Data': '', 'Descrição': 'Saldo final', 'Categoria': '', 'Tipo': '', 'Valor': fmtVal(saldo), 'Status': '' };
      const dados = [linhaInicial, ...movimentacoes.map((l: any) => ({
        'Data': l.data || '',
        'Descrição': l.descricao || '',
        'Categoria': l.categoria || '',
        'Tipo': l.tipo === 'despesa' ? 'Saída' : 'Entrada',
        'Valor': fmtVal(l.valor || 0),
        'Status': l.status || '',
      })), linhaFinal];
      const ws = XLSX.utils.json_to_sheet(dados);
      ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Dinheiro');
      const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const uint8 = new Uint8Array(wbout);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const base64 = btoa(binary);
      const dataHoje = new Date().toISOString().split('T')[0];
      const uri = `${FileSystem.documentDirectory}Extrato_Dinheiro_${dataHoje}.xlsx`;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
      const disponivel = await Sharing.isAvailableAsync();
      if (!disponivel) { Alert.alert('Erro', 'Compartilhamento não disponível.'); return; }
      await Sharing.shareAsync(uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: 'Extrato — Dinheiro em Espécie' });
    } catch (e: any) {
      Alert.alert('Erro ao gerar extrato', e?.message || 'Tente novamente.');
    } finally {
      setExportando(false);
    }
  }

  const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const tagColor: Record<string, string> = { pago: '#25d07e', pendente: '#f7b731', parcelado: '#5294ff' };
  const tagLabel: Record<string, string> = { pago: 'Pago', pendente: 'Pendente', parcelado: 'Parc.' };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>💵 Dinheiro em Espécie</Text>
        <TouchableOpacity onPress={() => setHelpVisible(true)} style={helpBtnStyle}>
          <Text style={helpTxtStyle}>?</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.saldoCard}>
          <Text style={styles.saldoLabel}>SALDO EM MÃOS</Text>
          <Text style={[styles.saldoVal, { color: saldo >= 0 ? '#25d07e' : '#f25555' }]}>{fmt(saldo)}</Text>
          <View style={styles.saldoBtns}>
            <TouchableOpacity style={styles.btnEditar} onPress={() => { setNovoSaldoInput(String(saldo)); setModalEditar(true); }}>
              <Text style={styles.btnEditarTxt}>✏️ Editar saldo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnExtrato, exportando && { opacity: 0.5 }]} onPress={gerarExtrato} disabled={exportando}>
              <Text style={styles.btnExtratoTxt}>📄 Extrato Excel</Text>
            </TouchableOpacity>
          </View>
        </View>

        {movimentacoes.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIco}>💵</Text>
            <Text style={styles.emptyTxt}>Nenhuma movimentação em dinheiro</Text>
            <Text style={styles.emptySub}>Lançamentos com forma Dinheiro e transferências envolvendo Dinheiro em Espécie aparecem aqui</Text>
          </View>
        )}

        {movimentacoes.map((l) => (
          <View key={l.id} style={styles.txRow}>
            <View style={styles.txIco}>
              <Text style={{ fontSize: 18 }}>{l.tipo === 'receita' ? '💰' : '💸'}</Text>
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txName}>{l.descricao}</Text>
              <Text style={styles.txCat}>{l.categoria}</Text>
            </View>
            <View style={styles.txRight}>
              <Text style={[styles.txAmt, l.tipo === 'receita' && { color: '#25d07e' }]}>
                {l.tipo === 'receita' ? '+' : '-'}{fmt(l.valor)}
              </Text>
              <Text style={styles.txDate}>{l.data}</Text>
              {l.status && tagLabel[l.status] && (
                <View style={[styles.tag, { backgroundColor: tagColor[l.status] + '22', borderColor: tagColor[l.status] + '55' }]}>
                  <Text style={[styles.tagTxt, { color: tagColor[l.status] }]}>{tagLabel[l.status]}</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={modalEditar} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>✏️ Editar saldo em espécie</Text>
            <Text style={styles.modalSub}>Informe o valor atual que você tem em mãos</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={novoSaldoInput}
              selectTextOnFocus
              onChangeText={setNovoSaldoInput}
              placeholder="0,00"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setModalEditar(false)}>
                <Text style={styles.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={editarSaldo}>
                <Text style={styles.btnSaveTxt}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <HelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        title="Dinheiro em Espécie"
        tips={[
          { emoji: '💵', titulo: 'Dinheiro em Espécie', texto: 'Aqui você controla o dinheiro físico que tem em mãos.' },
          { emoji: '🔄', titulo: 'Saldo automático', texto: 'O saldo é atualizado automaticamente quando você registra lançamentos com forma "Dinheiro".' },
          { emoji: '🔁', titulo: 'Transferências', texto: 'Transferências envolvendo Dinheiro em Espécie também aparecem nesta tela.' },
          { emoji: '🕘', titulo: 'Histórico', texto: 'A tela mostra apenas as movimentações do mês atual. Para ver todo o histórico, exporte o Extrato Excel.' },
          { emoji: '✏️', titulo: 'Editar saldo', texto: 'Use "Editar saldo" para corrigir o valor manualmente sempre que necessário.' },
        ]}
      />
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: c.borderSoft },
    backBtn: { padding: 4 },
    backTxt: { fontSize: 16, color: '#5294ff', fontWeight: '600' },
    headerTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    saldoCard: { margin: 16, backgroundColor: c.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: c.borderSoft, alignItems: 'center' },
    saldoLabel: { fontSize: 11, fontWeight: '700', color: c.textMuted, letterSpacing: 0.8, marginBottom: 8 },
    saldoVal: { fontSize: 36, fontWeight: '700', color: c.text, marginBottom: 16 },
    saldoBtns: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
    btnEditar: { backgroundColor: 'rgba(82,148,255,0.15)', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(82,148,255,0.35)' },
    btnEditarTxt: { fontSize: 13, color: '#5294ff', fontWeight: '700' },
    btnExtrato: { backgroundColor: 'rgba(37,208,126,0.15)', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(37,208,126,0.35)' },
    btnExtratoTxt: { fontSize: 13, color: '#25d07e', fontWeight: '700' },
    empty: { alignItems: 'center', padding: 48 },
    emptyIco: { fontSize: 48, marginBottom: 12 },
    emptyTxt: { fontSize: 15, color: c.textSec, fontWeight: '600' },
    emptySub: { fontSize: 13, color: c.textMuted, marginTop: 4, textAlign: 'center' },
    txRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.borderLight },
    txIco: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.input, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    txInfo: { flex: 1 },
    txName: { fontSize: 14, fontWeight: '600', color: c.text },
    txCat: { fontSize: 11, color: c.textMuted, marginTop: 2 },
    txRight: { alignItems: 'flex-end' },
    txAmt: { fontSize: 14, fontWeight: '700', color: '#f25555' },
    txDate: { fontSize: 11, color: c.textMuted, marginTop: 2 },
    tag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, marginTop: 3 },
    tagTxt: { fontSize: 10, fontWeight: '700' },
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
    modalBox: { backgroundColor: c.card, borderRadius: 20, padding: 24, width: '80%', borderWidth: 1, borderColor: c.border },
    modalTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 6 },
    modalSub: { fontSize: 12, color: c.textMuted, marginBottom: 16 },
    modalInput: { backgroundColor: c.input, borderWidth: 1, borderColor: c.border, borderRadius: 11, padding: 12, color: c.text, fontSize: 18, textAlign: 'center', marginBottom: 16 },
    modalBtns: { flexDirection: 'row', gap: 10 },
    btnCancel: { flex: 1, padding: 12, backgroundColor: c.input, borderRadius: 11, alignItems: 'center', borderWidth: 1, borderColor: c.border },
    btnCancelTxt: { color: c.textSec, fontWeight: '600' },
    btnSave: { flex: 1, padding: 12, backgroundColor: '#5294ff', borderRadius: 11, alignItems: 'center' },
    btnSaveTxt: { color: '#fff', fontWeight: '600' },
  });
}
