import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import HelpModal, { helpBtnStyle, helpTxtStyle } from './HelpModal';
import * as XLSX from 'xlsx';
import { buscarTodosLancamentos, gerarId } from './database';
import { Colors, useTheme } from './theme';

const CONTAS_KEY = '@financaspro:contas';

const TIPOS = ['Corrente', 'Poupança', 'Investimento', 'Digital', 'Outro'];
const TIPO_ICON: Record<string, string> = {
  'Corrente': '🏦', 'Poupança': '🐷', 'Investimento': '📈',
  'Digital': '📱', 'Outro': '💰'
};

type Conta = {
  id: string;
  nome: string;
  banco: string;
  tipo: string;
  saldo: string;
};

export async function debitarConta(contaId: string, valor: number): Promise<void> {
  const saved = await AsyncStorage.getItem(CONTAS_KEY);
  if (!saved) return;
  const lista: Conta[] = JSON.parse(saved);
  const novas = lista.map(c => {
    if (c.id === contaId) {
      const novoSaldo = (parseFloat(c.saldo) || 0) - valor;
      return { ...c, saldo: String(novoSaldo) };
    }
    return c;
  });
  await AsyncStorage.setItem(CONTAS_KEY, JSON.stringify(novas));
}

export async function creditarConta(contaId: string, valor: number): Promise<void> {
  const saved = await AsyncStorage.getItem(CONTAS_KEY);
  if (!saved) return;
  const lista: Conta[] = JSON.parse(saved);
  const novas = lista.map(c => {
    if (c.id === contaId) {
      const novoSaldo = (parseFloat(c.saldo) || 0) + valor;
      return { ...c, saldo: String(novoSaldo) };
    }
    return c;
  });
  await AsyncStorage.setItem(CONTAS_KEY, JSON.stringify(novas));
}

export async function buscarContas(): Promise<Conta[]> {
  const saved = await AsyncStorage.getItem(CONTAS_KEY);
  return saved ? JSON.parse(saved) : [];
}

