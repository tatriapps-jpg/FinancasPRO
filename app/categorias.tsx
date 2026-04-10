import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export const CATS_DESP_KEY = '@financaspro:categorias_despesa';
export const CATS_REC_KEY = '@financaspro:categorias_receita';

export const CATS_DESP_PADRAO = ['Alimentacao','Combustivel','Custos Financeiros','Educacao','Energia','Farmacia','Internet','Lazer','Mercado','Moradia','Outros','Pets','Saude','Transporte','Vestuario'];
export const CATS_REC_PADRAO = ['Freelance','Outros','Pro-labore','Reembolso','Rendimentos','Salario'];

export async function carregarCategorias(tipo: 'despesa' | 'receita'): Promise<string[]> {
  const key = tipo === 'despesa' ? CATS_DESP_KEY : CATS_REC_KEY;
  const padrao = tipo === 'despesa' ? CATS_DESP_PADRAO : CATS_REC_PADRAO;
  const saved = await AsyncStorage.getItem(key);
  if (saved) return JSON.parse(saved);
  return padrao;
}

export default function CategoriasScreen() {
  const [aba, setAba] = useState<'despesa' | 'receita'>('despesa');
  const [categorias, setCategorias] = useState<string[]>([]);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [nomeInput, setNomeInput] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadCategorias();
    }, [aba])
  );

  async function loadCategorias() {
    const lista = await carregarCategorias(aba);
    setCategorias([...lista].sort((a, b) => a.localeCompare(b)));
  }

  async function salvar() {
    const nome = nomeInput.trim();
    if (!nome) { alert('Digite o nome da categoria.'); return; }

    const key = aba === 'despesa' ? CATS_DESP_KEY : CATS_REC_KEY;
    let lista = await carregarCategorias(aba);

    if (editando) {
      lista = lista.map(c => c === editando ? nome : c);
    } else {
      if (lista.map(c => c.toLowerCase()).includes(nome.toLowerCase())) {
        alert('Categoria já existe.'); return;
      }
      lista.push(nome);
    }

    lista.sort((a, b) => a.localeCompare(b));
    await AsyncStorage.setItem(key, JSON.stringify(lista));
    setModal(false);
    setNomeInput('');
    setEditando(null);
    loadCategorias();
  }

  function abrirEditar(cat: string) {
    setEditando(cat);
    setNomeInput(cat);
    setModal(true);
  }

  function abrirNova() {
    setEditando(null);
    setNomeInput('');
    setModal(true);
  }

  async function excluir(cat: string) {
    Alert.alert(
      'Excluir categoria',
      `Deseja excluir "${cat}"? Lançamentos com esta categoria não serão afetados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const key = aba === 'despesa' ? CATS_DESP_KEY : CATS_REC_KEY;
            const lista = await carregarCategorias(aba);
            const novas = lista.filter(c => c !== cat);
            await AsyncStorage.setItem(key, JSON.stringify(novas));
            loadCategorias();
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Categorias</Text>
        <View style={{ width: 60 }} />
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
        <View style={{ height: 100 }} />
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
              style={styles.modalInput}
              placeholder="Nome da categoria"
              placeholderTextColor="#6b779a"
              value={nomeInput}
              onChangeText={setNomeInput}
              autoFocus
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12151e' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  backBtn: { padding: 4 },
  backTxt: { fontSize: 16, color: '#5294ff', fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#f0f3ff' },
  tabs: { flexDirection: 'row', margin: 16, backgroundColor: '#2a3148', borderRadius: 11, padding: 4 },
  tab: { flex: 1, padding: 9, borderRadius: 8, alignItems: 'center' },
  tabOn: { backgroundColor: '#1c2133', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  tabTxt: { fontSize: 13, fontWeight: '500', color: '#6b779a' },
  tabTxtOn: { color: '#f0f3ff' },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  catNome: { flex: 1, fontSize: 14, color: '#f0f3ff', fontWeight: '500' },
  iconBtn: { padding: 8 },
  iconTxt: { fontSize: 16 },
  fab: { position: 'absolute', bottom: 100, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#5294ff', alignItems: 'center', justifyContent: 'center', elevation: 8 },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 },
  modalBox: { backgroundColor: '#1c2133', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#f0f3ff', marginBottom: 4 },
  modalSub: { fontSize: 12, color: '#6b779a', marginBottom: 16 },
  modalInput: { backgroundColor: '#2a3148', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 11, padding: 12, color: '#f0f3ff', fontSize: 15, marginBottom: 16 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  btnCancel: { flex: 1, padding: 13, backgroundColor: '#2a3148', borderRadius: 11, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  btnCancelTxt: { color: '#aab4d0', fontWeight: '600', fontSize: 14 },
  btnSave: { flex: 1, padding: 13, backgroundColor: '#5294ff', borderRadius: 11, alignItems: 'center' },
  btnSaveTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
