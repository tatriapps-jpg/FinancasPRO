import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { buscarCartoes, buscarLancamentos, buscarLancamentosEmAtraso, buscarLancamentosPorMes, deletarGrupoLancamentos, deletarLancamento } from '../database';
import HelpModal, { helpBtnStyle, helpTxtStyle } from '../HelpModal';
import { Colors, useTheme } from '../theme';
import { buscarContas, creditarConta, debitarConta } from '../contas';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const LIMITE_GRATIS          = 150;
const LIMITE_DIAS            = 30;
const DESBLOQUEADO_KEY       = '@faladinheiro:desbloqueado';
const PRIMEIRO_LANCAMENTO_KEY = '@faladinheiro:primeiroLancamento';

export default function LancamentosScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const _hoje = new Date();
  const [helpVisible, setHelpVisible] = useState(false);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [atrasados, setAtrasados] = useState<any[]>([]);
  const [totalGeral, setTotalGeral] = useState(0);
  const [cartoes, setCartoes] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [modalPaywall, setModalPaywall] = useState(false);
  const [diasDecorridos, setDiasDecorridos] = useState(0);
  const [mesFiltro, setMesFiltro] = useState(_hoje.getMonth() + 1);
  const [anoFiltro, setAnoFiltro] = useState(_hoje.getFullYear());
  const [todosMeses, setTodosMeses] = useState(false);

  useFocusEffect(
    useCallback(() => {
      carregarLancamentos();
    }, [])
  );

  async function carregarLancamentos(mes = mesFiltro, ano = anoFiltro, todos = todosMeses) {
    const [saved, primLancStr] = await Promise.all([
      AsyncStorage.getItem(DESBLOQUEADO_KEY),
      AsyncStorage.getItem(PRIMEIRO_LANCAMENTO_KEY),
    ]);
    setDesbloqueado(saved === 'true');
    if (primLancStr) {
      const dias = Math.floor((Date.now() - parseInt(primLancStr, 10)) / 86400000);
      setDiasDecorridos(Math.min(dias, LIMITE_DIAS));
    }

    const parsData = (d: string) => {
      if (!d) return 0;
      const [dia, mm, aa] = d.split('/').map(Number);
      return new Date(aa, mm - 1, dia).getTime();
    };

    const atrasadosBuscados = buscarLancamentosEmAtraso();
    atrasadosBuscados.sort((a, b) => parsData(a.dataVencimento) - parsData(b.dataVencimento));
    setAtrasados(atrasadosBuscados);

    const idsAtrasados = new Set(atrasadosBuscados.map((l: any) => l.id));
    const fonte = todos ? buscarLancamentos() : buscarLancamentosPorMes(mes, ano);
    const dados = fonte.filter((l: any) => !idsAtrasados.has(l.id));
    dados.sort((a, b) => {
      const vA = parsData(a.dataVencimento || a.data);
      const vB = parsData(b.dataVencimento || b.data);
      if (vA !== vB) return vA - vB;
      return a.parcelaAtual - b.parcelaAtual;
    });

    setLancamentos(dados);
    setTotalGeral(buscarLancamentos().length);
    setCartoes(buscarCartoes());
    setContas(await buscarContas());
  }

  function navMesFiltro(dir: number) {
    let novoMes = mesFiltro + dir;
    let novoAno = anoFiltro;
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    setMesFiltro(novoMes);
    setAnoFiltro(novoAno);
    carregarLancamentos(novoMes, novoAno, todosMeses);
  }

  function toggleTodos() {
    const novo = !todosMeses;
    setTodosMeses(novo);
    carregarLancamentos(mesFiltro, anoFiltro, novo);
  }

  function vinculoLabel(l: any): string {
    const mapFP: Record<string, string> = {
      Credito: 'Crédito', Debito: 'Débito', Pix: 'Pix',
      Dinheiro: 'Dinheiro', Boleto: 'Boleto',
      'Transferência': 'Transferência', 'Depósito': 'Depósito', Outro: 'Outro',
    };
    const formaPagLabel = mapFP[l.formaPag] || l.formaPag || '';

    if (l.cartaoId) {
      const c = cartoes.find((c: any) => c.id === l.cartaoId);
      return c ? (c.apelido || `${c.bandeira} ****${c.ultimos4}`) : formaPagLabel;
    }

    const comConta = ['Pix', 'Debito', 'Transferência', 'Depósito'].includes(l.formaPag);
    if (l.contaId && comConta) {
      const ct = contas.find((ct: any) => ct.id === l.contaId);
      return ct ? `${formaPagLabel} · ${ct.nome}` : formaPagLabel;
    }

    if (l.contaId) {
      const ct = contas.find((ct: any) => ct.id === l.contaId);
      return ct ? ct.nome : formaPagLabel;
    }

    return formaPagLabel;
  }

  const fmt = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  const tagColor: Record<string, string> = {
    pago: '#25d07e', pendente: '#f7b731', parcelado: '#5294ff', recebido: '#25d07e'
  };
  const tagLabel: Record<string, string> = {
    pago: 'Pago', pendente: 'Pendente', parcelado: 'Parc.', recebido: 'Recebido'
  };

  const filtrados = lancamentos.filter(t =>
    t.descricao.toLowerCase().includes(busca.toLowerCase()) ||
    (t.categoria && t.categoria.toLowerCase().includes(busca.toLowerCase())) ||
    (t.formaPag && t.formaPag.toLowerCase().includes(busca.toLowerCase()))
  );

  const filtradosAtrasados = atrasados.filter(t =>
    t.descricao.toLowerCase().includes(busca.toLowerCase()) ||
    (t.categoria && t.categoria.toLowerCase().includes(busca.toLowerCase())) ||
    (t.formaPag && t.formaPag.toLowerCase().includes(busca.toLowerCase()))
  );

  const mesAtualNum = _hoje.getMonth() + 1;
  const anoAtualNum = _hoje.getFullYear();
  const ehMesAtual = todosMeses || (mesFiltro === mesAtualNum && anoFiltro === anoAtualNum);

  const diasRestantes = Math.max(0, LIMITE_DIAS - diasDecorridos);
  const lancRestantes = Math.max(0, LIMITE_GRATIS - totalGeral);
  const pctLanc = totalGeral / LIMITE_GRATIS;
  const pctDias = diasDecorridos / LIMITE_DIAS;
  const showDiasProgress = diasDecorridos > 0 && pctDias >= pctLanc;
  const atingiuLimite = !desbloqueado && (totalGeral >= LIMITE_GRATIS || diasDecorridos >= LIMITE_DIAS);

  function tentarAdicionar() {
    if (atingiuLimite) {
      setModalPaywall(true);
    } else {
      router.push('/novo-lancamento');
    }
  }

  const FORMAS_COM_CONTA = ['Pix', 'Debito', 'Transferência', 'Depósito'];

  async function restaurarSaldoAoExcluir(item: any) {
    if (item.tipo === 'despesa') {
      if (item.formaPag === 'Dinheiro') {
        await creditarConta('especie_fixa', item.valor);
      } else if (item.contaId && FORMAS_COM_CONTA.includes(item.formaPag)) {
        await creditarConta(item.contaId, item.valor);
      }
    } else if (item.tipo === 'receita') {
      if (item.formaPag === 'Dinheiro') {
        await debitarConta('especie_fixa', item.valor);
      } else if (item.contaId && FORMAS_COM_CONTA.includes(item.formaPag)) {
        await debitarConta(item.contaId, item.valor);
      }
    }
  }

  async function restaurarSaldoGrupoAoExcluir(grupoId: string) {
    const { buscarTodosLancamentos } = await import('../database');
    const todos = buscarTodosLancamentos();
    const parcelas = todos.filter((l: any) => l.grupoId === grupoId);
    for (const p of parcelas) {
      await restaurarSaldoAoExcluir(p);
    }
  }

  function deletar(item: any) {
    const ehGrupo = item.grupoId && (item.totalParcelas || 1) > 1;

    if (ehGrupo) {
      Alert.alert(
        'Excluir lançamento',
        `"${item.descricao}"\n\nEste lançamento faz parte de um grupo parcelado. O que deseja excluir?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Só esta parcela', onPress: async () => { await restaurarSaldoAoExcluir(item); deletarLancamento(item.id); carregarLancamentos(); } },
          { text: 'Todas as parcelas', style: 'destructive', onPress: async () => { await restaurarSaldoGrupoAoExcluir(item.grupoId); deletarGrupoLancamentos(item.grupoId); carregarLancamentos(); } },
        ]
      );
    } else {
      Alert.alert(
        'Excluir lançamento',
        `Deseja excluir "${item.descricao}"?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Excluir', style: 'destructive', onPress: async () => { await restaurarSaldoAoExcluir(item); deletarLancamento(item.id); carregarLancamentos(); } },
        ]
      );
    }
  }

  function editar(item: any) {
    router.push({
      pathname: '/editar-lancamento',
      params: {
        id: item.id,
        descricao: item.descricao,
        valor: String(item.valor),
        categoria: item.categoria,
        status: item.status,
        obs: item.obs || '',
        tipo: item.tipo,
        formaPag: item.formaPag || '',
        dataPagamento: item.dataPagamento || '',
        cartaoId: item.cartaoId || '',
        contaId: item.contaId || '',
        data: item.data || '',
        dataVencimento: item.dataVencimento || '',
        grupoId: item.grupoId || '',
        totalParcelas: String(item.totalParcelas || 1),
      }
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Lançamentos</Text>
          <Text style={styles.headerSub}>{lancamentos.length} lançamento(s)</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {!desbloqueado && (
          <View style={[styles.contadorBadge, atingiuLimite && styles.contadorBadgeRed]}>
            <Text style={[styles.contadorTxt, atingiuLimite && styles.contadorTxtRed]}>
              {atingiuLimite
                ? '🔒 Limite atingido'
                : showDiasProgress
                  ? `${diasRestantes}d restantes`
                  : `${lancRestantes} lançamentos restantes`}
            </Text>
          </View>
        )}
        <TouchableOpacity onPress={() => setHelpVisible(true)} style={helpBtnStyle}>
          <Text style={helpTxtStyle}>?</Text>
        </TouchableOpacity>
        </View>
      </View>

      {!desbloqueado && (
        <View style={styles.progressBox}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {
              width: `${Math.min(100, (showDiasProgress ? pctDias : pctLanc) * 100)}%` as any,
              backgroundColor: atingiuLimite ? '#f25555' : (showDiasProgress ? pctDias : pctLanc) > 0.8 ? '#f7b731' : '#5294ff'
            }]} />
          </View>
          <Text style={styles.progressTxt}>
            {showDiasProgress
              ? `${diasDecorridos} de ${LIMITE_DIAS} dias do período gratuito`
              : `${totalGeral} de ${LIMITE_GRATIS} lançamentos gratuitos`}
          </Text>
        </View>
      )}

      <View style={styles.mesNavBar}>
        <TouchableOpacity style={styles.mesNavBtn} onPress={() => navMesFiltro(-1)} disabled={todosMeses}>
          <Text style={[styles.mesNavArrow, todosMeses && { color: colors.textMuted }]}>◀</Text>
        </TouchableOpacity>
        <Text style={[styles.mesNavTxt, todosMeses && { color: colors.textMuted }]}>
          {MESES[mesFiltro - 1]} {anoFiltro}
        </Text>
        <TouchableOpacity style={styles.mesNavBtn} onPress={() => navMesFiltro(1)} disabled={todosMeses}>
          <Text style={[styles.mesNavArrow, todosMeses && { color: colors.textMuted }]}>▶</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.todosBtnNav, todosMeses && styles.todosBtnNavOn]} onPress={toggleTodos}>
          <Text style={[styles.todosBtnNavTxt, todosMeses && styles.todosBtnNavTxtOn]}>Todos</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar lançamento..."
          placeholderTextColor={colors.textMuted}
          value={busca}
          onChangeText={setBusca}
        />
        {busca.length > 0 &&
          <TouchableOpacity onPress={() => setBusca('')}>
            <Text style={{ color: colors.textMuted, fontSize:16 }}>✕</Text>
          </TouchableOpacity>
        }
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Lançamentos em atraso — só no mês atual ou "Todos" */}
        {ehMesAtual && filtradosAtrasados.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderTxt}>⚠️ Em atraso ({filtradosAtrasados.length})</Text>
            </View>
            {filtradosAtrasados.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.txRow, styles.txRowAtrasado]}
                onPress={() => editar(t)}
                onLongPress={() => deletar(t)}
              >
                <View style={[styles.txIco, styles.txIcoAtrasado]}>
                  <Text style={{ fontSize: 18 }}>⚠️</Text>
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txName}>{t.descricao}</Text>
                  <View style={styles.txMeta}>
                    <Text style={styles.txTagAtrasado}>⚠️ Atrasado</Text>
                    <Text style={styles.txSub}>{[t.categoria, vinculoLabel(t)].filter(Boolean).join(' · ')}</Text>
                  </View>
                </View>
                <View style={styles.txRight}>
                  <Text style={[styles.txAmt, { color: '#f25555' }]}>
                    -{fmt(t.valor)}
                  </Text>
                  <Text style={[styles.txDate, { color: '#f25555' }]}>{t.dataVencimento}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Lançamentos normais */}
        {filtrados.length === 0 && (!ehMesAtual || filtradosAtrasados.length === 0) && (
          <View style={styles.empty}>
            <Text style={styles.emptyIco}>📋</Text>
            <Text style={styles.emptyTxt}>
              {lancamentos.length === 0 ? 'Nenhum lançamento ainda' : 'Nenhum resultado encontrado'}
            </Text>
            <Text style={styles.emptySub}>
              {lancamentos.length === 0 ? 'Toque no + para adicionar' : 'Tente outra busca'}
            </Text>
          </View>
        )}
        {filtrados.length > 0 && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderTxt}>Todos os lançamentos</Text>
          </View>
        )}
        {filtrados.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={styles.txRow}
            onPress={() => editar(t)}
            onLongPress={() => deletar(t)}
          >
            <View style={styles.txIco}>
              <Text style={{ fontSize: 18 }}>{t.tipo === 'receita' ? '💰' : '💸'}</Text>
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txName}>{t.descricao}</Text>
              <View style={styles.txMeta}>
                <Text style={[styles.txTag, { color: tagColor[t.status] || colors.textSec, backgroundColor: (tagColor[t.status] || colors.textSec) + '22' }]}>
                  {tagLabel[t.status] || t.status}
                </Text>
                <Text style={styles.txSub}>{[t.categoria, vinculoLabel(t)].filter(Boolean).join(' · ')}</Text>
              </View>
            </View>
            <View style={styles.txRight}>
              <Text style={[styles.txAmt, t.tipo === 'receita' && { color: '#25d07e' }]}>
                {t.tipo === 'receita' ? '+' : '-'}{fmt(t.valor)}
              </Text>
              <Text style={styles.txDate}>{t.dataVencimento || t.data}</Text>
            </View>
          </TouchableOpacity>
        ))}
        {(filtrados.length > 0 || filtradosAtrasados.length > 0) && (
          <Text style={styles.hint}>Toque para editar · Toque longo para excluir</Text>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, atingiuLimite && styles.fabLocked]}
        onPress={tentarAdicionar}
        activeOpacity={0.7}
      >
        <Text style={styles.fabText}>{atingiuLimite ? '🔒' : '+'}</Text>
      </TouchableOpacity>

      <Modal visible={modalPaywall} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalIco}>🚀</Text>
            <Text style={styles.modalTitle}>Desbloqueie o Fala, Dinheiro!</Text>
            <Text style={styles.modalSub}>
              {diasDecorridos >= LIMITE_DIAS
                ? `Seu período gratuito de ${LIMITE_DIAS} dias encerrou!`
                : `Você atingiu o limite de ${LIMITE_GRATIS} lançamentos gratuitos!`}
            </Text>
            <View style={styles.beneficios}>
              <Text style={styles.beneficioItem}>✅ Lançamentos ilimitados</Text>
              <Text style={styles.beneficioItem}>✅ Todos os recursos desbloqueados</Text>
              <Text style={styles.beneficioItem}>✅ Pagamento único — sem assinatura</Text>
              <Text style={styles.beneficioItem}>✅ Suporte prioritário</Text>
            </View>
            <View style={styles.precoBox}>
              <Text style={styles.precoLabel}>Acesso vitalício por apenas</Text>
              <Text style={styles.preco}>R$ 14,90</Text>
              <Text style={styles.precoSub}>pagamento único</Text>
            </View>
            <TouchableOpacity style={styles.btnComprar} onPress={() => {
              setModalPaywall(false);
              router.push('/paywall' as any);
            }}>
              <Text style={styles.btnComprarTxt}>Desbloquear agora — R$ 14,90</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnFechar} onPress={() => setModalPaywall(false)}>
              <Text style={styles.btnFecharTxt}>Agora não</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <HelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        title="Como ver seus lançamentos"
        tips={[
          'Lançamentos são listados do mais recente ao mais antigo.',
          'Use o filtro de mês (setas ‹ ›) para navegar entre os períodos.',
          'Toque em um lançamento para editar.',
          'Pressione e segure para excluir (pede confirmação).',
          'Lançamentos em atraso aparecem em destaque no topo.',
          'Use o campo de busca para encontrar por descrição ou categoria.',
          'O botão + abre o formulário de novo lançamento.',
          'O botão "Todos" exibe lançamentos de todos os meses. Toque nele para ativar ou desativar. Quando ativo, as setas de mês ficam desabilitadas.',
        ]}
      />
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 22, paddingTop: 50, paddingBottom: 8 },
    headerTitle: { fontSize: 22, fontWeight: '700', color: c.text },
    headerSub: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    contadorBadge: { backgroundColor: 'rgba(82,148,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(82,148,255,0.3)' },
    contadorBadgeRed: { backgroundColor: 'rgba(242,85,85,0.15)', borderColor: 'rgba(242,85,85,0.3)' },
    contadorTxt: { fontSize: 11, color: '#5294ff', fontWeight: '600' },
    contadorTxtRed: { color: '#f25555' },
    progressBox: { paddingHorizontal: 22, paddingBottom: 12 },
    progressTrack: { height: 4, backgroundColor: c.barTrack2, borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
    progressFill: { height: 4, borderRadius: 4 },
    progressTxt: { fontSize: 10, color: c.textMuted },
    mesNavBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
    mesNavBtn: { padding: 6 },
    mesNavArrow: { fontSize: 16, color: '#5294ff', fontWeight: '700' },
    mesNavTxt: { fontSize: 14, fontWeight: '600', color: c.text, minWidth: 148, textAlign: 'center' },
    todosBtnNav: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: c.input, borderWidth: 1, borderColor: c.border, marginLeft: 4 },
    todosBtnNavOn: { backgroundColor: 'rgba(82,148,255,0.18)', borderColor: '#5294ff' },
    todosBtnNavTxt: { fontSize: 12, color: c.textMuted, fontWeight: '600' },
    todosBtnNavTxtOn: { color: '#5294ff' },
    searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, backgroundColor: c.input, borderRadius: 22, padding: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: c.border },
    searchIcon: { fontSize: 14, marginRight: 8 },
    searchInput: { flex: 1, color: c.text, fontSize: 13.5 },
    empty: { alignItems: 'center', padding: 48 },
    emptyIco: { fontSize: 48, marginBottom: 12 },
    emptyTxt: { fontSize: 15, color: c.textSec, fontWeight: '600' },
    emptySub: { fontSize: 13, color: c.textMuted, marginTop: 4 },
    txRow: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: c.borderLight },
    txIco: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.input, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    txInfo: { flex: 1 },
    txName: { fontSize: 13.5, fontWeight: '500', color: c.text },
    txMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
    txTag: { fontSize: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontWeight: '600' },
    txSub: { fontSize: 11, color: c.textMuted },
    txRight: { alignItems: 'flex-end' },
    txAmt: { fontSize: 14, fontWeight: '700', color: c.text },
    txDate: { fontSize: 11, color: c.textMuted, marginTop: 2 },
    hint: { textAlign: 'center', fontSize: 11, color: c.textMuted, padding: 16 },
    sectionHeader: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: c.bg },
    sectionHeaderTxt: { fontSize: 11, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
    txRowAtrasado: { backgroundColor: 'rgba(242,85,85,0.06)', borderLeftWidth: 3, borderLeftColor: '#f25555' },
    txIcoAtrasado: { backgroundColor: 'rgba(242,85,85,0.15)' },
    txTagAtrasado: { fontSize: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontWeight: '700', color: '#f25555', backgroundColor: 'rgba(242,85,85,0.15)' },
    fab: { position: 'absolute', bottom: 24, right: 20, width: 58, height: 58, borderRadius: 29, backgroundColor: '#5294ff', alignItems: 'center', justifyContent: 'center', elevation: 10, zIndex: 999 },
    fabLocked: { backgroundColor: '#f25555' },
    fabText: { fontSize: 30, color: '#fff', lineHeight: 34 },
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
    modalBox: { backgroundColor: c.card, borderRadius: 24, padding: 28, paddingBottom: 48, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    modalIco: { fontSize: 48, marginBottom: 12 },
    modalTitle: { fontSize: 22, fontWeight: '700', color: c.text, marginBottom: 8, textAlign: 'center' },
    modalSub: { fontSize: 14, color: c.textSec, marginBottom: 20, textAlign: 'center' },
    beneficios: { alignSelf: 'stretch', marginBottom: 20 },
    beneficioItem: { fontSize: 14, color: c.text, paddingVertical: 4 },
    precoBox: { alignItems: 'center', marginBottom: 24, backgroundColor: 'rgba(82,148,255,0.1)', borderRadius: 16, padding: 16, alignSelf: 'stretch', borderWidth: 1, borderColor: 'rgba(82,148,255,0.3)' },
    precoLabel: { fontSize: 12, color: c.textSec, marginBottom: 4 },
    preco: { fontSize: 36, fontWeight: '700', color: '#5294ff' },
    precoSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    btnComprar: { backgroundColor: '#5294ff', borderRadius: 14, padding: 16, alignSelf: 'stretch', alignItems: 'center', marginBottom: 12 },
    btnComprarTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
    btnFechar: { padding: 12 },
    btnFecharTxt: { color: c.textMuted, fontSize: 14 },
  });
}
