import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { buscarLancamentos, buscarTotaisMes } from '../database';

const ALERTA_KEY = '@financaspro:diasAlerta';

export default function HomeScreen() {
  const [totais, setTotais] = useState({ totalGasto: 0, totalReceita: 0, saldo: 0 });
  const [orcamento, setOrcamento] = useState(5000);
  const [topGastos, setTopGastos] = useState<any[]>([]);
  const [mesAtual] = useState(new Date().getMonth() + 1);
  const [anoAtual] = useState(new Date().getFullYear());
  const [vencimentos, setVencimentos] = useState<any[]>([]);
  const [diasAlerta, setDiasAlerta] = useState(3);
  const [modalAlerta, setModalAlerta] = useState(false);
  const [diasInput, setDiasInput] = useState('3');

  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [])
  );

  async function carregarDados() {
    const savedDias = await AsyncStorage.getItem(ALERTA_KEY);
    const dias = savedDias ? parseInt(savedDias) : 3;
    setDiasAlerta(dias);
    setDiasInput(String(dias));

    const t = buscarTotaisMes(mesAtual, anoAtual);
    setTotais(t);

    const todos = buscarLancamentos();
    const despesas = todos.filter(l => l.tipo === 'despesa');
    const porCategoria: Record<string, number> = {};
    despesas.forEach(l => {
      porCategoria[l.categoria] = (porCategoria[l.categoria] || 0) + l.valor;
    });
    const top = Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, val]) => ({ cat, val }));
    setTopGastos(top);

    // Checar vencimentos próximos
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(hoje.getDate() + dias);

    const proximos = todos.filter(l => {
      if (l.status === 'pago') return false;
      if (!l.dataVencimento) return false;
      const [d, m, a] = l.dataVencimento.split('/').map(Number);
      const dataVenc = new Date(a, m - 1, d);
      dataVenc.setHours(0, 0, 0, 0);
      return dataVenc >= hoje && dataVenc <= limite;
    }).sort((a, b) => {
      const [da, ma, aa] = a.dataVencimento.split('/').map(Number);
      const [db, mb, ab] = b.dataVencimento.split('/').map(Number);
      return new Date(aa, ma - 1, da).getTime() - new Date(ab, mb - 1, db).getTime();
    });

    setVencimentos(proximos);
  }

  async function salvarDiasAlerta() {
    const dias = parseInt(diasInput) || 3;
    await AsyncStorage.setItem(ALERTA_KEY, String(dias));
    setDiasAlerta(dias);
    setModalAlerta(false);
    carregarDados();
  }

  const fmt = (v: number) => 'R$' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const disponivel = orcamento - totais.totalGasto;
  const pct = Math.min(100, (totais.totalGasto / orcamento) * 100);
  const barCor = pct < 70 ? '#25d07e' : pct < 90 ? '#f7b731' : '#f25555';

  const meses = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const hoje = new Date();
  const diasNoMes = new Date(anoAtual, mesAtual, 0).getDate();
  const diasRestantes = diasNoMes - hoje.getDate();

  function diasParaVencer(dataVenc: string) {
    const [d, m, a] = dataVenc.split('/').map(Number);
    const venc = new Date(a, m - 1, d);
    venc.setHours(0, 0, 0, 0);
    const agora = new Date();
    agora.setHours(0, 0, 0, 0);
    const diff = Math.round((venc.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Vence hoje!';
    if (diff === 1) return 'Vence amanhã';
    return `Vence em ${diff} dias`;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ola, bem-vindo! 👋</Text>
        <Text style={styles.headerSub}>{meses[mesAtual-1]} {anoAtual}</Text>
      </View>

      {/* Banner de alertas */}
      {vencimentos.length > 0 && (
        <View style={styles.alertaBox}>
          <View style={styles.alertaHeader}>
            <Text style={styles.alertaTitle}>⚠️ Vencimentos próximos</Text>
            <TouchableOpacity onPress={() => setModalAlerta(true)}>
              <Text style={styles.alertaConfig}>⚙️ {diasAlerta}d</Text>
            </TouchableOpacity>
          </View>
          {vencimentos.map((v, i) => (
            <View key={i} style={styles.alertaRow}>
              <View style={styles.alertaInfo}>
                <Text style={styles.alertaDesc} numberOfLines={1}>{v.descricao}</Text>
                <Text style={styles.alertaData}>{diasParaVencer(v.dataVencimento)} · {v.dataVencimento}</Text>
              </View>
              <Text style={styles.alertaVal}>{fmt(v.valor)}</Text>
            </View>
          ))}
        </View>
      )}

      {vencimentos.length === 0 && (
        <TouchableOpacity style={styles.alertaVazio} onPress={() => setModalAlerta(true)}>
          <Text style={styles.alertaVazioTxt}>✅ Nenhum vencimento nos próximos {diasAlerta} dias</Text>
          <Text style={styles.alertaVazioSub}>Toque para configurar o prazo</Text>
        </TouchableOpacity>
      )}

      <View style={styles.cardsGrid}>
        <View style={[styles.card, styles.cardRed]}>
          <Text style={styles.cardLabel}>GASTO</Text>
          <Text style={[styles.cardValue, {color:'#f25555'}]}>{fmt(totais.totalGasto)}</Text>
          <Text style={styles.cardChange}>{diasRestantes} dias restantes</Text>
        </View>
        <View style={[styles.card, styles.cardGreen]}>
          <Text style={styles.cardLabel}>RECEBIDO</Text>
          <Text style={[styles.cardValue, {color:'#25d07e'}]}>{fmt(totais.totalReceita)}</Text>
          <Text style={styles.cardChange}>no mes atual</Text>
        </View>
        <View style={[styles.card, styles.cardBlue]}>
          <Text style={styles.cardLabel}>SALDO</Text>
          <Text style={[styles.cardValue, {color: totais.saldo >= 0 ? '#5294ff' : '#f25555'}]}>{fmt(totais.saldo)}</Text>
          <Text style={styles.cardChange}>receita - gastos</Text>
        </View>
        <View style={[styles.card, styles.cardAmber]}>
          <Text style={styles.cardLabel}>DISPONIVEL</Text>
          <Text style={[styles.cardValue, {color: disponivel >= 0 ? '#f7b731' : '#f25555'}]}>{fmt(disponivel)}</Text>
          <Text style={styles.cardChange}>do orcamento</Text>
        </View>
      </View>

      <View style={styles.budgetCard}>
        <View style={styles.budgetHeader}>
          <View>
            <Text style={styles.budgetTitle}>Orcamento de {meses[mesAtual-1]}</Text>
            <Text style={styles.budgetLimit}>Limite: {fmt(orcamento)}</Text>
          </View>
          <View>
            <Text style={styles.budgetAvail}>{fmt(disponivel)}</Text>
            <Text style={styles.budgetSub}>disponivel</Text>
          </View>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: barCor }]} />
        </View>
        <Text style={[styles.budgetPct, { color: barCor }]}>{pct.toFixed(1)}% consumido</Text>
      </View>

      {topGastos.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>O QUE MAIS CONSOME</Text>
          {topGastos.map((g, i) => (
            <View key={i} style={styles.topRow}>
              <Text style={styles.topRank}>{i+1}</Text>
              <View style={styles.topInfo}>
                <Text style={styles.topName}>{g.cat}</Text>
                <View style={styles.topBarTrack}>
                  <View style={[styles.topBarFill, { width: `${(g.val/totais.totalGasto*100).toFixed(0)}%` as any }]} />
                </View>
              </View>
              <Text style={styles.topVal}>{fmt(g.val)}</Text>
            </View>
          ))}
        </View>
      )}

      {topGastos.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIco}>📊</Text>
          <Text style={styles.emptyTxt}>Nenhum lancamento este mes</Text>
          <Text style={styles.emptySub}>Adicione lancamentos para ver o resumo</Text>
        </View>
      )}

      <View style={{ height: 20 }} />

      {/* Modal configurar prazo */}
      <Modal visible={modalAlerta} animationType="fade" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>⚙️ Prazo de alerta</Text>
            <Text style={styles.modalSub}>Avisar com quantos dias de antecedência?</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              maxLength={2}
              value={diasInput}
              onChangeText={setDiasInput}
              placeholder="ex: 3"
              placeholderTextColor="#6b779a"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setModalAlerta(false)}>
                <Text style={styles.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={salvarDiasAlerta}>
                <Text style={styles.btnSaveTxt}>Salvar</Text>
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

  alertaBox: { marginHorizontal:16, marginBottom:12, backgroundColor:'rgba(247,183,49,0.08)', borderRadius:14, padding:14, borderWidth:1, borderColor:'rgba(247,183,49,0.3)' },
  alertaHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  alertaTitle: { fontSize:12, fontWeight:'700', color:'#f7b731' },
  alertaConfig: { fontSize:12, color:'#5294ff', fontWeight:'600' },
  alertaRow: { flexDirection:'row', alignItems:'center', paddingVertical:7, borderTopWidth:1, borderTopColor:'rgba(255,255,255,0.06)' },
  alertaInfo: { flex:1 },
  alertaDesc: { fontSize:13, color:'#f0f3ff', fontWeight:'500' },
  alertaData: { fontSize:11, color:'#f7b731', marginTop:2 },
  alertaVal: { fontSize:13, color:'#f25555', fontWeight:'700' },

  alertaVazio: { marginHorizontal:16, marginBottom:12, backgroundColor:'rgba(37,208,126,0.06)', borderRadius:14, padding:14, borderWidth:1, borderColor:'rgba(37,208,126,0.2)', alignItems:'center' },
  alertaVazioTxt: { fontSize:12, color:'#25d07e', fontWeight:'600' },
  alertaVazioSub: { fontSize:11, color:'#6b779a', marginTop:3 },

  cardsGrid: { flexDirection:'row', flexWrap:'wrap', paddingHorizontal:16, gap:10 },
  card: { width:'47%', backgroundColor:'#1c2133', borderRadius:16, padding:16, borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  cardRed: { borderTopWidth:3, borderTopColor:'#f25555' },
  cardGreen: { borderTopWidth:3, borderTopColor:'#25d07e' },
  cardBlue: { borderTopWidth:3, borderTopColor:'#5294ff' },
  cardAmber: { borderTopWidth:3, borderTopColor:'#f7b731' },
  cardLabel: { fontSize:10, fontWeight:'600', color:'#aab4d0', letterSpacing:0.8, marginBottom:8 },
  cardValue: { fontSize:16, fontWeight:'700' },
  cardChange: { fontSize:10, color:'#6b779a', marginTop:4 },
  budgetCard: { margin:16, backgroundColor:'#1c2133', borderRadius:16, padding:18, borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  budgetHeader: { flexDirection:'row', justifyContent:'space-between', marginBottom:14 },
  budgetTitle: { fontSize:14, fontWeight:'600', color:'#f0f3ff' },
  budgetLimit: { fontSize:11, color:'#6b779a', marginTop:2 },
  budgetAvail: { fontSize:16, fontWeight:'700', color:'#f7b731', textAlign:'right' },
  budgetSub: { fontSize:11, color:'#6b779a', textAlign:'right' },
  barTrack: { height:8, backgroundColor:'#344060', borderRadius:10, overflow:'hidden', marginBottom:6 },
  barFill: { height:8, borderRadius:10 },
  budgetPct: { fontSize:11, fontWeight:'700' },
  section: { marginHorizontal:16, marginBottom:16 },
  sectionTitle: { fontSize:11, fontWeight:'600', color:'#6b779a', letterSpacing:0.8, marginBottom:12 },
  topRow: { flexDirection:'row', alignItems:'center', marginBottom:12 },
  topRank: { width:20, fontSize:12, color:'#6b779a', fontWeight:'700' },
  topInfo: { flex:1, marginHorizontal:10 },
  topName: { fontSize:13, color:'#f0f3ff', fontWeight:'500', marginBottom:4 },
  topBarTrack: { height:4, backgroundColor:'#344060', borderRadius:4, overflow:'hidden' },
  topBarFill: { height:4, backgroundColor:'#5294ff', borderRadius:4 },
  topVal: { fontSize:13, color:'#f0f3ff', fontWeight:'600' },
  emptyBox: { alignItems:'center', padding:40 },
  emptyIco: { fontSize:48, marginBottom:12 },
  emptyTxt: { fontSize:15, color:'#aab4d0', fontWeight:'600' },
  emptySub: { fontSize:13, color:'#6b779a', marginTop:4, textAlign:'center' },

  modalBg: { flex:1, backgroundColor:'rgba(0,0,0,0.75)', justifyContent:'center', alignItems:'center' },
  modalBox: { backgroundColor:'#1c2133', borderRadius:20, padding:24, width:'80%', borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  modalTitle: { fontSize:16, fontWeight:'700', color:'#f0f3ff', marginBottom:6 },
  modalSub: { fontSize:12, color:'#6b779a', marginBottom:16 },
  modalInput: { backgroundColor:'#2a3148', borderWidth:1, borderColor:'rgba(255,255,255,0.18)', borderRadius:11, padding:12, color:'#f0f3ff', fontSize:18, textAlign:'center', marginBottom:16 },
  modalBtns: { flexDirection:'row', gap:10 },
  btnCancel: { flex:1, padding:12, backgroundColor:'#2a3148', borderRadius:11, alignItems:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  btnCancelTxt: { color:'#aab4d0', fontWeight:'600' },
  btnSave: { flex:1, padding:12, backgroundColor:'#5294ff', borderRadius:11, alignItems:'center' },
  btnSaveTxt: { color:'#fff', fontWeight:'600' },
});