export default function ContasScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [helpVisible, setHelpVisible] = useState(false);
  const [contas, setContas] = useState<Conta[]>([]);
  const [modal, setModal] = useState(false);
  const [nome, setNome] = useState('');
  const [banco, setBanco] = useState('');
  const [tipo, setTipo] = useState('Corrente');
  const [saldo, setSaldo] = useState('');
  const [exportandoId, setExportandoId] = useState<string | null>(null);
  const [contaEditando, setContaEditando] = useState<Conta | null>(null);
  const [modalEditarSaldo, setModalEditarSaldo] = useState(false);
  const [novoSaldoInput, setNovoSaldoInput] = useState('');

  useFocusEffect(useCallback(() => { loadContas(); }, []));

  async function loadContas() {
    const saved = await AsyncStorage.getItem(CONTAS_KEY);
    if (saved) setContas(JSON.parse(saved));
  }

  async function salvarConta() {
    if (!nome.trim()) { Alert.alert('Atenção', 'Digite o nome da conta.'); return; }
    if (!banco.trim()) { Alert.alert('Atenção', 'Digite o nome do banco.'); return; }
    const saved = await AsyncStorage.getItem(CONTAS_KEY);
    const lista: Conta[] = saved ? JSON.parse(saved) : [];
    const nova: Conta = { id: gerarId(), nome, banco, tipo, saldo: parseBRValue(saldo) };
    await AsyncStorage.setItem(CONTAS_KEY, JSON.stringify([...lista, nova]));
    setModal(false);
    limparForm();
    loadContas();
  }

  async function excluirConta(id: string) {
    Alert.alert(
      'Excluir conta',
      'Deseja excluir esta conta? O saldo será removido.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: async () => {
          const saved = await AsyncStorage.getItem(CONTAS_KEY);
          const lista: Conta[] = saved ? JSON.parse(saved) : [];
          await AsyncStorage.setItem(CONTAS_KEY, JSON.stringify(lista.filter(c => c.id !== id)));
          loadContas();
        }}
      ]
    );
  }

  function limparForm() {
    setNome(''); setBanco(''); setTipo('Corrente'); setSaldo('');
  }

  async function editarSaldo() {
    if (!contaEditando) return;
    const normalizado = parseBRValue(novoSaldoInput.trim());
    const novoSaldo = parseFloat(normalizado);
    if (isNaN(novoSaldo)) { Alert.alert('Atenção', 'Digite um valor válido.'); return; }
    const saved = await AsyncStorage.getItem(CONTAS_KEY);
    const lista: Conta[] = saved ? JSON.parse(saved) : [];
    const novas = lista.map(c => c.id === contaEditando!.id ? { ...c, saldo: String(novoSaldo) } : c);
    await AsyncStorage.setItem(CONTAS_KEY, JSON.stringify(novas));
    setModalEditarSaldo(false);
    setContaEditando(null);
    setNovoSaldoInput('');
    loadContas();
  }

  function parseBRValue(val: string): string {
    const v = val.trim();
    const temVirgula = v.includes(',');
    const temPonto = v.includes('.');
    if (temVirgula && temPonto) {
      // "1.200,50" → "1200.50"
      return v.replace(/\./g, '').replace(',', '.');
    }
    if (temVirgula) {
      const decimais = v.split(',')[1] || '';
      return decimais.length === 3 ? v.replace(',', '') : v.replace(',', '.');
    }
    if (temPonto) {
      const partes = v.split('.');
      // "1.500" / "10.000" / "1.000.000" → separador de milhar
      if (partes.length > 2 || partes[partes.length - 1].length === 3) {
        return partes.join('');
      }
      // "1.5" / "99.90" → separador decimal, manter
    }
    return v;
  }

  async function gerarExtrato(conta: Conta) {
    try {
      setExportandoId(conta.id);
      const todos = buscarTodosLancamentos();
      const lancamentos = todos
        .filter((l: any) => String(l.contaId ?? '') === String(conta.id ?? '')  && l.contaId)
        .sort((a: any, b: any) => {
          const toDate = (d: string) => {
            const p = d?.split('/');
            if (!p || p.length !== 3) return 0;
            return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0])).getTime();
          };
          return toDate(a.data) - toDate(b.data);
        });

      if (lancamentos.length === 0) {
        Alert.alert('Sem lançamentos', 'Nenhum lançamento vinculado a esta conta.');
        return;
      }

      const arredondar = (v: number) => Math.round(v * 100) / 100;
      const dados = lancamentos.map((l: any) => ({
        'Data': l.data || '',
        'Descrição': l.descricao || '',
        'Categoria': l.categoria || '',
        'Forma Pag.': l.formaPag || '',
        'Valor': arredondar(Number(l.valor || 0)),
        'Tipo': l.tipo === 'despesa' ? 'Saída' : 'Entrada',
        'Status': l.status || '',
      }));

      const ws = XLSX.utils.json_to_sheet(dados);
      ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 12 }];

      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let row = range.s.r + 1; row <= range.e.r; row++) {
        const cell = ws[XLSX.utils.encode_cell({ r: row, c: 4 })];
        if (cell && cell.t === 'n') cell.z = '#,##0.00';
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, conta.nome.substring(0, 31));

      const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const uint8 = new Uint8Array(wbout);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const base64 = btoa(binary);

      const dataHoje = new Date().toISOString().split('T')[0];
      const nomeArquivo = `Extrato_${conta.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${dataHoje}.xlsx`;
      const uri = `${FileSystem.documentDirectory}${nomeArquivo}`;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });

      const disponivel = await Sharing.isAvailableAsync();
      if (!disponivel) { Alert.alert('Erro', 'Compartilhamento não disponível.'); return; }
      await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `Extrato — ${conta.nome}`,
      });
    } catch (e: any) {
      Alert.alert('Erro ao gerar extrato', e?.message || 'Tente novamente.');
    } finally {
      setExportandoId(null);
    }
  }

  const fmt = (v: string) => {
    const num = parseFloat(v) || 0;
    return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totalSaldo = contas.reduce((s, c) => s + (parseFloat(c.saldo) || 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Minhas Contas</Text>
        <TouchableOpacity onPress={() => setHelpVisible(true)} style={helpBtnStyle}>
          <Text style={helpTxtStyle}>?</Text>
        </TouchableOpacity>
      </View>

      {contas.length > 0 && (
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>SALDO TOTAL</Text>
          <Text style={[styles.totalVal, { color: totalSaldo >= 0 ? '#25d07e' : '#f25555' }]}>
            {fmt(String(totalSaldo))}
          </Text>
        </View>
      )}

      <ScrollView>
        {contas.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIco}>🏦</Text>
            <Text style={styles.emptyTxt}>Nenhuma conta cadastrada</Text>
            <Text style={styles.emptySub}>Toque no + para adicionar</Text>
          </View>
        )}
        {contas.map(c => (
          <View key={c.id} style={styles.contaCard}>
            <Text style={styles.contaIco}>{TIPO_ICON[c.tipo]}</Text>
            <View style={styles.contaInfo}>
              <Text style={styles.contaNome}>{c.nome}</Text>
              <Text style={styles.contaSub}>{c.banco} · {c.tipo}</Text>
              {c.saldo ? (
                <Text style={[styles.contaSaldo, { color: parseFloat(c.saldo) >= 0 ? '#25d07e' : '#f25555' }]}>
                  {fmt(c.saldo)}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => gerarExtrato(c)}
              style={[styles.extratoBtn, exportandoId === c.id && { opacity: 0.5 }]}
              disabled={exportandoId === c.id}
            >
              <Text style={styles.extratoTxt}>📄 Extrato</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setContaEditando(c); setNovoSaldoInput(c.saldo || '0'); setModalEditarSaldo(true); }}
              style={styles.editSaldoBtn}
            >
              <Text style={styles.editSaldoTxt}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => excluirConta(c.id)} style={styles.delBtn}>
              <Text style={styles.delTxt}>🗑</Text>
            </TouchableOpacity>
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setModal(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nova Conta</Text>
            <Text style={styles.lbl}>Tipo de conta</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {TIPOS.map(t => (
                  <TouchableOpacity key={t} style={[styles.tipoBtn, tipo === t && styles.tipoBtnOn]} onPress={() => setTipo(t)}>
                    <Text style={styles.tipoTxt}>{TIPO_ICON[t]} {t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={styles.lbl}>Nome da conta *</Text>
            <TextInput style={styles.input} placeholder="ex: Conta Principal" placeholderTextColor={colors.textMuted} value={nome} onChangeText={setNome} />
            <Text style={styles.lbl}>Banco *</Text>
            <TextInput style={styles.input} placeholder="ex: Nubank, Itaú, Inter..." placeholderTextColor={colors.textMuted} value={banco} onChangeText={setBanco} />
            <Text style={styles.lbl}>Saldo inicial R$ (opcional)</Text>
            <TextInput style={styles.input} placeholder="Ex: 1600 ou 1600,00" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={saldo} onChangeText={setSaldo} />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => { setModal(false); limparForm(); }}>
                <Text style={styles.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={salvarConta}>
                <Text style={styles.btnSaveTxt}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalEditarSaldo} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>✏️ Editar Saldo</Text>
            {contaEditando && (
              <Text style={styles.editSaldoContaNome}>{contaEditando.nome} — {contaEditando.banco}</Text>
            )}
            <Text style={styles.editSaldoAviso}>⚠️ Isso substituirá o saldo atual</Text>
            <Text style={styles.lbl}>Novo saldo R$</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 1600 ou 1600,00"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={novoSaldoInput}
              onChangeText={setNovoSaldoInput}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => { setModalEditarSaldo(false); setContaEditando(null); setNovoSaldoInput(''); }}>
                <Text style={styles.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={editarSaldo}>
                <Text style={styles.btnSaveTxt}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <HelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        title="Como cadastrar contas"
        tips={[
          'Toque em + para adicionar uma conta bancária.',
          'Preencha nome, banco, tipo (Corrente, Poupança, etc.) e saldo inicial.',
          'O saldo é atualizado automaticamente ao registrar despesas em Débito ou Pix.',
          'Receitas também creditam automaticamente a conta selecionada.',
          'Toque em uma conta para editar ou ajustar o saldo.',
          'Pressione e segure para excluir a conta.',
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
    totalCard: { margin: 16, marginBottom: 4, backgroundColor: c.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.borderSoft, alignItems: 'center' },
    totalLabel: { fontSize: 10, fontWeight: '700', color: c.textMuted, letterSpacing: 0.8, marginBottom: 6 },
    totalVal: { fontSize: 22, fontWeight: '700' },
    empty: { alignItems: 'center', padding: 48 },
    emptyIco: { fontSize: 48, marginBottom: 12 },
    emptyTxt: { fontSize: 15, color: c.textSec, fontWeight: '600' },
    emptySub: { fontSize: 13, color: c.textMuted, marginTop: 4 },
    contaCard: { flexDirection: 'row', alignItems: 'center', margin: 16, marginBottom: 8, backgroundColor: c.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.borderSoft },
    contaIco: { fontSize: 28, marginRight: 14 },
    contaInfo: { flex: 1 },
    contaNome: { fontSize: 14, fontWeight: '600', color: c.text },
    contaSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    contaSaldo: { fontSize: 14, fontWeight: '700', marginTop: 4 },
    extratoBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(82,148,255,0.12)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(82,148,255,0.35)', marginRight: 8 },
    extratoTxt: { fontSize: 11, color: '#5294ff', fontWeight: '600' },
    editSaldoBtn: { padding: 8, marginRight: 2 },
    editSaldoTxt: { fontSize: 16 },
    editSaldoContaNome: { fontSize: 13, fontWeight: '600', color: c.textSec, marginBottom: 6 },
    editSaldoAviso: { fontSize: 11, color: '#f7b731', fontStyle: 'italic', marginBottom: 12 },
    delBtn: { padding: 8 },
    delTxt: { fontSize: 18 },
    fab: { position: 'absolute', bottom: 100, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#5294ff', alignItems: 'center', justifyContent: 'center', elevation: 8 },
    fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
    modalBox: { backgroundColor: c.card, borderRadius: 24, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: c.border },
    modalTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 18 },
    lbl: { fontSize: 11.5, fontWeight: '500', color: c.textSec, marginBottom: 5 },
    input: { backgroundColor: c.input, borderWidth: 1, borderColor: c.border, borderRadius: 11, padding: 11, color: c.text, fontSize: 14, marginBottom: 12 },
    tipoBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: c.input, borderRadius: 16, borderWidth: 1, borderColor: c.border },
    tipoBtnOn: { backgroundColor: 'rgba(82,148,255,0.18)', borderColor: '#5294ff' },
    tipoTxt: { fontSize: 13, color: c.text, fontWeight: '500' },
    modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
    btnCancel: { flex: 1, padding: 13, backgroundColor: c.input, borderRadius: 11, alignItems: 'center', borderWidth: 1, borderColor: c.border },
    btnCancelTxt: { color: c.textSec, fontWeight: '600', fontSize: 14 },
    btnSave: { flex: 1, padding: 13, backgroundColor: '#5294ff', borderRadius: 11, alignItems: 'center' },
    btnSaveTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },
  });
}
