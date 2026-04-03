import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { buscarLancamentosPorCartao, buscarTotalUsadoCartao } from './database';

const CARTOES_KEY = '@financaspro:cartoes';

const BANDEIRAS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outro'];
const BANDEIRA_ICON: Record<string, string> = {
  'Visa': '💙', 'Mastercard': '🔴', 'Elo': '⭐',
  'American Express': '🟦', 'Hipercard': '🟠', 'Outro': '💳'
};

type Cartao = {
  id: string;
  apelido: string;
  bandeira: string;
  ultimos4: string;
  fechamento: string;
  vencimento: string;
  limite: string;
};

type CartaoComUso = Cartao & {
  usado: number;
  disponivel: number;
  pct: number;
};

export default function CartoesScreen() {
  const [cartoes, setCartoes] = useState<CartaoComUso[]>([]);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Cartao | null>(null);
  const [apelido, setApelido] = useState('');
  const [bandeira, setBandeira] = useState('Visa');
  const [ultimos4, setUltimos4] = useState('');
  const [fechamento, setFechamento] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [limite, setLimite] = useState('');

  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();

  useFocusEffect(
    useCallback(() => {
      loadCartoes();
    }, [])
  );

  async function loadCartoes() {
    const saved = await AsyncStorage.getItem(CARTOES_KEY);
    if (!saved) return;
    const lista: Cartao[] = JSON.parse(saved);

    const comUso: CartaoComUso[] = lista.map(c => {
      const limiteNum = parseFloat(c.limite) || 0;
      const usado = buscarTotalUsadoCartao(c.id, mesAtual, anoAtual);
      const disponivel = limiteNum - usado;
      const pct = limiteNum > 0 ? Math.min(100, (usado / limiteNum) * 100) : 0;
      return { ...c, usado, disponivel, pct };
    });

    setCartoes(comUso);
  }

  function abrirNovoCartao() {
    setEditando(null);
    limparForm();
    setModal(true);
  }

  function abrirEditarCartao(c: CartaoComUso) {
    setEditando(c);
    setApelido(c.apelido);
    setBandeira(c.bandeira);
    setUltimos4(c.ultimos4);
    setFechamento(c.fechamento);
    setVencimento(c.vencimento);
    setLimite(c.limite);
    setModal(true);
  }

  async function salvarCartao() {
    if (!ultimos4 || ultimos4.length !== 4) {
      alert('Digite os 4 ultimos digitos do cartao.');
      return;
    }
    if (!fechamento || !vencimento) {
      alert('Digite o dia de fechamento e vencimento.');
      return;
    }

    const saved = await AsyncStorage.getItem(CARTOES_KEY);
    const lista: Cartao[] = saved ? JSON.parse(saved) : [];

    if (editando) {
      // Editar cartão existente
      const novos = lista.map(c => c.id === editando.id ? {
        ...c, apelido: apelido || bandeira + ' ****' + ultimos4,
        bandeira, ultimos4, fechamento, vencimento, limite,
      } : c);
      await AsyncStorage.setItem(CARTOES_KEY, JSON.stringify(novos));
    } else {
      // Novo cartão
      const novo: Cartao = {
        id: Date.now().toString(),
        apelido: apelido || bandeira + ' ****' + ultimos4,
        bandeira, ultimos4, fechamento, vencimento, limite,
      };
      await AsyncStorage.setItem(CARTOES_KEY, JSON.stringify([...lista, novo]));
    }

    setModal(false);
    limparForm();
    loadCartoes();
  }

  async function excluirCartao(c: CartaoComUso) {
    // Verifica se tem lançamentos pendentes
    const lancamentos = buscarLancamentosPorCartao(c.id);
    const pendentes = lancamentos.filter(l => l.status === 'pendente');

    if (pendentes.length > 0) {
      Alert.alert(
        '⚠️ Cartão com pendências',
        `Este cartão possui ${pendentes.length} lançamento(s) pendente(s). Ao excluir o cartão, esses lançamentos ficarão sem cartão vinculado.\n\nDeseja excluir mesmo assim?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir mesmo assim',
            style: 'destructive',
            onPress: () => confirmarExclusao(c.id),
          },
        ]
      );
    } else {
      Alert.alert(
        'Excluir cartão',
        `Deseja excluir o cartão ${c.apelido}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Excluir', style: 'destructive', onPress: () => confirmarExclusao(c.id) },
        ]
      );
    }
  }

  async function confirmarExclusao(id: string) {
    const saved = await AsyncStorage.getItem(CARTOES_KEY);
    const lista: Cartao[] = saved ? JSON.parse(saved) : [];
    const novos = lista.filter(c => c.id !== id);
    await AsyncStorage.setItem(CARTOES_KEY, JSON.stringify(novos));
    loadCartoes();
  }

  function limparForm() {
    setApelido(''); setBandeira('Visa');
    setUltimos4(''); setFechamento('');
    setVencimento(''); setLimite('');
  }

  const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function barCor(pct: number) {
    if (pct < 60) return '#25d07e';
    if (pct < 85) return '#f7b731';
    return '#f25555';
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meus Cartoes</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView>
        {cartoes.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIco}>💳</Text>
            <Text style={styles.emptyTxt}>Nenhum cartao cadastrado</Text>
            <Text style={styles.emptySub}>Toque no + para adicionar</Text>
          </View>
        )}

        {cartoes.map(c => {
          const temLimite = parseFloat(c.limite) > 0;
          const cor = barCor(c.pct);
          return (
            <View key={c.id} style={styles.cartaoCard}>
              <View style={styles.cartaoTop}>
                <Text style={styles.cartaoIco}>{BANDEIRA_ICON[c.bandeira]}</Text>
                <View style={styles.cartaoInfo}>
                  <Text style={styles.cartaoNome}>{c.apelido}</Text>
                  <Text style={styles.cartaoSub}>{c.bandeira} ****{c.ultimos4}</Text>
                  <Text style={styles.cartaoSub}>Fecha dia {c.fechamento} · Vence dia {c.vencimento}</Text>
                </View>
                <TouchableOpacity onPress={() => abrirEditarCartao(c)} style={styles.editBtn}>
                  <Text style={styles.editTxt}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => excluirCartao(c)} style={styles.delBtn}>
                  <Text style={styles.delTxt}>🗑</Text>
                </TouchableOpacity>
              </View>

              {temLimite && (
                <View style={styles.limiteBox}>
                  <View style={styles.limiteRow}>
                    <View style={styles.limiteItem}>
                      <Text style={styles.limiteLabel}>LIMITE</Text>
                      <Text style={[styles.limiteVal, { color: '#aab4d0' }]}>{fmt(parseFloat(c.limite))}</Text>
                    </View>
                    <View style={styles.limiteSep} />
                    <View style={styles.limiteItem}>
                      <Text style={styles.limiteLabel}>USADO</Text>
                      <Text style={[styles.limiteVal, { color: '#f25555' }]}>{fmt(c.usado)}</Text>
                    </View>
                    <View style={styles.limiteSep} />
                    <View style={styles.limiteItem}>
                      <Text style={styles.limiteLabel}>DISPONIVEL</Text>
                      <Text style={[styles.limiteVal, { color: c.disponivel >= 0 ? '#25d07e' : '#f25555' }]}>{fmt(c.disponivel)}</Text>
                    </View>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${c.pct}%` as any, backgroundColor: cor }]} />
                  </View>
                  <Text style={[styles.barPct, { color: cor }]}>{c.pct.toFixed(1)}% do limite utilizado</Text>
                </View>
              )}

              {!temLimite && (
                <Text style={styles.semLimite}>Sem limite cadastrado</Text>
              )}
            </View>
          );
        })}

        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={abrirNovoCartao}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{editando ? 'Editar Cartao' : 'Novo Cartao'}</Text>

            <Text style={styles.lbl}>Bandeira</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {BANDEIRAS.map(b => (
                  <TouchableOpacity key={b} style={[styles.bandBtn, bandeira === b && styles.bandBtnOn]} onPress={() => setBandeira(b)}>
                    <Text style={styles.bandTxt}>{BANDEIRA_ICON[b]} {b}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.lbl}>4 ultimos digitos *</Text>
            <TextInput style={styles.input} placeholder="ex: 1234" placeholderTextColor="#6b779a" keyboardType="numeric" maxLength={4} value={ultimos4} onChangeText={setUltimos4} />

            <Text style={styles.lbl}>Apelido (opcional)</Text>
            <TextInput style={styles.input} placeholder="ex: Nubank, Inter..." placeholderTextColor="#6b779a" value={apelido} onChangeText={setApelido} />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lbl}>Dia fechamento *</Text>
                <TextInput style={styles.input} placeholder="ex: 10" placeholderTextColor="#6b779a" keyboardType="numeric" maxLength={2} value={fechamento} onChangeText={setFechamento} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lbl}>Dia vencimento *</Text>
                <TextInput style={styles.input} placeholder="ex: 20" placeholderTextColor="#6b779a" keyboardType="numeric" maxLength={2} value={vencimento} onChangeText={setVencimento} />
              </View>
            </View>

            <Text style={styles.lbl}>Limite R$ (opcional)</Text>
            <TextInput style={styles.input} placeholder="ex: 5000" placeholderTextColor="#6b779a" keyboardType="numeric" value={limite} onChangeText={setLimite} />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => { setModal(false); limparForm(); }}>
                <Text style={styles.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={salvarCartao}>
                <Text style={styles.btnSaveTxt}>{editando ? 'Salvar alterações' : 'Salvar'}</Text>
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
  empty: { alignItems: 'center', padding: 48 },
  emptyIco: { fontSize: 48, marginBottom: 12 },
  emptyTxt: { fontSize: 15, color: '#aab4d0', fontWeight: '600' },
  emptySub: { fontSize: 13, color: '#6b779a', marginTop: 4 },
  cartaoCard: { margin: 16, marginBottom: 8, backgroundColor: '#1c2133', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  cartaoTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cartaoIco: { fontSize: 28, marginRight: 14 },
  cartaoInfo: { flex: 1 },
  cartaoNome: { fontSize: 14, fontWeight: '600', color: '#f0f3ff' },
  cartaoSub: { fontSize: 12, color: '#6b779a', marginTop: 2 },
  editBtn: { padding: 8 },
  editTxt: { fontSize: 16 },
  delBtn: { padding: 8 },
  delTxt: { fontSize: 18 },
  limiteBox: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: 12 },
  limiteRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  limiteItem: { flex: 1, alignItems: 'center' },
  limiteLabel: { fontSize: 9, fontWeight: '700', color: '#6b779a', letterSpacing: 0.8, marginBottom: 4 },
  limiteVal: { fontSize: 13, fontWeight: '700' },
  limiteSep: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  barTrack: { height: 6, backgroundColor: '#2a3148', borderRadius: 10, overflow: 'hidden', marginBottom: 5 },
  barFill: { height: 6, borderRadius: 10 },
  barPct: { fontSize: 10, fontWeight: '600', textAlign: 'right' },
  semLimite: { fontSize: 11, color: '#6b779a', fontStyle: 'italic', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: 10 },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#5294ff', alignItems: 'center', justifyContent: 'center', elevation: 8 },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#1c2133', borderRadius: 24, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#f0f3ff', marginBottom: 18 },
  lbl: { fontSize: 11.5, fontWeight: '500', color: '#aab4d0', marginBottom: 5 },
  input: { backgroundColor: '#2a3148', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 11, padding: 11, color: '#f0f3ff', fontSize: 14, marginBottom: 12 },
  bandBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#2a3148', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  bandBtnOn: { backgroundColor: 'rgba(82,148,255,0.18)', borderColor: '#5294ff' },
  bandTxt: { fontSize: 13, color: '#f0f3ff', fontWeight: '500' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnCancel: { flex: 1, padding: 13, backgroundColor: '#2a3148', borderRadius: 11, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  btnCancelTxt: { color: '#aab4d0', fontWeight: '600', fontSize: 14 },
  btnSave: { flex: 1, padding: 13, backgroundColor: '#5294ff', borderRadius: 11, alignItems: 'center' },
  btnSaveTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },
});