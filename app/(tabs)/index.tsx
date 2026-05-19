import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { buscarCartoes, buscarLancamentos, buscarLancamentosPorMes, buscarTotaisMes, buscarTotalUsadoCartao } from '../database';
import { buscarContas } from '../contas';
import HelpModal, { helpBtnStyle, helpTxtStyle } from '../HelpModal';
import { Colors, useTheme } from '../theme';

const ALERTA_KEY = '@financaspro:diasAlerta';
const ESPECIE_KEY = '@faladinheiro:dinheiroEspecie';
const ORC_KEY = '@financaspro:orcamento';
const NOME_KEY = '@financaspro:nomeUsuario';

const CORES_CATEGORIA = [
  '#5294ff','#25d07e','#f7b731','#f25555','#a855f7',
  '#06b6d4','#f97316','#ec4899','#84cc16','#14b8a6',
];

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [helpVisible, setHelpVisible] = useState(false);
  const [totais, setTotais] = useState({ totalGasto: 0, totalReceita: 0, saldo: 0 });
  const [orcamento, setOrcamento] = useState(0);
  const [topGastos, setTopGastos] = useState<{ cat: string; val: number; pct: number }[]>([]);
  const [mesAtual] = useState(new Date().getMonth() + 1);
  const [anoAtual] = useState(new Date().getFullYear());
  const [vencimentos, setVencimentos] = useState<any[]>([]);
  const [diasAlerta, setDiasAlerta] = useState(3);
  const [modalAlerta, setModalAlerta] = useState(false);
  const [modalVencimentos, setModalVencimentos] = useState(false);
  const [diasInput, setDiasInput] = useState('3');
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [modalNome, setModalNome] = useState(false);
  const [nomeInput, setNomeInput] = useState('');
  const [saldoBancos, setSaldoBancos] = useState(0);
  const [creditoDisponivel, setCreditoDisponivel] = useState(0);
  const [dinheiroEspecie, setDinheiroEspecie] = useState(0);
  const [modalEspecie, setModalEspecie] = useState(false);
  const [especieInput, setEspecieInput] = useState('');

  useFocusEffect(useCallback(() => { carregarDados(); }, []));

  async function carregarDados() {
    const savedNome = await AsyncStorage.getItem(NOME_KEY);
    if (savedNome) setNomeUsuario(savedNome);

    const savedDias = await AsyncStorage.getItem(ALERTA_KEY);
    const dias = savedDias ? parseInt(savedDias) : 3;
    setDiasAlerta(dias);
    setDiasInput(String(dias));

    const savedOrc = await AsyncStorage.getItem(ORC_KEY);
    setOrcamento(savedOrc ? parseFloat(savedOrc) : 0);

    const t = buscarTotaisMes(mesAtual, anoAtual);
    setTotais(t);

    const contas = await buscarContas();
    const totalBancos = contas.reduce((s: number, c: any) => s + (parseFloat(c.saldo) || 0), 0);
    setSaldoBancos(totalBancos);

    const cartoesLista = buscarCartoes();
    const mesAtualN = new Date().getMonth() + 1;
    const anoAtualN = new Date().getFullYear();
    let totalCreditoDisp = 0;
    for (const c of cartoesLista) {
      const limite = parseFloat(c.limite) || 0;
      const usado = buscarTotalUsadoCartao(c.id, mesAtualN, anoAtualN);
      totalCreditoDisp += Math.max(0, limite - usado);
    }
    setCreditoDisponivel(totalCreditoDisp);

    const savedEspecie = await AsyncStorage.getItem(ESPECIE_KEY);
    setDinheiroEspecie(savedEspecie ? parseFloat(savedEspecie) : 0);

    const todos = buscarLancamentos();
    const despesasMes = buscarLancamentosPorMes(mesAtual, anoAtual).filter(l => l.tipo === 'despesa');
    const porCategoria: Record<string, number> = {};
    despesasMes.forEach(l => {
      porCategoria[l.categoria] = (porCategoria[l.categoria] || 0) + l.valor;
    });
    const totalDesp = Object.values(porCategoria).reduce((s, v) => s + v, 0);
    const top = Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([cat, val]) => ({
        cat,
        val,
        pct: totalDesp > 0 ? Math.round((val / totalDesp) * 100) : 0,
      }));
    setTopGastos(top);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(hoje.getDate() + dias);

    const proximos = todos.filter(l => {
      if (l.status === 'pago') return false;
      if (l.tipo !== 'despesa') return false;
      if (!l.dataVencimento) return false;
      const [d, m, a] = l.dataVencimento.split('/').map(Number);
      const dataVenc = new Date(a, m - 1, d);
      dataVenc.setHours(0, 0, 0, 0);
      return dataVenc >= hoje && dataVenc <= limite;
    });

    // Agrupar por cartão
    const cartoes = buscarCartoes();
    const cartoesMap: Record<string, string> = {};
    cartoes.forEach((c: any) => {
      cartoesMap[c.id] = c.apelido || `${c.bandeira} ****${c.ultimos4}`;
    });

    const gruposCartao: Record<string, { valor: number; dataVencimento: string; nome: string }> = {};
    const individuais: any[] = [];

    proximos.forEach(l => {
      if (l.cartaoId) {
        if (!gruposCartao[l.cartaoId]) {
          gruposCartao[l.cartaoId] = {
            valor: 0,
            dataVencimento: l.dataVencimento,
            nome: cartoesMap[l.cartaoId] || 'Cartão',
          };
        }
        gruposCartao[l.cartaoId].valor += l.valor;
        const [da, ma, aa] = l.dataVencimento.split('/').map(Number);
        const [db, mb, ab] = gruposCartao[l.cartaoId].dataVencimento.split('/').map(Number);
        if (new Date(aa, ma - 1, da) < new Date(ab, mb - 1, db)) {
          gruposCartao[l.cartaoId].dataVencimento = l.dataVencimento;
        }
      } else {
        individuais.push(l);
      }
    });

    const itensAgrupados = [
      ...Object.entries(gruposCartao).map(([, g]) => ({
        ico: '💳', nome: g.nome, valor: g.valor, dataVencimento: g.dataVencimento,
      })),
      ...individuais.map(l => ({
        ico: '📄', nome: l.descricao, valor: l.valor, dataVencimento: l.dataVencimento,
      })),
    ].sort((a, b) => {
      const [da, ma, aa] = a.dataVencimento.split('/').map(Number);
      const [db, mb, ab] = b.dataVencimento.split('/').map(Number);
      return new Date(aa, ma - 1, da).getTime() - new Date(ab, mb - 1, db).getTime();
    });

    setVencimentos(itensAgrupados);
  }

  async function salvarNome() {
    const nome = nomeInput.trim();
    await AsyncStorage.setItem(NOME_KEY, nome);
    setNomeUsuario(nome);
    setModalNome(false);
  }

  async function salvarDiasAlerta() {
    const dias = parseInt(diasInput) || 3;
    await AsyncStorage.setItem(ALERTA_KEY, String(dias));
    setDiasAlerta(dias);
    setModalAlerta(false);
    carregarDados();
  }

  async function salvarEspecie() {
    const valor = parseFloat(especieInput.replace(',', '.')) || 0;
    await AsyncStorage.setItem(ESPECIE_KEY, String(valor));
    setDinheiroEspecie(valor);
    setModalEspecie(false);
  }

  const fmt = (v: number) => 'R$' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const saldoOrcamento = orcamento - totais.totalGasto;
  const pct = orcamento > 0 ? Math.min(100, (totais.totalGasto / orcamento) * 100) : 0;
  const meses =['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
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
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
      <View style={[styles.header, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <TouchableOpacity onPress={() => { setNomeInput(nomeUsuario); setModalNome(true); }} activeOpacity={0.8}>
          <Text style={styles.headerTitle}>Olá, {nomeUsuario || 'bem-vindo'}! 👋</Text>
          <Text style={styles.headerSub}>{meses[mesAtual-1]} {anoAtual}</Text>
          {!nomeUsuario && (
            <Text style={styles.headerDica}>👆 Toque aqui para personalizar seu app</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setHelpVisible(true)} style={helpBtnStyle}>
          <Text style={helpTxtStyle}>?</Text>
        </TouchableOpacity>
      </View>

      {vencimentos.length > 0 && (
        <View style={styles.alertaBox}>
          <View style={styles.alertaHeader}>
            <Text style={styles.alertaTitle}>⚠️ Vencimentos próximos</Text>
            <TouchableOpacity onPress={() => setModalAlerta(true)}>
              <Text style={styles.alertaConfig}>⚙️ {diasAlerta}d</Text>
            </TouchableOpacity>
          </View>
          {vencimentos.slice(0, 3).map((v, i) => (
            <View key={i} style={styles.alertaRow}>
              <Text style={styles.alertaIco}>{v.ico}</Text>
              <View style={styles.alertaInfo}>
                <Text style={styles.alertaDesc} numberOfLines={1}>{v.nome}</Text>
                <Text style={styles.alertaData}>{diasParaVencer(v.dataVencimento)} · {v.dataVencimento}</Text>
              </View>
              <Text style={styles.alertaVal}>{fmt(v.valor)}</Text>
            </View>
          ))}
          {vencimentos.length > 3 && (
            <TouchableOpacity style={styles.alertaVerTodos} onPress={() => setModalVencimentos(true)}>
              <Text style={styles.alertaVerTodosTxt}>Ver todos ({vencimentos.length}) ›</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {vencimentos.length === 0 && (
        <TouchableOpacity style={styles.alertaVazio} onPress={() => setModalAlerta(true)}>
          <Text style={styles.alertaVazioTxt}>✅ Nenhum vencimento nos próximos {diasAlerta} dias</Text>
          <Text style={styles.alertaVazioSub}>Toque para configurar o prazo</Text>
        </TouchableOpacity>
      )}

      <View style={styles.atalhos}>
        <TouchableOpacity style={[styles.atalhoCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push('/cartoes' as any)} activeOpacity={0.8}>
          <Text style={styles.atalhoIco}>🪙</Text>
          <Text style={[styles.atalhoTxt, { color: colors.textSec }]}>Cartões</Text>
          <Text style={[styles.atalhoArrow, { color: colors.textSec }]}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.atalhoCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push('/contas' as any)} activeOpacity={0.8}>
          <Text style={styles.atalhoIco}>🏦</Text>
          <Text style={[styles.atalhoTxt, { color: colors.textSec }]}>Bancos</Text>
          <Text style={[styles.atalhoArrow, { color: colors.textSec }]}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardsGrid}>
        <View style={[styles.card, styles.cardGreen]}>
          <Text style={styles.cardLabel}>RECEITAS</Text>
          <Text style={[styles.cardValue, {color:'#25d07e'}]}>{fmt(totais.totalReceita)}</Text>
          <Text style={styles.cardChange}>no mês atual</Text>
        </View>
        <View style={[styles.card, styles.cardRed]}>
          <Text style={styles.cardLabel}>DESPESAS</Text>
          <Text style={[styles.cardValue, {color:'#f25555'}]}>{fmt(totais.totalGasto)}</Text>
          <Text style={styles.cardChange}>{diasRestantes} dias restantes</Text>
        </View>
        <View style={[styles.card, styles.cardBlue]}>
          <Text style={styles.cardLabel}>SALDO REAL</Text>
          <Text style={[styles.cardValue, {color: totais.saldo >= 0 ? '#5294ff' : '#f25555'}]}>{fmt(totais.saldo)}</Text>
          <Text style={styles.cardChange}>receitas - despesas</Text>
        </View>
        <View style={[styles.card, styles.cardOrc]}>
          <Text style={styles.cardLabel}>ORÇAMENTO DE {meses[mesAtual-1].toUpperCase()}</Text>
          {orcamento > 0 ? (
            <>
              <Text style={[styles.cardValue, {color: saldoOrcamento >= 0 ? '#f7b731' : '#f25555'}]}>{fmt(saldoOrcamento)}</Text>
              <Text style={styles.cardOrcInfo}>Limite: {fmt(orcamento)}</Text>
              <Text style={styles.cardOrcInfo}>{pct.toFixed(1)}% consumido</Text>
            </>
          ) : (
            <Text style={styles.cardOrcInfo}>Não definido</Text>
          )}
        </View>
      </View>

      <View style={styles.patrimonioCard}>
        <Text style={styles.patrimonioTitle}>💼 PATRIMÔNIO REAL</Text>
        <View style={styles.patrimonioRow}>
          <View style={styles.patrimonioItem}>
            <Text style={styles.patrimonioIco}>🏦</Text>
            <Text style={styles.patrimonioLbl}>Bancos</Text>
            <Text style={[styles.patrimonioVal, { color: '#25d07e' }]}>{fmt(saldoBancos)}</Text>
          </View>
          <View style={styles.patrimonioDivider} />
          <TouchableOpacity style={styles.patrimonioItem} onPress={() => { setEspecieInput(String(dinheiroEspecie)); setModalEspecie(true); }}>
            <Text style={styles.patrimonioIco}>💵</Text>
            <Text style={styles.patrimonioLbl}>Espécie</Text>
            <Text style={[styles.patrimonioVal, { color: '#f7b731' }]}>{fmt(dinheiroEspecie)}</Text>
          </TouchableOpacity>
          <View style={styles.patrimonioDivider} />
          <View style={styles.patrimonioItem}>
            <Text style={styles.patrimonioIco}>💳</Text>
            <Text style={styles.patrimonioLbl}>Crédito disp.</Text>
            <Text style={[styles.patrimonioVal, { color: '#5294ff' }]}>{fmt(creditoDisponivel)}</Text>
          </View>
        </View>
        <View style={styles.patrimonioTotal}>
          <Text style={styles.patrimonioTotalLbl}>Disponível (bancos + espécie)</Text>
          <Text style={styles.patrimonioTotalVal}>{fmt(saldoBancos + dinheiroEspecie)}</Text>
        </View>
      </View>

      {topGastos.length > 0 && (
        <View style={styles.graficoCard}>
          <Text style={styles.graficoTitle}>GASTOS POR CATEGORIA</Text>
          <View style={styles.barraEmpilhada}>
            {topGastos.map((g, i) => (
              <View
                key={i}
                style={{
                  width: `${g.pct}%` as any,
                  height: 18,
                  backgroundColor: CORES_CATEGORIA[i % CORES_CATEGORIA.length],
                  borderRadius: i === 0 ? 6 : i === topGastos.length - 1 ? 6 : 0,
                }}
              />
            ))}
          </View>
          <View style={{ marginTop: 16 }}>
            {topGastos.map((g, i) => (
              <View key={i} style={styles.catRow}>
                <View style={[styles.catDot, { backgroundColor: CORES_CATEGORIA[i % CORES_CATEGORIA.length] }]} />
                <View style={styles.catInfo}>
                  <View style={styles.catTopRow}>
                    <Text style={styles.catNome} numberOfLines={1}>{g.cat}</Text>
                    <Text style={styles.catPct}>{g.pct}%</Text>
                    <Text style={styles.catVal}>{fmt(g.val)}</Text>
                  </View>
                  <View style={styles.catBarTrack}>
                    <View style={[styles.catBarFill, {
                      width: `${g.pct}%` as any,
                      backgroundColor: CORES_CATEGORIA[i % CORES_CATEGORIA.length],
                    }]} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {topGastos.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIco}>📊</Text>
          <Text style={styles.emptyTxt}>Nenhum lançamento este mês</Text>
          <Text style={styles.emptySub}>Adicione lançamentos para ver o resumo</Text>
        </View>
      )}

      <View style={{ height: 20 }} />

      <Modal visible={modalVencimentos} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalBox, { width: '92%', maxHeight: '80%', paddingHorizontal: 0, paddingTop: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 }}>
              <Text style={styles.modalTitle}>⚠️ Todos os vencimentos</Text>
              <TouchableOpacity onPress={() => setModalVencimentos(false)}>
                <Text style={{ fontSize: 18, color: colors.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {vencimentos.map((v, i) => (
                <View key={i} style={[styles.alertaRow, { paddingHorizontal: 20, borderTopColor: colors.borderLight }]}>
                  <Text style={styles.alertaIco}>{v.ico}</Text>
                  <View style={styles.alertaInfo}>
                    <Text style={styles.alertaDesc} numberOfLines={1}>{v.nome}</Text>
                    <Text style={styles.alertaData}>{diasParaVencer(v.dataVencimento)} · {v.dataVencimento}</Text>
                  </View>
                  <Text style={styles.alertaVal}>{fmt(v.valor)}</Text>
                </View>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={modalEspecie} animationType="fade" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>💵 Dinheiro em espécie</Text>
            <Text style={styles.modalSub}>Quanto você tem em dinheiro físico?</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={especieInput}
              onChangeText={setEspecieInput}
              placeholder="0,00"
              placeholderTextColor="#666"
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setModalEspecie(false)}>
                <Text style={styles.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={salvarEspecie}>
                <Text style={styles.btnSaveTxt}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalNome} animationType="fade" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Meu nome</Text>
            <Text style={styles.modalSub}>Como deseja ser chamado?</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Digite seu nome..."
              placeholderTextColor={colors.textMuted}
              value={nomeInput}
              onChangeText={setNomeInput}
              autoFocus
              maxLength={30}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setModalNome(false)}>
                <Text style={styles.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={salvarNome}>
                <Text style={styles.btnSaveTxt}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
              placeholderTextColor={colors.textMuted}
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
      <HelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        title="Como usar o Dashboard"
        tips={[
          "Toque na saudação 'Olá...' para informar seu nome.",
          'Os cards mostram Receitas, Despesas, Saldo Real e Orçamento do mês atual.',
          'O banner de vencimentos exibe contas não pagas nos próximos N dias.',
          'Toque em ⚙️ N dias no banner para ajustar o prazo de alerta.',
          'Os gastos por categoria aparecem logo abaixo do saldo.',
        ]}
      />
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex:1, backgroundColor:c.bg },
    header: { padding:22, paddingTop:50 },
    headerTitle: { fontSize:22, fontWeight:'700', color:c.text },
    headerSub: { fontSize:13, color:c.textMuted, marginTop:2 },
    headerDica: { fontSize: 11, color: '#5294ff', marginTop: 4, fontStyle: 'italic' },
    alertaBox: { marginHorizontal:20, marginBottom:12, backgroundColor:'rgba(247,183,49,0.08)', borderRadius:14, padding:14, borderWidth:1, borderColor:'rgba(247,183,49,0.3)' },
    alertaHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
    alertaTitle: { fontSize:12, fontWeight:'700', color:'#f7b731' },
    alertaConfig: { fontSize:12, color:'#5294ff', fontWeight:'600' },
    alertaRow: { flexDirection:'row', alignItems:'center', paddingVertical:7, borderTopWidth:1, borderTopColor:c.borderLight },
    alertaIco: { fontSize:16, marginRight:8 },
    alertaInfo: { flex:1 },
    alertaDesc: { fontSize:13, color:c.text, fontWeight:'500' },
    alertaData: { fontSize:11, color:'#f7b731', marginTop:2 },
    alertaVal: { fontSize:13, color:'#f25555', fontWeight:'700' },
    alertaVerTodos: { marginTop:8, paddingTop:8, borderTopWidth:1, borderTopColor:c.borderLight, alignItems:'center' },
    alertaVerTodosTxt: { fontSize:12, color:'#5294ff', fontWeight:'600' },
    alertaVazio: { marginHorizontal:20, marginBottom:12, backgroundColor:'rgba(37,208,126,0.06)', borderRadius:14, padding:14, borderWidth:1, borderColor:'rgba(37,208,126,0.2)', alignItems:'center' },
    alertaVazioTxt: { fontSize:12, color:'#25d07e', fontWeight:'600' },
    alertaVazioSub: { fontSize:11, color:c.textMuted, marginTop:3 },
    atalhos: { flexDirection:'row', paddingHorizontal:16, gap:10, marginBottom:10 },
    atalhoCard: { width:'47%', borderRadius:10, paddingVertical:9, paddingHorizontal:12, borderWidth:1, flexDirection:'row', alignItems:'center', gap:6 },
    atalhoIco: { fontSize:18 },
    atalhoTxt: { fontSize:12, fontWeight:'600' },
    atalhoArrow: { fontSize:18 },
    cardsGrid: { flexDirection:'row', flexWrap:'wrap', paddingHorizontal:16, gap:12, marginBottom:4 },
    card: { width:'47%', backgroundColor:c.card, borderRadius:16, paddingVertical:14, paddingHorizontal:16, borderWidth:1, borderColor:c.border },
    cardRed: { borderTopWidth:3, borderTopColor:'#f25555' },
    cardGreen: { borderTopWidth:3, borderTopColor:'#25d07e' },
    cardBlue: { borderTopWidth:3, borderTopColor:'#5294ff' },
    cardOrc: { borderTopWidth:3, borderTopColor:'#f7b731' },
    cardLabel: { fontSize:9, fontWeight:'600', color:c.textSec, letterSpacing:0.8, marginBottom:8 },
    cardValue: { fontSize:15, fontWeight:'700' },
    cardChange: { fontSize:9, color:c.textMuted, marginTop:4 },
    cardOrcInfo: { fontSize:11, color:c.textMuted, marginTop:2 },
    graficoCard: { marginHorizontal:16, marginBottom:14, backgroundColor:c.card, borderRadius:16, padding:18, borderWidth:1, borderColor:c.borderSoft },
    graficoTitle: { fontSize:11, fontWeight:'700', color:c.textSec, letterSpacing:0.8, marginBottom:12 },
    barraEmpilhada: { flexDirection:'row', height:18, borderRadius:6, overflow:'hidden', backgroundColor:c.barTrack2 },
    catRow: { flexDirection:'row', alignItems:'flex-start', marginBottom:12 },
    catDot: { width:10, height:10, borderRadius:5, marginTop:3, marginRight:10 },
    catInfo: { flex:1 },
    catTopRow: { flexDirection:'row', justifyContent:'space-between', marginBottom:5 },
    catNome: { flex:1, fontSize:12, color:c.text, fontWeight:'500' },
    catPct: { fontSize:11, color:c.textMuted, marginRight:8 },
    catVal: { fontSize:12, color:c.textSec },
    catBarTrack: { height:4, backgroundColor:c.barTrack, borderRadius:4, overflow:'hidden' },
    catBarFill: { height:4, borderRadius:4 },
    emptyBox: { alignItems:'center', padding:40 },
    emptyIco: { fontSize:48, marginBottom:12 },
    emptyTxt: { fontSize:15, color:c.textSec, fontWeight:'600' },
    emptySub: { fontSize:13, color:c.textMuted, marginTop:4, textAlign:'center' },
    modalBg: { flex:1, backgroundColor:'rgba(0,0,0,0.75)', justifyContent:'center', alignItems:'center' },
    modalBox: { backgroundColor:c.card, borderRadius:20, padding:24, width:'80%', borderWidth:1, borderColor:c.border },
    modalTitle: { fontSize:16, fontWeight:'700', color:c.text, marginBottom:6 },
    modalSub: { fontSize:12, color:c.textMuted, marginBottom:16 },
    modalInput: { backgroundColor:c.input, borderWidth:1, borderColor:c.border, borderRadius:11, padding:12, color:c.text, fontSize:18, textAlign:'center', marginBottom:16 },
    modalBtns: { flexDirection:'row', gap:10 },
    btnCancel: { flex:1, padding:12, backgroundColor:c.input, borderRadius:11, alignItems:'center', borderWidth:1, borderColor:c.border },
    btnCancelTxt: { color:c.textSec, fontWeight:'600' },
    btnSave: { flex:1, padding:12, backgroundColor:'#5294ff', borderRadius:11, alignItems:'center' },
    btnSaveTxt: { color:'#fff', fontWeight:'600' },
    patrimonioCard: { marginHorizontal: 16, marginBottom: 14, backgroundColor: c.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.borderSoft },
    patrimonioTitle: { fontSize: 11, fontWeight: '700', color: c.textSec, letterSpacing: 0.8, marginBottom: 14 },
    patrimonioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    patrimonioItem: { flex: 1, alignItems: 'center', gap: 4 },
    patrimonioIco: { fontSize: 22 },
    patrimonioLbl: { fontSize: 10, color: c.textMuted, fontWeight: '600' },
    patrimonioVal: { fontSize: 13, fontWeight: '700' },
    patrimonioDivider: { width: 1, height: 50, backgroundColor: c.borderLight },
    patrimonioTotal: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.borderLight, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    patrimonioTotalLbl: { fontSize: 11, color: c.textMuted },
    patrimonioTotalVal: { fontSize: 15, fontWeight: '700', color: c.text },
  });
}
