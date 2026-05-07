import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import HelpModal, { helpBtnStyle, helpTxtStyle } from './HelpModal';
import { buscarContas, debitarConta } from './contas';
import { atualizarCartao, buscarCartoes, buscarFaturaCartao, buscarLancamentosPorCartao, buscarTotalUsadoCartao, deletarCartao, gerarId, inserirCartao, pagarFaturaCartao } from './database';
import { Colors, useTheme } from './theme';

const CARTOES_KEY_LEGADO = '@financaspro:cartoes';

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
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [helpVisible, setHelpVisible] = useState(false);
  const [cartoes, setCartoes] = useState<CartaoComUso[]>([]);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Cartao | null>(null);
  const [apelido, setApelido] = useState('');
  const [bandeira, setBandeira] = useState('Visa');
  const [ultimos4, setUltimos4] = useState('');
  const [fechamento, setFechamento] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [limite, setLimite] = useState('');

  const [modalFatura, setModalFatura] = useState(false);
  const [cartaoFatura, setCartaoFatura] = useState<CartaoComUso | null>(null);
  const [mesFatura, setMesFatura] = useState(new Date().getMonth() + 1);
  const [anoFatura, setAnoFatura] = useState(new Date().getFullYear());
  const [dataFaturaObj, setDataFaturaObj] = useState(new Date());
  const [dataFaturaStr, setDataFaturaStr] = useState(hoje());
  const [mostrarCalFatura, setMostrarCalFatura] = useState(false);
  const [contasFatura, setContasFatura] = useState<Conta[]>([]);
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
    const legado = await AsyncStorage.getItem(CARTOES_KEY_LEGADO);
    if (legado) {
      const lista: Cartao[] = JSON.parse(legado);
      for (const c of lista) { inserirCartao(c); }
      await AsyncStorage.removeItem(CARTOES_KEY_LEGADO);
    }

    const lista = buscarCartoes();
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

    Alert.alert(
      '⚠️ Confirmar pagamento da fatura',
      `Cartão: ${cartaoFatura.apelido}\nFatura: ${MESES[mesFatura-1]}/${anoFatura}\nTotal: R$ ${totalFatura.toFixed(2).replace('.',',')}\nLançamentos: ${itensPendentes}\n\nEsta ação marcará todos como pagos e não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar pagamento',
          style: 'destructive',
          onPress: () => {
            const totalPago = totalFatura;
            const qtdPago = itensPendentes;
            pagarFaturaCartao(cartaoFatura!.id, mesFatura, anoFatura, dataFaturaStr);
            setModalFatura(false);
            loadCartoes();

            if (contasFatura.length === 0) {
              Alert.alert('✅ Fatura paga!', `${qtdPago} lançamento(s) marcados como pagos.`);
              return;
            }

            const botoesConta = contasFatura.map(ct => ({
              text: ct.nome,
              onPress: () => debitarConta(ct.id, totalPago),
            }));

            Alert.alert(
              '✅ Fatura paga!',
              `${qtdPago} lançamento(s) marcados como pagos.\n\nDe qual conta deseja debitar R$ ${totalPago.toFixed(2).replace('.', ',')}?`,
              [...botoesConta, { text: 'Não debitar', style: 'cancel' as const }]
            );
          },
        },
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

  function salvarCartao() {
    if (!ultimos4 || ultimos4.length !== 4) {
      Alert.alert('Atenção', 'Digite os 4 últimos dígitos do cartão.');
      return;
    }
    if (!fechamento || !vencimento) {
      Alert.alert('Atenção', 'Digite o dia de fechamento e vencimento.');
      return;
    }
    const diaFech = parseInt(fechamento, 10);
    const diaVenc = parseInt(vencimento, 10);
    if (isNaN(diaFech) || diaFech < 1 || diaFech > 31) {
      Alert.alert('Atenção', 'O dia de fechamento deve ser entre 1 e 31.');
      return;
    }
    if (isNaN(diaVenc) || diaVenc < 1 || diaVenc > 31) {
      Alert.alert('Atenção', 'O dia de vencimento deve ser entre 1 e 31.');
      return;
    }
    const apelidoFinal = apelido || bandeira + ' ****' + ultimos4;
    const limiteNorm = parseBRValue(limite);
    if (editando) {
      atualizarCartao(editando.id, { apelido: apelidoFinal, bandeira, ultimos4, fechamento, vencimento, limite: limiteNorm });
    } else {
      inserirCartao({ id: gerarId(), apelido: apelidoFinal, bandeira, ultimos4, fechamento, vencimento, limite: limiteNorm });
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

  function confirmarExclusao(id: string) {
    deletarCartao(id);
    loadCartoes();
  }

  function limparForm() {
    setApelido(''); setBandeira('Visa'); setUltimos4('');
    setFechamento(''); setVencimento(''); setLimite('');
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
        <Text style={styles.headerTitle}>Meus Cartões</Text>
        <TouchableOpacity onPress={() => setHelpVisible(true)} style={helpBtnStyle}>
          <Text style={helpTxtStyle}>?</Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        {cartoes.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIco}>💳</Text>
            <Text style={styles.emptyTxt}>Nenhum cartão cadastrado</Text>
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
                      <Text style={[styles.limiteVal, { color: colors.textSec }]}>{fmt(parseFloat(c.limite))}</Text>
                    </View>
                    <View style={styles.limiteSep} />
                    <View style={styles.limiteItem}>
                      <Text style={styles.limiteLabel}>USADO</Text>
                      <Text style={[styles.limiteVal, { color: '#f25555' }]}>{fmt(c.usado)}</Text>
                    </View>
                    <View style={styles.limiteSep} />
                    <View style={styles.limiteItem}>
                      <Text style={styles.limiteLabel}>DISPONÍVEL</Text>
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

      {/* Modal cadastro/edição */}
      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editando ? 'Editar Cartão' : 'Novo Cartão'}</Text>
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
            <Text style={styles.lbl}>4 últimos dígitos *</Text>
            <TextInput style={styles.input} placeholder="ex: 1234" placeholderTextColor={colors.textMuted} keyboardType="numeric" maxLength={4} value={ultimos4} onChangeText={setUltimos4} />
            <Text style={styles.lbl}>Apelido (opcional)</Text>
            <TextInput style={styles.input} placeholder="ex: Nubank, Inter..." placeholderTextColor={colors.textMuted} value={apelido} onChangeText={setApelido} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lbl}>Dia fechamento *</Text>
                <TextInput style={styles.input} placeholder="ex: 10" placeholderTextColor={colors.textMuted} keyboardType="numeric" maxLength={2} value={fechamento} onChangeText={v => setFechamento(v.replace(/\D/g, ''))} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lbl}>Dia vencimento *</Text>
                <TextInput style={styles.input} placeholder="ex: 20" placeholderTextColor={colors.textMuted} keyboardType="numeric" maxLength={2} value={vencimento} onChangeText={v => setVencimento(v.replace(/\D/g, ''))} />
              </View>
            </View>
            <Text style={styles.lbl}>Limite R$ (opcional)</Text>
            <TextInput style={styles.input} placeholder="Ex: 1600 ou 1600,00" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={limite} onChangeText={setLimite} />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={fecharModal}>
                <Text style={styles.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={salvarCartao}>
                <Text style={styles.btnSaveTxt}>{editando ? 'Salvar alterações' : 'Salvar'}</Text>
              </TouchableOpacity>
            </View>
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

              <View style={styles.mesNav}>
                <TouchableOpacity onPress={() => mudarMesFatura(-1)} style={styles.mesNavBtn}>
                  <Text style={styles.mesNavTxt}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.mesTxt}>{MESES[mesFatura-1]} / {anoFatura}</Text>
                <TouchableOpacity onPress={() => mudarMesFatura(1)} style={styles.mesNavBtn}>
                  <Text style={styles.mesNavTxt}>›</Text>
                </TouchableOpacity>
              </View>

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

              <TouchableOpacity
                style={[styles.btnConfirmarFatura, itensPendentes === 0 && { backgroundColor: colors.input }]}
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
      <HelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        title="Como cadastrar cartões"
        tips={[
          'Toque em + para adicionar um novo cartão.',
          'Preencha apelido, bandeira, últimos 4 dígitos, dia de fechamento e dia de vencimento.',
          'O limite é opcional — serve para controle de gastos e alerta de uso.',
          'Toque no cartão para ver a fatura e as parcelas em aberto.',
          '"Pagar fatura" marca todas as parcelas do mês como pagas.',
          'Ao lançar uma despesa no Crédito, o app pede o cartão e o número de parcelas.',
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
    empty: { alignItems: 'center', padding: 48 },
    emptyIco: { fontSize: 48, marginBottom: 12 },
    emptyTxt: { fontSize: 15, color: c.textSec, fontWeight: '600' },
    emptySub: { fontSize: 13, color: c.textMuted, marginTop: 4 },
    cartaoCard: { margin: 16, marginBottom: 8, backgroundColor: c.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.borderSoft },
    cartaoTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    cartaoIco: { fontSize: 28, marginRight: 14 },
    cartaoInfo: { flex: 1 },
    cartaoNome: { fontSize: 14, fontWeight: '600', color: c.text },
    cartaoSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    editBtn: { padding: 8 },
    editTxt: { fontSize: 16 },
    delBtn: { padding: 8 },
    delTxt: { fontSize: 18 },
    limiteBox: { borderTopWidth: 1, borderTopColor: c.borderLight, paddingTop: 12 },
    limiteRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    limiteItem: { flex: 1, alignItems: 'center' },
    limiteLabel: { fontSize: 9, fontWeight: '700', color: c.textMuted, letterSpacing: 0.8, marginBottom: 4 },
    limiteVal: { fontSize: 13, fontWeight: '700' },
    limiteSep: { width: 1, backgroundColor: c.borderLight },
    barTrack: { height: 6, backgroundColor: c.barTrack2, borderRadius: 10, overflow: 'hidden', marginBottom: 5 },
    barFill: { height: 6, borderRadius: 10 },
    barPct: { fontSize: 10, fontWeight: '600', textAlign: 'right' },
    semLimite: { fontSize: 11, color: c.textMuted, fontStyle: 'italic', borderTopWidth: 1, borderTopColor: c.borderLight, paddingTop: 10 },
    btnFatura: { marginTop: 12, backgroundColor: 'rgba(82,148,255,0.15)', borderRadius: 10, padding: 11, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(82,148,255,0.35)' },
    btnFaturaTxt: { fontSize: 13, color: '#5294ff', fontWeight: '700' },
    fab: { position: 'absolute', bottom: 100, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#5294ff', alignItems: 'center', justifyContent: 'center', elevation: 8 },
    fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)' },
    modalBox: { backgroundColor: c.card, borderRadius: 24, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: c.border, margin: 16 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: c.text },
    modalFechar: { padding: 4 },
    modalFecharTxt: { fontSize: 18, color: c.textMuted },
    lbl: { fontSize: 11.5, fontWeight: '500', color: c.textSec, marginBottom: 5, marginTop: 12 },
    input: { backgroundColor: c.input, borderWidth: 1, borderColor: c.border, borderRadius: 11, padding: 11, color: c.text, fontSize: 14, marginBottom: 12 },
    bandBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: c.input, borderRadius: 16, borderWidth: 1, borderColor: c.border },
    bandBtnOn: { backgroundColor: 'rgba(82,148,255,0.18)', borderColor: '#5294ff' },
    bandTxt: { fontSize: 13, color: c.text, fontWeight: '500' },
    modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
    btnCancel: { flex: 1, padding: 14, backgroundColor: c.input, borderRadius: 11, alignItems: 'center', borderWidth: 1, borderColor: c.border },
    btnCancelTxt: { color: c.textSec, fontWeight: '600', fontSize: 14 },
    btnSave: { flex: 1, padding: 14, backgroundColor: '#5294ff', borderRadius: 11, alignItems: 'center' },
    btnSaveTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },
    cartaoNomeFatura: { fontSize: 15, fontWeight: '700', color: c.text, textAlign: 'center', marginBottom: 16 },
    mesNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.input, borderRadius: 11, padding: 8, marginBottom: 16 },
    mesNavBtn: { padding: 8 },
    mesNavTxt: { fontSize: 24, color: '#5294ff', fontWeight: '700' },
    mesTxt: { fontSize: 15, fontWeight: '700', color: c.text },
    faturaResumo: { backgroundColor: c.bg, borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(82,148,255,0.2)' },
    faturaResumoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.borderLight },
    faturaResumoLbl: { fontSize: 13, color: c.textMuted },
    faturaResumoVal: { fontSize: 16, fontWeight: '700', color: '#5294ff' },
    faturaResumoSub: { fontSize: 13, color: c.textSec },
    faturaJaPaga: { fontSize: 13, color: '#25d07e', textAlign: 'center', marginTop: 8, fontWeight: '600' },
    faturaSemItens: { fontSize: 13, color: c.textMuted, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
    dataBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.input, borderWidth: 1, borderColor: c.border, borderRadius: 11, padding: 12, gap: 10, marginBottom: 4 },
    dataBtnIco: { fontSize: 18 },
    dataBtnTxt: { fontSize: 14, color: c.text, fontWeight: '500' },
    btnConfirmarFatura: { backgroundColor: '#5294ff', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
    btnConfirmarFaturaTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}
