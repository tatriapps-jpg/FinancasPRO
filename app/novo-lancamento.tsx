import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { carregarCategorias } from './categorias';
import { buscarContas, creditarConta, debitarConta } from './contas';
import { buscarCartoes, buscarLancamentos, gerarId, inserirLancamento, inserirLancamentosParcelados } from './database';
import { agendarNotificacoesVencimento, verificarAlertaOrcamento, resetarLembreteMotivacional } from './notificacoes';
import HelpModal, { helpBtnStyle, helpTxtStyle } from './HelpModal';
import { Colors, useTheme } from './theme';

const DESBLOQUEADO_KEY       = '@faladinheiro:desbloqueado';
const PRIMEIRO_LANCAMENTO_KEY = '@faladinheiro:primeiroLancamento';
const LIMITE_GRATIS          = 150;
const LIMITE_DIAS            = 30;

const FORMAS_PAG = ['Pix','Crédito','Débito','Dinheiro','Boleto','Transferência','Depósito','Outro'];
const FORMAS_PAG_RECEITA = ['Pix','Transferência','Depósito','Dinheiro','Crédito'];
const PARCELAS_OPTS = ['1','2','3','4','5','6','7','8','9','10','11','12','15','18','24'];
const PARCELAS_BOLETO_OPTS = ['1','2','3','4','5','6','7','8','9','10','11','12'];

type Cartao = { id: string; apelido: string; bandeira: string; ultimos4: string; fechamento: string; vencimento: string; limite: string; };
type Conta = { id: string; nome: string; banco: string; tipo: string; saldo: string; };

