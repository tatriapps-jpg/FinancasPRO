import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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

// Função utilitária exportada para debitar saldo de uma conta
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

// Função utilitária exportada para buscar contas
export async function buscarContas(): Promise<Conta[]> {
  const saved = await AsyncStorage.getItem(CONTAS_KEY);
  return saved ? JSON.parse(saved) : [];
}

export default function ContasScreen() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [modal, setModal] = useState(false);
  const [nome, setNome] = useState('');
  const [banco, setBanco] = useState('');
  const [tipo, setTipo] = useState('Corrente');
  const [saldo, setSaldo] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadContas();
    }, [])
  );

  async function loadContas() {
    const saved = await AsyncStorage.getItem(CONTAS_KEY);
    if (saved) setContas(JSON.parse(saved));
  }

  async function salvarConta() {
    if (!nome.trim()) { alert('Digite o nome da conta.'); return; }
    if (!banco.trim()) { alert('Digite o nome do banco.'); return; }
    const saved = await AsyncStorage.getItem(CONTAS_KEY);
    const lista: Conta[] = saved ? JSON.parse(saved) : [];
    const nova: Conta = { id: Date.now().toString(), nome, banco, tipo, saldo };
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
        <View style={{ width: 60 }} />
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
            <TextInput style={styles.input} placeholder="ex: Conta Principal" placeholderTextColor="#6b779a" value={nome} onChangeText={setNome} />
            <Text style={styles.lbl}>Banco *</Text>
            <TextInput style={styles.input} placeholder="ex: Nubank, Itaú, Inter..." placeholderTextColor="#6b779a" value={banco} onChangeText={setBanco} />
            <Text style={styles.lbl}>Saldo inicial R$ (opcional)</Text>
            <TextInput style={styles.input} placeholder="ex: 1500,00" placeholderTextColor="#6b779a" keyboardType="numeric" value={saldo} onChangeText={setSaldo} />
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
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12151e' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  backBtn: { padding: 4 },
  backTxt: { fontSize: 16, color: '#5294ff', fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#f0f3ff' },
  totalCard: { margin: 16, marginBottom: 4, backgroundColor: '#1c2133', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center' },
  totalLabel: { fontSize: 10, fontWeight: '700', color: '#6b779a', letterSpacing: 0.8, marginBottom: 6 },
  totalVal: { fontSize: 22, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 48 },
  emptyIco: { fontSize: 48, marginBottom: 12 },
  emptyTxt: { fontSize: 15, color: '#aab4d0', fontWeight: '600' },
  emptySub: { fontSize: 13, color: '#6b779a', marginTop: 4 },
  contaCard: { flexDirection: 'row', alignItems: 'center', margin: 16, marginBottom: 8, backgroundColor: '#1c2133', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  contaIco: { fontSize: 28, marginRight: 14 },
  contaInfo: { flex: 1 },
  contaNome: { fontSize: 14, fontWeight: '600', color: '#f0f3ff' },
  contaSub: { fontSize: 12, color: '#6b779a', marginTop: 2 },
  contaSaldo: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  delBtn: { padding: 8 },
  delTxt: { fontSize: 18 },
  fab: { position: 'absolute', bottom: 100, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#5294ff', alignItems: 'center', justifyContent: 'center', elevation: 8 },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#1c2133', borderRadius: 24, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#f0f3ff', marginBottom: 18 },
  lbl: { fontSize: 11.5, fontWeight: '500', color: '#aab4d0', marginBottom: 5 },
  input: { backgroundColor: '#2a3148', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 11, padding: 11, color: '#f0f3ff', fontSize: 14, marginBottom: 12 },
  tipoBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#2a3148', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  tipoBtnOn: { backgroundColor: 'rgba(82,148,255,0.18)', borderColor: '#5294ff' },
  tipoTxt: { fontSize: 13, color: '#f0f3ff', fontWeight: '500' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnCancel: { flex: 1, padding: 13, backgroundColor: '#2a3148', borderRadius: 11, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  btnCancelTxt: { color: '#aab4d0', fontWeight: '600', fontSize: 14 },
  btnSave: { flex: 1, padding: 13, backgroundColor: '#5294ff', borderRadius: 11, alignItems: 'center' },
  btnSaveTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },
});