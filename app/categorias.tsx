import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import HelpModal, { helpBtnStyle, helpTxtStyle } from './HelpModal';
import { Colors, useTheme } from './theme';

export const CATS_DESP_KEY = '@financaspro:categorias_despesa';
export const CATS_REC_KEY = '@financaspro:categorias_receita';
export const CATS_VERSAO_KEY = '@financaspro:categorias_versao';
const VERSAO_ATUAL = '4';

export const CATS_DESP_PADRAO = [
  'Alimentação','Educação','Finanças','Investimentos',
  'Lazer','Mercado','Moradia','Outros',
  'Saúde','Serviços','Transporte','Vestuário',
];

export const CATS_REC_PADRAO = [
  'Aluguel Recebido','Dividendos','Freelance',
  'Outros','Salário','Vendas',
];

export async function carregarCategorias(tipo: 'despesa' | 'receita'): Promise<string[]> {
  const key = tipo === 'despesa' ? CATS_DESP_KEY : CATS_REC_KEY;
  const padrao = tipo === 'despesa' ? CATS_DESP_PADRAO : CATS_REC_PADRAO;

  const versaoSalva = await AsyncStorage.getItem(CATS_VERSAO_KEY);
  if (versaoSalva !== VERSAO_ATUAL) {
    const savedDesp = await AsyncStorage.getItem(CATS_DESP_KEY);
    const savedRec = await AsyncStorage.getItem(CATS_REC_KEY);
    const existingDesp: string[] = savedDesp ? JSON.parse(savedDesp) : [];
    const existingRec: string[] = savedRec ? JSON.parse(savedRec) : [];
    const mergedDesp = [...new Set([...CATS_DESP_PADRAO, ...existingDesp])];
    const mergedRec = [...new Set([...CATS_REC_PADRAO, ...existingRec])];
    await AsyncStorage.setItem(CATS_DESP_KEY, JSON.stringify(mergedDesp));
    await AsyncStorage.setItem(CATS_REC_KEY, JSON.stringify(mergedRec));
    await AsyncStorage.setItem(CATS_VERSAO_KEY, VERSAO_ATUAL);
    return tipo === 'despesa' ? mergedDesp : mergedRec;
  }

  const saved = await AsyncStorage.getItem(key);
  if (saved) return JSON.parse(saved);
  return padrao;
}

