import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { buscarContas, debitarConta } from './contas';
import { buscarFaturaCartao, buscarLancamentosPorCartao, buscarTotalUsadoCartao, pagarFaturaCartao } from './database';

const CARTOES_KEY = '@financaspro:cartoes';

const BANDEIRAS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outro'];
const BANDEIRA_ICON: Record<string, string> = {
  'Visa': '💙', 'Mastercard': '🔴', 'Elo': '⭐',
  'American Express': '🟦', 'Hipercard': '🟠', 'Outro': '💳'
};

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

type Cartao = {
  id: string; apelido: string; bandeira: string; ultimos4: string;
  fechamento: string; vencimento: string; limite: string;
};
type CartaoComUso = Cartao & { usado: number; disponivel: number; pct: number; };
type Conta = { id: string; nome: string; banco: string; tipo: string; saldo: string; };

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

  // Modal Pagar Fatura
  const [modalFatura, setModalFatura] = useState(false);
  const [cartaoFatura, setCartaoFatura] = useState<CartaoComUso | null>(null);
  const [mesFatura, setMesFatura] = useState(new Date().getMonth() + 1);
  const [anoFatura, setAnoFatura] = useState(new Date().getFullYear());
  const [dataFaturaObj, setDataFaturaObj] = useState(new Date());
  const [dataFaturaStr, setDataFaturaStr] = useState(hoje());
  const [mostrarCalFatura, setMostrarCalFatura] = useState(false);
  const [contasFatura, setContasFatura] = useState<Conta[]>([]);
  const [contaSelFatura, setContaSelFatura] = useState<Conta | null>(null);
  const [faturaItens, setFaturaItens] = useState<any[]>([]);
  const [totalFatura, setTotalFatura] = useState(0);
  const [itensPendentes, setItensPendentes] = useState(0);

  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();

  useFocusEffect(useCallback(() => { loadCartoes(); }, []));

  function hoje() {
    const d = new Date();
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
  }

  function dateToStr(d: Date) {
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
  }

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

  async function abrirPagarFatura(c: CartaoComUso) {
    setCartaoFatura(c);
    setMesFatura(mesAtual);
    setAnoFatura(anoAtual);
    setDataFaturaStr(hoje());
    setDataFaturaObj(new Date());
    setContaSelFatura(null);

    const contas = await buscarContas();
    setContasFatura(contas);

    atualizarFatura(c.id, mesAtual, anoAtual);
    setModalFatura(true);
  }

  function atualizarFatura(cartaoId: string, mes: number, ano: number) {
    const itens = buscarFaturaCartao(cartaoId, mes, ano);
    const pendentes = itens.filter(i => i.status !== 'pago');
    const total = pendentes.reduce((s: number, i: any) => s + i.valor, 0);
    setFaturaItens(itens);
    setItensPendentes(pendentes.length);
    setTotalFatura(total);
  }

  function mudarMesFatura(direcao: number) {
    let novoMes = mesFatura + direcao;
    let novoAno = anoFatura;
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    setMesFatura(novoMes);
    setAnoFatura(novoAno);
    if (cartaoFatura) atualizarFatura(cartaoFatura.id, novoMes, novoAno);
  }

  function confirmarPagamentoFatura() {
    if (!cartaoFatura) return;
    if (itensPendentes === 0) {
      Alert.alert('Fatura já paga', 'Todos os lançamentos desta fatura já estão marcados como pagos.');
      return;
    }

    const nomeConta = contaSelFatura ? ` · Débito em: ${contaSelFatura.nome}` : '';
    Alert.alert(
      '⚠️ Confirmar pagamento da fatura',
      `Cartão: ${cartaoFatura.apelido}\nFatura: ${MESES[mesFatura-1]}/${anoFatura}\nTotal: R$ ${totalFatura.toFixed(2).replace('.',',')}\nLançamentos: ${itensPendentes}${nomeConta}\n\nEsta ação marcará todos como pagos e não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar pagamento',
          style: 'destructive',
          onPress: async () => {
            pagarFaturaCartao(cartaoFatura.id, mesFatura, anoFatura, dataFaturaStr);
            if (contaSelFatura) {
              await debitarConta(contaSelFatura.id, totalFatura);
            }
            setModalFatura(false);
            loadCartoes();
            Alert.alert('✅ Fatura paga!', `${itensPendentes} lançamento(s) marcados como pagos.`);
          }
        }
      ]
    );
  }

  function abrirNovoCartao() { setEditando(null); limparForm(); setModal(true); }

  function abrirEditarCartao(c: CartaoComUso) {
    setEditando(c); setApelido(c.apelido); setBandeira(c.bandeira);
    setUltimos4(c.ultimos4); setFechamento(c.fechamento);
    setVencimento(c.vencimento); setLimite(c.limite); setModal(true);
  }

  function fecharModal() { setModal(false); limparForm(); setEditando(null); }

  async function salvarCartao() {
    if (!ultimos4 || ultimos4.length !== 4) { alert('Digite os 4 ultimos digitos do cartao.'); return; }
    if (!fechamento || !vencimento) { alert('Digite o dia de fechamento e vencimento.'); return; }
    const saved = await AsyncStorage.getItem(CARTOES_KEY);
    const lista: Cartao[] = saved ? JSON.parse(saved) : [];
    if (editando) {
      const novos = lista.map(c => c.id === editando.id ? {
        ...c, apelido: apelido || bandeira + ' ****' + ultimos4,
        bandeira, ultimos4, fechamento, vencimento, limite,
      } : c);
      await AsyncStorage.setItem(CARTOES_KEY, JSON.stringify(novos));
    } else {
      const novo: Cartao = {
        id: Date.now().toString(),
        apelido: apelido || bandeira + ' ****' + ultimos4,
        bandeira, ultimos4, fechamento, vencimento, limite,
      };
      await AsyncStorage.setItem(CARTOES_KEY, JSON.stringify([...lista, novo]));
    }
    fecharModal(); loadCartoes();
  }

  async function excluirCartao(c: CartaoComUso) {
    const lancamentos = buscarLancamentosPorCartao(c.id);
    const pendentes = lancamentos.filter(l => l.status === 'pendente');
    if (pendentes.length > 0) {
      Alert.alert('⚠️ Cartão com pendências',
        `Este cartão possui ${pendentes.length} lançamento(s) pendente(s). Deseja excluir mesmo assim?`,
        [{ text: 'Cancelar', style: 'cancel' },
         { text: 'Excluir mesmo assim', style: 'destructive', onPress: () => confirmarExclusao(c.id) }]);
    } else {
      Alert.alert('Excluir cartão', `Deseja excluir o cartão ${c.apelido}?`,
        [{ text: 'Cancelar', style: 'cancel' },
         { text: 'Excluir', style: 'destructive', onPress: () => confirmarExclusao(c.id) }]);
    }
  }

  async function confirmarExclusao(id: string) {
    const saved = await AsyncStorage.getItem(CARTOES_KEY);
    const lista: Cartao[] = saved ? JSON.parse(saved) : [];
    await AsyncStorage.setItem(CARTOES_KEY, JSON.stringify(lista.filter(c => c.id !== id)));
    loadCartoes();
  }

  function limparForm() {
    setApelido(''); setBandeira('Visa'); setUltimos4('');
    setFechamento(''); setVencimento(''); setLimite('');
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

              {!temLimite && <Text style={styles.semLimite}>Sem limite cadastrado</Text>}

              {/* Botão Pagar Fatura */}
              <TouchableOpacity style={styles.btnFatura} onPress={() => abrirPagarFatura(c)}>
                <Text style={styles.btnFaturaTxt}>💳 Pagar Fatura</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={abrirNovoCartao}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Modal cadastro/edição cartão */}
      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editando ? 'Editar Cartao' : 'Novo Cartao'}</Text>
              <TouchableOpacity onPress={fecharModal} style={styles.modalFechar}>
                <Text style={styles.modalFecharTxt}>✕</Text>
              </TouchableOpacity>
            </View>
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
            <TouchableOpacity style={styles.btnSave} onPress={salvarCartao}>
              <Text style={styles.btnSaveTxt}>{editando ? 'Salvar alterações' : 'Salvar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Pagar Fatura */}
      <Modal visible={modalFatura} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <ScrollView>
            <View style={[styles.modalBox, { marginTop: 60 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>💳 Pagar Fatura</Text>
                <TouchableOpacity onPress={() => setModalFatura(false)} style={styles.modalFechar}>
                  <Text style={styles.modalFecharTxt}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.cartaoNomeFatura}>{cartaoFatura?.apelido}</Text>

              {/* Navegação de mês */}
              <View style={styles.mesNav}>
                <TouchableOpacity onPress={() => mudarMesFatura(-1)} style={styles.mesNavBtn}>
                  <Text style={styles.mesNavTxt}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.mesTxt}>{MESES[mesFatura-1]} / {anoFatura}</Text>
                <TouchableOpacity onPress={() => mudarMesFatura(1)} style={styles.mesNavBtn}>
                  <Text style={styles.mesNavTxt}>›</Text>
                </TouchableOpacity>
              </View>

              {/* Resumo da fatura */}
              <View style={styles.faturaResumo}>
                <View style={styles.faturaResumoRow}>
                  <Text style={styles.faturaResumoLbl}>Total da fatura</Text>
                  <Text style={styles.faturaResumoVal}>R$ {totalFatura.toFixed(2).replace('.',',')}</Text>
                </View>
                <View style={styles.faturaResumoRow}>
                  <Text style={styles.faturaResumoLbl}>Lançamentos</Text>
                  <Text style={styles.faturaResumoSub}>{faturaItens.length} total · {itensPendentes} a pagar</Text>
                </View>
                {itensPendentes === 0 && faturaItens.length > 0 && (
                  <Text style={styles.faturaJaPaga}>✅ Fatura já paga!</Text>
                )}
                {faturaItens.length === 0 && (
                  <Text style={styles.faturaSemItens}>Nenhum lançamento neste mês.</Text>
                )}
              </View>

              {/* Data de pagamento */}
              <Text style={styles.lbl}>Data do pagamento</Text>
              <TouchableOpacity style={styles.dataBtn} onPress={() => setMostrarCalFatura(true)}>
                <Text style={styles.dataBtnIco}>📅</Text>
                <Text style={styles.dataBtnTxt}>{dataFaturaStr}</Text>
              </TouchableOpacity>
              {mostrarCalFatura && (
                <DateTimePicker
                  value={dataFaturaObj}
                  mode="date"
                  display="calendar"
                  onChange={(event, date) => {
                    setMostrarCalFatura(false);
                    if (date) { setDataFaturaObj(date); setDataFaturaStr(dateToStr(date)); }
                  }}
                />
              )}

              {/* Selecionar conta (opcional) */}
              <Text style={styles.lbl}>Débitar da conta (opcional)</Text>
              {contasFatura.length === 0 ? (
                <Text style={styles.semContaTxt}>Nenhuma conta cadastrada — o saldo não será debitado.</Text>
              ) : (
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={[styles.chip, contaSelFatura === null && styles.chipOn]}
                    onPress={() => setContaSelFatura(null)}
                  >
                    <Text style={[styles.chipTxt, contaSelFatura === null && styles.chipTxtOn]}>Nenhuma</Text>
                  </TouchableOpacity>
                  {contasFatura.map(ct => (
                    <TouchableOpacity
                      key={ct.id}
                      style={[styles.chip, contaSelFatura?.id === ct.id && styles.chipOn]}
                      onPress={() => setContaSelFatura(ct)}
                    >
                      <Text style={[styles.chipTxt, contaSelFatura?.id === ct.id && styles.chipTxtOn]}>
                        {ct.nome}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Botão confirmar */}
              <TouchableOpacity
                style={[styles.btnConfirmarFatura, itensPendentes === 0 && { backgroundColor: '#2a3148' }]}
                onPress={confirmarPagamentoFatura}
              >
                <Text style={styles.btnConfirmarFaturaTxt}>
                  {itensPendentes === 0 ? 'Nenhum pendente' : `Pagar R$ ${totalFatura.toFixed(2).replace('.',',')} →`}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
  btnFatura: { marginTop: 12, backgroundColor: 'rgba(82,148,255,0.15)', borderRadius: 10, padding: 11, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(82,148,255,0.35)' },
  btnFaturaTxt: { fontSize: 13, color: '#5294ff', fontWeight: '700' },
  fab: { position: 'absolute', bottom: 100, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#5294ff', alignItems: 'center', justifyContent: 'center', elevation: 8 },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)' },
  modalBox: { backgroundColor: '#1c2133', borderRadius: 24, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', margin: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#f0f3ff' },
  modalFechar: { padding: 4 },
  modalFecharTxt: { fontSize: 18, color: '#6b779a' },
  lbl: { fontSize: 11.5, fontWeight: '500', color: '#aab4d0', marginBottom: 5, marginTop: 12 },
  input: { backgroundColor: '#2a3148', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 11, padding: 11, color: '#f0f3ff', fontSize: 14, marginBottom: 12 },
  bandBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#2a3148', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  bandBtnOn: { backgroundColor: 'rgba(82,148,255,0.18)', borderColor: '#5294ff' },
  bandTxt: { fontSize: 13, color: '#f0f3ff', fontWeight: '500' },
  btnSave: { padding: 14, backgroundColor: '#5294ff', borderRadius: 11, alignItems: 'center', marginTop: 8 },
  btnSaveTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },
  // Fatura
  cartaoNomeFatura: { fontSize: 15, fontWeight: '700', color: '#f0f3ff', textAlign: 'center', marginBottom: 16 },
  mesNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#2a3148', borderRadius: 11, padding: 8, marginBottom: 16 },
  mesNavBtn: { padding: 8 },
  mesNavTxt: { fontSize: 24, color: '#5294ff', fontWeight: '700' },
  mesTxt: { fontSize: 15, fontWeight: '700', color: '#f0f3ff' },
  faturaResumo: { backgroundColor: '#0d1117', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(82,148,255,0.2)' },
  faturaResumoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  faturaResumoLbl: { fontSize: 13, color: '#6b779a' },
  faturaResumoVal: { fontSize: 16, fontWeight: '700', color: '#5294ff' },
  faturaResumoSub: { fontSize: 13, color: '#aab4d0' },
  faturaJaPaga: { fontSize: 13, color: '#25d07e', textAlign: 'center', marginTop: 8, fontWeight: '600' },
  faturaSemItens: { fontSize: 13, color: '#6b779a', textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
  dataBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a3148', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 11, padding: 12, gap: 10, marginBottom: 4 },
  dataBtnIco: { fontSize: 18 },
  dataBtnTxt: { fontSize: 14, color: '#f0f3ff', fontWeight: '500' },
  semContaTxt: { fontSize: 12, color: '#6b779a', fontStyle: 'italic', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#2a3148', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  chipOn: { backgroundColor: 'rgba(82,148,255,0.18)', borderColor: '#5294ff' },
  chipTxt: { fontSize: 12.5, color: '#aab4d0', fontWeight: '500' },
  chipTxtOn: { color: '#7ab0ff' },
  btnConfirmarFatura: { backgroundColor: '#5294ff', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  btnConfirmarFaturaTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});