function Dropdown({
  label, value, placeholder, opcoes, onSelect, renderItem, colors, onNovaCat,
}: {
  label: string;
  value: string;
  placeholder: string;
  opcoes: string[];
  onSelect: (v: string) => void;
  renderItem?: (v: string) => string;
  colors: Colors;
  onNovaCat?: () => void;
}) {
  const [helpVisible, setHelpVisible] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const filtradas = opcoes.filter(o =>
    o.toLowerCase().includes(busca.toLowerCase())
  );

  const dd = StyleSheet.create({
    btn: { backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 11, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    btnTxt: { fontSize: 14, color: colors.text, fontWeight: '500', flex: 1 },
    arrow: { fontSize: 14, color: colors.textMuted, marginLeft: 8 },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
    modal: { backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, maxHeight: '70%' as any },
    modalTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 },
    search: { backgroundColor: colors.input, borderRadius: 10, padding: 10, color: colors.text, fontSize: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
    item: { paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    itemOn: { backgroundColor: 'rgba(82,148,255,0.12)' },
    itemTxt: { fontSize: 14, color: colors.text },
    itemTxtOn: { color: '#5294ff', fontWeight: '600' },
    check: { fontSize: 14, color: '#5294ff' },
    novaCatBtn: { marginTop: 8, paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.borderLight },
    novaCatTxt: { fontSize: 14, color: '#5294ff', fontWeight: '600' },
  });

  return (
    <View style={{ marginBottom: 4 }}>
      <TouchableOpacity style={dd.btn} onPress={() => { setAberto(true); setBusca(''); }}>
        <Text style={[dd.btnTxt, !value && { color: colors.textMuted }]}>
          {renderItem ? (renderItem(value) || placeholder) : (value || placeholder)}
        </Text>
        <Text style={dd.arrow}>▾</Text>
      </TouchableOpacity>

      <Modal visible={aberto} transparent animationType="fade">
        <TouchableOpacity style={dd.overlay} activeOpacity={1} onPress={() => setAberto(false)}>
          <View style={dd.modal}>
            <Text style={dd.modalTitle}>{label}</Text>
            {opcoes.length > 5 && (
              <TextInput
                style={dd.search}
                placeholder="Buscar..."
                placeholderTextColor={colors.textMuted}
                value={busca}
                onChangeText={setBusca}
                autoFocus
              />
            )}
            <FlatList
              data={filtradas}
              keyExtractor={item => item}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[dd.item, value === item && dd.itemOn]}
                  onPress={() => { onSelect(item); setAberto(false); setBusca(''); }}
                >
                  <Text style={[dd.itemTxt, value === item && dd.itemTxtOn]}>
                    {renderItem ? renderItem(item) : item}
                  </Text>
                  {value === item && <Text style={dd.check}>✓</Text>}
                </TouchableOpacity>
              )}
            />
            {onNovaCat && (
              <TouchableOpacity
                style={dd.novaCatBtn}
                onPress={() => { setAberto(false); setBusca(''); onNovaCat(); }}
              >
                <Text style={dd.novaCatTxt}>＋ Nova categoria</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default function NovoLancamentoScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const params = useLocalSearchParams();

  const [tipo, setTipo] = useState<'despesa'|'receita'>('despesa');
  const [descricao, setDescricao] = useState('');
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('');
  const [formaPag, setFormaPag] = useState('');
  const [cartaoSel, setCartaoSel] = useState<Cartao | null>(null);
  const [parcelas, setParcelas] = useState('1');
  const [data, setData] = useState(hoje());
  const [dataVencBoleto, setDataVencBoleto] = useState(hoje());
  const [dataVencBoletoObj, setDataVencBoletoObj] = useState(new Date());
  const [mostrarCalendarioBoleto, setMostrarCalendarioBoleto] = useState(false);
  const [parcelasBoleto, setParcelasBoleto] = useState('1');
  const [status, setStatus] = useState('pago');
  const [obs, setObs] = useState('');
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [contaSel, setContaSel] = useState<Conta | null>(null);
  const [previewDatas, setPreviewDatas] = useState<string[]>([]);
  const [categoriasDesp, setCategoriasDesp] = useState<string[]>([]);
  const [categoriasRec, setCategoriasRec] = useState<string[]>([]);
  const [historicoDesp, setHistoricoDesp] = useState<string[]>([]);
  const [historicoRec, setHistoricoRec]   = useState<string[]>([]);
  const [helpVisible, setHelpVisible]     = useState(false);

  useEffect(() => {
    loadDados();
    if (params.descricao) setDescricao(params.descricao as string);
    if (params.valor) setValor(params.valor as string);
    if (params.tipo === 'receita') setTipo('receita');
    if (params.formaPag) {
      const fp = params.formaPag as string;
      const mapa: Record<string, string> = {
        'Credito': 'Crédito', 'Debito': 'Débito',
        'Pix': 'Pix', 'Dinheiro': 'Dinheiro',
        'Boleto': 'Boleto', 'Outro': 'Outro',
      };
      setFormaPag(mapa[fp] || fp);
    }
    if (params.parcelas) setParcelas(params.parcelas as string);
    if (params.categoria) setCategoria(params.categoria as string);
  }, []);

  useEffect(() => {
    if (cartaoSel && parcelas) calcularPreview();
  }, [cartaoSel, parcelas, data]);



  useEffect(() => {
    if (parseInt(parcelas) > 1) setStatus('parcelado');
    else if (formaPag !== 'Boleto') setStatus('pago');
  }, [parcelas]);

  useEffect(() => {
    if (formaPag === 'Boleto') {
      const n = parseInt(parcelasBoleto) || 1;
      if (n > 1) setStatus('parcelado');
      else setStatus('pendente');
    }
    if (!['Débito', 'Pix', 'Transferência', 'Depósito'].includes(formaPag)) setContaSel(null);
    if (formaPag !== 'Crédito') { setCartaoSel(null); setParcelas('1'); }
  }, [parcelasBoleto, formaPag]);

  useEffect(() => {
    if (descricao.length >= 2) {
      const historico = tipo === 'despesa' ? historicoDesp : historicoRec;
      const filtradas = historico
        .filter(d => d.toLowerCase().includes(descricao.toLowerCase()) && d !== descricao)
        .slice(0, 5);
      setSugestoes(filtradas);
      setMostrarSugestoes(filtradas.length > 0);
    } else {
      setMostrarSugestoes(false);
    }
  }, [descricao, tipo]);

  function hoje() {
    const d = new Date();
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
  }

  function dateToStr(d: Date) {
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
  }

  function addMes(dataStr: string, meses: number): string {
    const [dia, mes, ano] = dataStr.split('/').map(Number);
    let novoMes = mes - 1 + meses;
    let novoAno = ano;
    while (novoMes > 11) { novoMes -= 12; novoAno++; }
    const ultimoDia = new Date(novoAno, novoMes + 1, 0).getDate();
    const diaFinal = Math.min(dia, ultimoDia);
    return `${String(diaFinal).padStart(2,'0')}/${String(novoMes+1).padStart(2,'0')}/${novoAno}`;
  }

  async function loadDados() {
    setCartoes(buscarCartoes());
    const desp = await carregarCategorias('despesa');
    const rec = await carregarCategorias('receita');
    setCategoriasDesp(desp.sort((a, b) => a.localeCompare(b)));
    setCategoriasRec(rec.sort((a, b) => a.localeCompare(b)));
    const contasCarregadas = await buscarContas();
    setContas(contasCarregadas);
    const todos = buscarLancamentos();
    const unicas = (t: string) =>
      [...new Set(todos.filter((l: any) => l.tipo === t).map((l: any) => l.descricao as string))]
        .filter(d => !d.includes('('))
        .sort((a, b) => a.localeCompare(b));
    setHistoricoDesp(unicas('despesa'));
    setHistoricoRec(unicas('receita'));
  }

  function onDataCalendarioBoleto(event: any, selectedDate?: Date) {
    setMostrarCalendarioBoleto(false);
    if (selectedDate) {
      setDataVencBoletoObj(selectedDate);
      setDataVencBoleto(dateToStr(selectedDate));
    }
  }

  function calcularPreview() {
    if (!cartaoSel) return;
    const n = parseInt(parcelas) || 1;
    const [dia, mes, ano] = data.split('/').map(Number);
    const dataCompra = new Date(ano, mes - 1, dia);
    const datas: string[] = [];
    for (let i = 0; i < n; i++) {
      const diaFech = parseInt(cartaoSel.fechamento) || 10;
      const diaVenc = parseInt(cartaoSel.vencimento) || 20;
      let mesBase = dataCompra.getMonth();
      let anoBase = dataCompra.getFullYear();
      if (dataCompra.getDate() > diaFech) mesBase += 1;
      mesBase += i;
      while (mesBase > 11) { mesBase -= 12; anoBase += 1; }
      datas.push(`${String(diaVenc).padStart(2,'0')}/${String(mesBase+1).padStart(2,'0')}/${anoBase}`);
    }
    setPreviewDatas(datas);
  }

  async function salvar() {
    // ── Verificação de limite do plano gratuito ─────────────────────────────
    const [statusDesbloqueado, primLancStr] = await Promise.all([
      AsyncStorage.getItem(DESBLOQUEADO_KEY),
      AsyncStorage.getItem(PRIMEIRO_LANCAMENTO_KEY),
    ]);

    if (statusDesbloqueado !== 'true') {
      const total = buscarLancamentos().length;
      const primTs = primLancStr ? parseInt(primLancStr, 10) : null;
      const diasDecorridos = primTs ? Math.floor((Date.now() - primTs) / 86400000) : 0;

      if (total >= LIMITE_GRATIS || diasDecorridos >= LIMITE_DIAS) {
        const motivo = diasDecorridos >= LIMITE_DIAS
          ? `Seu período gratuito de ${LIMITE_DIAS} dias encerrou.`
          : `Você já registrou ${LIMITE_GRATIS} lançamentos no plano gratuito.`;
        Alert.alert(
          '🔒 Limite atingido',
          `${motivo} Desbloqueie o Premium para continuar sem limites.`,
          [
            { text: 'Agora não', style: 'cancel' },
            { text: 'Ver Premium', onPress: () => router.push('/paywall' as any) },
          ],
        );
        return;
      }
    }
    // ── Fim da verificação ───────────────────────────────────────────────────

    if (!descricao.trim()) { Alert.alert('Atenção', 'Digite uma descrição.'); return; }
    if (!valor.trim()) { Alert.alert('Atenção', 'Digite o valor.'); return; }
    if (!categoria) { Alert.alert('Atenção', 'Selecione uma categoria.'); return; }
    if (tipo === 'despesa' && !formaPag) { Alert.alert('Atenção', 'Selecione a forma de pagamento.'); return; }
    if (tipo === 'despesa' && formaPag === 'Crédito' && !cartaoSel) {
      Alert.alert('Atenção', 'Selecione um cartão para pagamento no Crédito.'); return;
    }

    const valorNum = parseFloat(valor.replace(',','.'));
    if (isNaN(valorNum) || valorNum <= 0) { Alert.alert('Atenção', 'Digite um valor válido.'); return; }

    // Registra data do primeiro lançamento (para o limite de 30 dias)
    const primExistente = await AsyncStorage.getItem(PRIMEIRO_LANCAMENTO_KEY);
    if (!primExistente) await AsyncStorage.setItem(PRIMEIRO_LANCAMENTO_KEY, String(Date.now()));
    const totalParcelas = parseInt(parcelas) || 1;
    const totalParcelasBoleto = parseInt(parcelasBoleto) || 1;
    const formaPagDB = formaPag === 'Crédito' ? 'Credito' : formaPag === 'Débito' ? 'Debito' : formaPag;

    if (formaPag === 'Crédito' && cartaoSel) {
      inserirLancamentosParcelados({
        descricao, valorTotal: valorNum, categoria, formaPag: formaPagDB,
        cartaoId: cartaoSel.id, contaId: contaSel?.id || '',
        totalParcelas, dataCompra: data,
        diaVencimento: parseInt(cartaoSel.vencimento) || 20,
        diaFechamento: parseInt(cartaoSel.fechamento) || 10,
        status, obs, tipo,
      });
    } else if (formaPag === 'Boleto' && totalParcelasBoleto > 1) {
      const grupoId = gerarId();
      const nB = totalParcelasBoleto;
      const ctB = Math.round(valorNum * 100);
      const cbBase = Math.floor(ctB / nB);
      const cbPrimeira = ctB - cbBase * (nB - 1);
      for (let i = 0; i < nB; i++) {
        const valorParcela = i === 0 ? cbPrimeira / 100 : cbBase / 100;
        inserirLancamento({
          id: `${grupoId}_${i+1}`, tipo,
          descricao: `${descricao} (${i+1}/${nB})`,
          valor: valorParcela, categoria, formaPag: formaPagDB,
          cartaoId: '', contaId: contaSel?.id || '',
          parcelas: nB,
          parcelaAtual: i + 1, totalParcelas: nB,
          data, dataVencimento: addMes(dataVencBoleto, i),
          status: 'parcelado', obs, grupoId,
        });
      }
    } else {
      inserirLancamento({
        id: gerarId(), tipo, descricao, valor: valorNum,
        categoria, formaPag: formaPagDB, cartaoId: cartaoSel?.id || '',
        contaId: contaSel?.id || '',
        parcelas: totalParcelas, parcelaAtual: 1, totalParcelas,
        data, dataVencimento: formaPag === 'Boleto' ? dataVencBoleto : data,
        status: formaPag === 'Boleto' ? 'pendente' : status, obs, grupoId: '',
      });
    }

    if (tipo === 'despesa' && formaPag === 'Dinheiro') {
      await debitarConta('especie_fixa', valorNum);
    } else if (contaSel && (formaPag === 'Débito' || formaPag === 'Debito' || formaPag === 'Pix') && tipo === 'despesa') {
      await debitarConta(contaSel.id, valorNum);
    }
    if (contaSel && tipo === 'receita') {
      await creditarConta(contaSel.id, valorNum);
    }
    if (tipo === 'receita' && formaPag === 'Dinheiro') {
      await creditarConta('especie_fixa', valorNum);
    }

    await agendarNotificacoesVencimento();
    verificarAlertaOrcamento().catch(() => {});
    resetarLembreteMotivacional().catch(() => {});
    Alert.alert('✅ Lançamento salvo!', 'O lançamento foi registrado com sucesso.');
    router.back();
  }

  const mostraSelecaoConta = tipo === 'despesa' && (formaPag === 'Débito' || formaPag === 'Pix') && contas.length > 0;
  const mostraSelecaoContaReceita = tipo === 'receita' && ['Pix', 'Transferência', 'Depósito'].includes(formaPag) && contas.length > 0;
  const cartaoOpts = cartoes.map(c => c.id);
  const cartaoLabel = (id: string) => { const c = cartoes.find(x => x.id === id); return c ? (c.apelido || `${c.bandeira} ****${c.ultimos4}`) : id; };
  const contaOpts = ['Nenhuma', ...contas.map(c => c.id)];
  const contaLabel = (id: string) => { if (id === 'Nenhuma') return 'Nenhuma conta'; const c = contas.find(x => x.id === id); return c ? `${c.nome} · ${c.banco}` : id; };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Novo Lançamento</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={() => router.push('/voz')} style={styles.cameraBtn}>
            <Text style={{ fontSize: 26 }}>🎤</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setHelpVisible(true)} style={helpBtnStyle}>
            <Text style={helpTxtStyle}>?</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tipo==='despesa' && styles.tabOn]} onPress={() => setTipo('despesa')}>
          <Text style={[styles.tabTxt, tipo==='despesa' && styles.tabTxtOn]}>Despesa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tipo==='receita' && styles.tabOn]} onPress={() => {
          setTipo('receita');
          setFormaPag('');
          setContaSel(null);
          setCartaoSel(null);
          setParcelas('1');
          setParcelasBoleto('1');
          setStatus('pago');
        }}>
          <Text style={[styles.tabTxt, tipo==='receita' && styles.tabTxtOn]}>Receita</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">

        <Text style={styles.lbl}>Descrição *</Text>
        <TextInput
          style={styles.input}
          placeholder={tipo === 'receita' ? 'Ex: Empresa X, Apartamento, Venda de Carro...' : 'Ex: Supermercado, Farmácia, Eletricista...'}
          placeholderTextColor={colors.textMuted}
          value={descricao}
          onChangeText={setDescricao}
        />
        {mostrarSugestoes && (
          <View style={styles.sugestoes}>
            {sugestoes.map((s, i) => (
              <TouchableOpacity key={i} style={styles.sugestaoItem} onPress={() => { setDescricao(s); setMostrarSugestoes(false); }}>
                <Text style={styles.sugestaoIco}>🕐</Text>
                <Text style={styles.sugestaoTxt}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.lbl}>Valor R$ *</Text>
        <TextInput
          style={styles.input} placeholder="0,00" placeholderTextColor={colors.textMuted}
          keyboardType="numeric" value={valor} onChangeText={setValor}
        />

        <Text style={styles.lbl}>Categoria *</Text>
        <Dropdown
          label="Selecione a categoria"
          value={categoria}
          placeholder="Toque para selecionar..."
          opcoes={tipo === 'despesa' ? categoriasDesp : categoriasRec}
          onSelect={setCategoria}
          colors={colors}
          onNovaCat={() => router.push('/categorias' as any)}
        />

        {tipo === 'despesa' && <>
          <Text style={styles.lbl}>Forma de pagamento *</Text>
          <Dropdown
            label="Forma de pagamento"
            value={formaPag}
            placeholder="Toque para selecionar..."
            opcoes={FORMAS_PAG}
            onSelect={(f) => {
              setFormaPag(f);
              if (f !== 'Crédito') { setCartaoSel(null); setParcelas('1'); }
              if (f !== 'Boleto') setParcelasBoleto('1');
              if (f !== 'Débito' && f !== 'Pix') setContaSel(null);
            }}
            colors={colors}
          />

          {mostraSelecaoConta && <>
            <Text style={styles.lbl}>Débitar da conta (opcional)</Text>
            <Dropdown
              label="Selecione a conta"
              value={contaSel?.id || 'Nenhuma'}
              placeholder="Nenhuma conta"
              opcoes={contaOpts}
              onSelect={(id) => { if (id === 'Nenhuma') setContaSel(null); else setContaSel(contas.find(c => c.id === id) || null); }}
              renderItem={contaLabel}
              colors={colors}
            />
            {contaSel && (
              <View style={styles.contaInfo}>
                <Text style={styles.contaInfoTxt}>💳 Débito em: {contaSel.nome} · {contaSel.banco}</Text>
              </View>
            )}
          </>}

          {formaPag === 'Boleto' && <>
            <Text style={styles.lbl}>Data de vencimento do boleto</Text>
            <TouchableOpacity style={styles.dataBtn} onPress={() => setMostrarCalendarioBoleto(true)}>
              <Text style={styles.dataBtnIco}>📅</Text>
              <Text style={styles.dataBtnTxt}>{dataVencBoleto}</Text>
            </TouchableOpacity>
            {mostrarCalendarioBoleto && (
              <DateTimePicker value={dataVencBoletoObj} mode="date" display="calendar" onChange={onDataCalendarioBoleto} locale="pt-BR" />
            )}
            <Text style={styles.lbl}>Parcelas do boleto</Text>
            <Dropdown
              label="Parcelas do boleto" value={parcelasBoleto} placeholder="Selecione..."
              opcoes={PARCELAS_BOLETO_OPTS} onSelect={setParcelasBoleto}
              renderItem={(p) => p === '1' ? 'Pagamento único' : `${p}x`}
              colors={colors}
            />
            {parseInt(parcelasBoleto) > 1 && valor && (
              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>Previsão de vencimentos do boleto</Text>
                {Array.from({ length: parseInt(parcelasBoleto) }).map((_, i) => (
                  <View key={i} style={styles.previewRow}>
                    <Text style={styles.previewParc}>{i+1}/{parcelasBoleto}</Text>
                    <Text style={styles.previewData}>{addMes(dataVencBoleto, i)}</Text>
                    <Text style={styles.previewVal}>R$ {(parseFloat(valor.replace(',','.')) / parseInt(parcelasBoleto)).toFixed(2).replace('.',',')}</Text>
                  </View>
                ))}
              </View>
            )}
          </>}

          {formaPag === 'Crédito' && <>
            <Text style={styles.lbl}>Cartão *</Text>
            {cartoes.length === 0 ? (
              <TouchableOpacity style={styles.alertaCartao} onPress={() => router.push('/cartoes' as any)}>
                <Text style={styles.alertaCartaoTxt}>⚠️ Nenhum cartão cadastrado. Toque para cadastrar.</Text>
              </TouchableOpacity>
            ) : (
              <Dropdown
                label="Selecione o cartão" value={cartaoSel?.id || ''} placeholder="Toque para selecionar..."
                opcoes={cartaoOpts} onSelect={(id) => setCartaoSel(cartoes.find(c => c.id === id) || null)}
                renderItem={cartaoLabel}
                colors={colors}
              />
            )}
            {cartaoSel && (
              <View style={styles.cartaoInfo}>
                <Text style={styles.cartaoInfoTxt}>Fecha dia {cartaoSel.fechamento} · Vence dia {cartaoSel.vencimento}</Text>
                {cartaoSel.limite ? <Text style={styles.cartaoInfoTxt}>Limite: R$ {cartaoSel.limite}</Text> : null}
              </View>
            )}
            <Text style={styles.lbl}>Parcelas</Text>
            <Dropdown
              label="Número de parcelas" value={parcelas} placeholder="Selecione..."
              opcoes={PARCELAS_OPTS} onSelect={setParcelas}
              renderItem={(p) => p === '1' ? 'Pagamento único' : `${p}x`}
              colors={colors}
            />
            {previewDatas.length > 1 && valor && (
              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>Previsão de vencimentos</Text>
                {previewDatas.map((d, i) => (
                  <View key={i} style={styles.previewRow}>
                    <Text style={styles.previewParc}>{i+1}/{previewDatas.length}</Text>
                    <Text style={styles.previewData}>{d}</Text>
                    <Text style={styles.previewVal}>R$ {(parseFloat(valor.replace(',','.')) / previewDatas.length).toFixed(2).replace('.',',')}</Text>
                  </View>
                ))}
              </View>
            )}
          </>}

          {formaPag !== 'Crédito' && formaPag !== 'Boleto' && formaPag !== '' && <>
            <Text style={styles.lbl}>Status</Text>
            <View style={styles.statusRow}>
              {[['pago','✅ Pago'],['pendente','⏳ Pendente']].map(([v,l]) => (
                <TouchableOpacity key={v} style={[styles.statusBtn, status===v && styles.statusBtnOn]} onPress={() => setStatus(v)}>
                  <Text style={[styles.statusTxt, status===v && styles.statusTxtOn]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>}
        </>}

        {tipo === 'receita' && <>
          <Text style={styles.lbl}>Forma de recebimento (opcional)</Text>
          <Dropdown
            label="Forma de recebimento"
            value={formaPag}
            placeholder="Toque para selecionar..."
            opcoes={FORMAS_PAG_RECEITA}
            onSelect={(f) => {
              setFormaPag(f);
              if (!['Pix', 'Transferência', 'Depósito'].includes(f)) setContaSel(null);
            }}
            colors={colors}
          />
          {mostraSelecaoContaReceita && <>
            <Text style={styles.lbl}>Creditado na conta (opcional)</Text>
            <Dropdown
              label="Selecione a conta"
              value={contaSel?.id || 'Nenhuma'}
              placeholder="Nenhuma conta"
              opcoes={contaOpts}
              onSelect={(id) => { if (id === 'Nenhuma') setContaSel(null); else setContaSel(contas.find(c => c.id === id) || null); }}
              renderItem={contaLabel}
              colors={colors}
            />
            {contaSel && (
              <View style={styles.contaInfo}>
                <Text style={styles.contaInfoTxt}>✅ Creditado em: {contaSel.nome} · {contaSel.banco}</Text>
              </View>
            )}
          </>}
        </>}

        <Text style={styles.lbl}>Data do lançamento</Text>
        <TextInput
          style={styles.input}
          placeholder="DD/MM/AAAA"
          placeholderTextColor={colors.textMuted}
          value={data}
          onChangeText={setData}
          keyboardType="numeric"
          maxLength={10}
        />

        <Text style={styles.lbl}>Observações</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          placeholder="Notas adicionais..." placeholderTextColor={colors.textMuted}
          multiline value={obs} onChangeText={setObs}
        />
        <View style={{ height: 20 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btnCancel} onPress={() => router.back()}>
          <Text style={styles.btnCancelTxt}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSave} onPress={salvar}>
          <Text style={styles.btnSaveTxt}>Salvar lançamento</Text>
        </TouchableOpacity>
      </View>
      <HelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        title="Como fazer um lançamento"
        tips={[
          { titulo: 'Tipo', texto: 'Escolha Despesa ou Receita nas abas no topo da tela.' },
          { titulo: 'Descrição e valor', texto: 'Preencha a descrição, o valor e selecione a categoria.' },
          { titulo: 'Crédito', texto: 'Para pagamento no Crédito, escolha o cartão e o número de parcelas.' },
          { titulo: 'Débito ou Pix', texto: 'Para Débito ou Pix, selecione a conta que será debitada.' },
          { titulo: 'Data', texto: 'A data de vencimento é opcional — útil para contas futuras.' },
          { titulo: 'Lançamento por voz', texto: 'Toque em 🎤 para registrar o lançamento por voz.' },
        ]}
      />
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex:1, backgroundColor:c.bg },
    header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, paddingTop:50, borderBottomWidth:1, borderBottomColor:c.borderSoft },
    backBtn: { padding:4 },
    backTxt: { fontSize:16, color:'#5294ff', fontWeight:'600' },
    headerTitle: { fontSize:17, fontWeight:'700', color:c.text },
    cameraBtn: { padding:4 },
    tabs: { flexDirection:'row', margin:16, backgroundColor:c.input, borderRadius:11, padding:4 },
    tab: { flex:1, padding:9, borderRadius:8, alignItems:'center' },
    tabOn: { backgroundColor:c.card, borderWidth:1, borderColor:c.border },
    tabTxt: { fontSize:13, fontWeight:'500', color:c.textMuted },
    tabTxtOn: { color:c.text },
    form: { flex:1, paddingHorizontal:16 },
    lbl: { fontSize:11.5, fontWeight:'500', color:c.textSec, marginBottom:6, marginTop:14 },
    input: { backgroundColor:c.input, borderWidth:1, borderColor:c.border, borderRadius:11, padding:12, color:c.text, fontSize:14 },
    sugestoes: { backgroundColor:c.card, borderRadius:11, borderWidth:1, borderColor:'rgba(82,148,255,0.3)', marginTop:4, overflow:'hidden' },
    sugestaoItem: { flexDirection:'row', alignItems:'center', padding:12, borderBottomWidth:1, borderBottomColor:c.borderLight, gap:10 },
    sugestaoIco: { fontSize:14 },
    sugestaoTxt: { fontSize:13, color:c.text },
    dataBtn: { flexDirection:'row', alignItems:'center', backgroundColor:c.input, borderWidth:1, borderColor:c.border, borderRadius:11, padding:12, gap:10 },
    dataBtnIco: { fontSize:18 },
    dataBtnTxt: { fontSize:14, color:c.text, fontWeight:'500' },
    contaInfo: { backgroundColor:'rgba(37,208,126,0.08)', borderRadius:11, padding:12, marginTop:6, borderWidth:1, borderColor:'rgba(37,208,126,0.25)' },
    contaInfoTxt: { fontSize:12, color:'#25d07e', fontWeight:'500' },
    cartaoInfo: { backgroundColor:c.input, borderRadius:11, padding:12, marginTop:6, marginBottom:4, borderWidth:1, borderColor:c.border },
    cartaoInfoTxt: { fontSize:12, color:c.textSec, marginBottom:2 },
    alertaCartao: { backgroundColor:'rgba(242,85,85,0.1)', borderRadius:11, padding:12, borderWidth:1, borderColor:'rgba(242,85,85,0.3)', marginBottom:8 },
    alertaCartaoTxt: { fontSize:13, color:'#f25555', fontWeight:'500' },
    statusRow: { flexDirection:'row', gap:10, marginBottom:4 },
    statusBtn: { flex:1, padding:11, backgroundColor:c.input, borderRadius:11, alignItems:'center', borderWidth:1, borderColor:c.border },
    statusBtnOn: { backgroundColor:'rgba(82,148,255,0.18)', borderColor:'#5294ff' },
    statusTxt: { fontSize:13, color:c.textSec, fontWeight:'500' },
    statusTxtOn: { color:'#7ab0ff' },
    previewCard: { backgroundColor:c.card, borderRadius:11, padding:14, marginTop:8, marginBottom:4, borderWidth:1, borderColor:'rgba(82,148,255,0.3)' },
    previewTitle: { fontSize:11, fontWeight:'700', color:'#5294ff', marginBottom:10, letterSpacing:0.5 },
    previewRow: { flexDirection:'row', justifyContent:'space-between', paddingVertical:6, borderBottomWidth:1, borderBottomColor:c.borderLight },
    previewParc: { fontSize:12, color:c.textMuted, width:30 },
    previewData: { fontSize:12, color:c.text, flex:1, textAlign:'center' },
    previewVal: { fontSize:12, color:'#25d07e', fontWeight:'600' },
    footer: { flexDirection:'row', gap:10, padding:16, paddingBottom:60, borderTopWidth:1, borderTopColor:c.borderSoft },
    btnCancel: { flex:1, padding:14, backgroundColor:c.input, borderRadius:11, alignItems:'center', borderWidth:1.5, borderColor:c.textSec },
    btnCancelTxt: { color:c.textSec, fontWeight:'600', fontSize:14 },
    btnSave: { flex:2, padding:14, backgroundColor:'#5294ff', borderRadius:11, alignItems:'center' },
    btnSaveTxt: { color:'#fff', fontWeight:'600', fontSize:14 },
  });
}