export default function CategoriasScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [aba, setAba] = useState<'despesa' | 'receita'>('despesa');
  const [categorias, setCategorias] = useState<string[]>([]);
  const [helpVisible, setHelpVisible] = useState(false);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [nomeInput, setNomeInput] = useState('');

  useFocusEffect(useCallback(() => { loadCategorias(); }, [aba]));

  async function loadCategorias() {
    const lista = await carregarCategorias(aba);
    setCategorias([...lista].sort((a, b) => a.localeCompare(b)));
  }

  async function salvar() {
    const nome = nomeInput.trim();
    if (!nome) { Alert.alert('Atenção', 'Digite o nome da categoria.'); return; }
    const key = aba === 'despesa' ? CATS_DESP_KEY : CATS_REC_KEY;
    let lista = await carregarCategorias(aba);
    if (editando) {
      lista = lista.map(c => c === editando ? nome : c);
    } else {
      if (lista.map(c => c.toLowerCase()).includes(nome.toLowerCase())) {
        Alert.alert('Atenção', 'Categoria já existe.'); return;
      }
      lista.push(nome);
    }
    lista.sort((a, b) => a.localeCompare(b));
    await AsyncStorage.setItem(key, JSON.stringify(lista));
    setModal(false); setNomeInput(''); setEditando(null);
    loadCategorias();
  }

  function abrirEditar(cat: string) { setEditando(cat); setNomeInput(cat); setModal(true); }
  function abrirNova() { setEditando(null); setNomeInput(''); setModal(true); }

  async function excluir(cat: string) {
    Alert.alert('Excluir categoria', `Deseja excluir "${cat}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        const key = aba === 'despesa' ? CATS_DESP_KEY : CATS_REC_KEY;
        const lista = await carregarCategorias(aba);
        await AsyncStorage.setItem(key, JSON.stringify(lista.filter(c => c !== cat)));
        loadCategorias();
      }},
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Categorias</Text>
        <TouchableOpacity onPress={() => setHelpVisible(true)} style={helpBtnStyle}>
          <Text style={helpTxtStyle}>?</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, aba === 'despesa' && styles.tabOn]} onPress={() => setAba('despesa')}>
          <Text style={[styles.tabTxt, aba === 'despesa' && styles.tabTxtOn]}>💸 Despesas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, aba === 'receita' && styles.tabOn]} onPress={() => setAba('receita')}>
          <Text style={[styles.tabTxt, aba === 'receita' && styles.tabTxtOn]}>💰 Receitas</Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        {categorias.map((cat, i) => (
          <View key={i} style={styles.catRow}>
            <Text style={styles.catNome}>{cat}</Text>
            <TouchableOpacity onPress={() => abrirEditar(cat)} style={styles.iconBtn}>
              <Text style={styles.iconTxt}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => excluir(cat)} style={styles.iconBtn}>
              <Text style={styles.iconTxt}>🗑</Text>
            </TouchableOpacity>
          </View>
        ))}
        <View style={{ height: 120 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={abrirNova}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modal} animationType="fade" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{editando ? 'Editar Categoria' : 'Nova Categoria'}</Text>
            <Text style={styles.modalSub}>{aba === 'despesa' ? 'Despesa' : 'Receita'}</Text>
            <TextInput
              style={styles.modalInput} placeholder="Nome da categoria"
              placeholderTextColor={colors.textMuted} value={nomeInput}
              onChangeText={setNomeInput} autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => { setModal(false); setNomeInput(''); setEditando(null); }}>
                <Text style={styles.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={salvar}>
                <Text style={styles.btnSaveTxt}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <HelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        title="Categorias"
        tips={[
          { titulo: 'Para que servem', texto: 'As categorias ajudam a entender onde seu dinheiro está sendo gasto.' },
          { titulo: 'Categorias padrão', texto: 'São sugestões — exclua as que não usa e crie as que precisar.' },
          { titulo: 'Renomear', texto: 'Toque no lápis para renomear uma categoria existente.' },
          { titulo: 'Excluir', texto: 'Toque na lixeira para excluir. Categorias em uso não podem ser excluídas.' },
          { titulo: 'Nova categoria', texto: 'Use o botão + para criar uma nova categoria personalizada.' },
          { titulo: 'Dica', texto: 'Organize bem suas categorias — elas aparecem nos relatórios e no orçamento.' },
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
    tabs: { flexDirection: 'row', margin: 16, backgroundColor: c.input, borderRadius: 11, padding: 4 },
    tab: { flex: 1, padding: 9, borderRadius: 8, alignItems: 'center' },
    tabOn: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    tabTxt: { fontSize: 13, fontWeight: '500', color: c.textMuted },
    tabTxtOn: { color: c.text },
    catRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.borderLight },
    catNome: { flex: 1, fontSize: 14, color: c.text, fontWeight: '500' },
    iconBtn: { padding: 8 },
    iconTxt: { fontSize: 16 },
    fab: { position: 'absolute', bottom: 100, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#5294ff', alignItems: 'center', justifyContent: 'center', elevation: 8 },
    fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 },
    modalBox: { backgroundColor: c.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: c.border },
    modalTitle: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: 4 },
    modalSub: { fontSize: 12, color: c.textMuted, marginBottom: 16 },
    modalInput: { backgroundColor: c.input, borderWidth: 1, borderColor: c.border, borderRadius: 11, padding: 12, color: c.text, fontSize: 15, marginBottom: 16 },
    modalBtns: { flexDirection: 'row', gap: 10 },
    btnCancel: { flex: 1, padding: 13, backgroundColor: c.input, borderRadius: 11, alignItems: 'center', borderWidth: 1, borderColor: c.border },
    btnCancelTxt: { color: c.textSec, fontWeight: '600', fontSize: 14 },
    btnSave: { flex: 1, padding: 13, backgroundColor: '#5294ff', borderRadius: 11, alignItems: 'center' },
    btnSaveTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },
  });
}
