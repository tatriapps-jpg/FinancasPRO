import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { carregarCategorias } from './categorias';
import { atualizarGrupoLancamentos, atualizarLancamentoCompleto, buscarCartoes } from './database';
import { agendarNotificacoesVencimento } from './notificacoes';
import { Colors, useTheme } from './theme';

function Dropdown({
  label, value, placeholder, opcoes, onSelect, colors,
}: {
  label: string; value: string; placeholder: string;
  opcoes: string[]; onSelect: (v: string) => void; colors: Colors;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const filtradas = opcoes.filter(o => o.toLowerCase().includes(busca.toLowerCase()));

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
  });

  return (
    <View style={{ marginBottom: 4 }}>
      <TouchableOpacity style={dd.btn} onPress={() => { setAberto(true); setBusca(''); }}>
        <Text style={[dd.btnTxt, !value && { color: colors.textMuted }]}>{value || placeholder}</Text>
        <Text style={dd.arrow}>▾</Text>
      </TouchableOpacity>
      <Modal visible={aberto} transparent animationType="fade">
        <TouchableOpacity style={dd.overlay} activeOpacity={1} onPress={() => setAberto(false)}>
          <View style={dd.modal}>
            <Text style={dd.modalTitle}>{label}</Text>
            {opcoes.length > 5 && (
              <TextInput style={dd.search} placeholder="Buscar..." placeholderTextColor={colors.textMuted}
                value={busca} onChangeText={setBusca} autoFocus />
            )}
            <FlatList
              data={filtradas}
              keyExtractor={item => item}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={[dd.item, value === item && dd.itemOn]}
                  onPress={() => { onSelect(item); setAberto(false); setBusca(''); }}>
                  <Text style={[dd.itemTxt, value === item && dd.itemTxtOn]}>{item}</Text>
                  {value === item && <Text style={dd.check}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default function EditarLancamentoScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const params = useLocalSearchParams();

  const [descricao, setDescricao]           = useState('');
  const [valor, setValor]                   = useState('');
  const [categoria, setCategoria]           = useState('');
  const [status, setStatus]                 = useState('pago');
  const [obs, setObs]                       = useState('');
  const [tipo, setTipo]                     = useState('despesa');
  const [dataPagamento, setDataPagamento]   = useState('');
  const [data, setData]                     = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [cartaoId, setCartaoId]             = useState('');
  const [grupoId, setGrupoId]               = useState('');
  const [totalParcelas, setTotalParcelas]   = useState(1);
  const [aplicarAoGrupo, setAplicarAoGrupo] = useState(false);
  const [cartoes, setCartoes]               = useState<{ id: string; apelido: string }[]>([]);
  const [categoriasDesp, setCategoriasDesp] = useState<string[]>([]);
  const [categoriasRec, setCategoriasRec]   = useState<string[]>([]);

  function hoje() {
    const d = new Date();
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
  }

  useEffect(() => {
    setCartoes(buscarCartoes());
    carregarCategorias('despesa').then(c => setCategoriasDesp(c.sort((a, b) => a.localeCompare(b))));
    carregarCategorias('receita').then(c => setCategoriasRec(c.sort((a, b) => a.localeCompare(b))));
    if (params.descricao)    setDescricao(params.descricao as string);
    if (params.valor)        setValor(String(params.valor));
    if (params.categoria)    setCategoria(params.categoria as string);
    if (params.status)       setStatus(params.status as string);
    if (params.obs)          setObs(params.obs as string);
    if (params.tipo)         setTipo(params.tipo as string);
    if (params.dataPagamento) setDataPagamento(params.dataPagamento as string);
    if (params.data)         setData(params.data as string);
    if (params.dataVencimento) setDataVencimento(params.dataVencimento as string);
    if (params.cartaoId)     setCartaoId(params.cartaoId as string);
    if (params.grupoId)      setGrupoId(params.grupoId as string);
    if (params.totalParcelas) setTotalParcelas(parseInt(params.totalParcelas as string) || 1);
  }, []);

  function handleStatus(novoStatus: string) {
    setStatus(novoStatus);
    if (novoStatus === 'pago' && !dataPagamento) {
      setDataPagamento(hoje());
    }
    if (novoStatus !== 'pago') {
      setDataPagamento('');
    }
  }

  async function salvar() {
    if (!descricao.trim()) { Alert.alert('Atenção', 'Digite uma descrição.'); return; }
    if (!valor.trim()) { Alert.alert('Atenção', 'Digite o valor.'); return; }

    const valorNum = parseFloat(valor.replace(',', '.'));
    if (isNaN(valorNum) || valorNum <= 0) { Alert.alert('Atenção', 'Digite um valor válido.'); return; }

    atualizarLancamentoCompleto(params.id as string, {
      descricao,
      valor: valorNum,
      categoria,
      status,
      dataPagamento,
      obs,
      data,
      dataVencimento,
      cartaoId,
    });

    if (aplicarAoGrupo && grupoId && totalParcelas > 1) {
      atualizarGrupoLancamentos(grupoId, categoria, valorNum);
    }

    await agendarNotificacoesVencimento();
    Alert.alert('✅ Lançamento atualizado!', 'As alterações foram salvas com sucesso.');
    router.back();
  }

  const ehGrupo = !!grupoId && totalParcelas > 1;
  const cartaoAtual = cartoes.find(c => c.id === cartaoId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Lançamento</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">

        {/* Badge de tipo */}
        <View style={styles.tipoBadgeRow}>
          <View style={[styles.tipoBadge, tipo === 'receita' ? styles.tipoBadgeRec : styles.tipoBadgeDesp]}>
            <Text style={styles.tipoBadgeTxt}>
              {tipo === 'receita' ? '📈 Receita' : '📉 Despesa'}
            </Text>
          </View>
          {ehGrupo && (
            <View style={styles.parcelasBadge}>
              <Text style={styles.parcelasBadgeTxt}>💳 {totalParcelas} parcelas</Text>
            </View>
          )}
        </View>

        {/* Informações básicas */}
        <Text style={styles.sectionLbl}>INFORMAÇÕES</Text>

        <Text style={styles.lbl}>Descrição *</Text>
        <TextInput style={styles.input} placeholderTextColor={colors.textMuted} value={descricao} onChangeText={setDescricao} />

        <Text style={styles.lbl}>Valor R$ *</Text>
        <TextInput style={styles.input} placeholderTextColor={colors.textMuted} keyboardType="numeric" value={valor} onChangeText={setValor} />

        <Text style={styles.lbl}>Categoria</Text>
        <Dropdown
          label="Selecione a categoria"
          value={categoria}
          placeholder="Toque para selecionar..."
          opcoes={tipo === 'despesa' ? categoriasDesp : categoriasRec}
          onSelect={setCategoria}
          colors={colors}
        />

        {/* Status */}
        {tipo === 'despesa' && <>
          <Text style={styles.sectionLbl}>PAGAMENTO</Text>

          <Text style={styles.lbl}>Status</Text>
          <View style={styles.payGrid}>
            {[['pago','✅ Pago'],['pendente','⏳ Pendente'],['parcelado','💳 Parcelado']].map(([v,l]) => (
              <TouchableOpacity key={v} style={[styles.payBtn, status===v && styles.payBtnOn]} onPress={() => handleStatus(v)}>
                <Text style={[styles.payTxt, status===v && styles.payTxtOn]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {status === 'pago' && (
            <View style={styles.pagamentoBox}>
              <Text style={styles.lbl}>Data do pagamento</Text>
              <TextInput
                style={styles.input}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={colors.textMuted}
                value={dataPagamento}
                onChangeText={setDataPagamento}
                keyboardType="numeric"
                maxLength={10}
              />
              <Text style={styles.pagamentoHint}>Preenchido automaticamente com a data de hoje. Altere se necessário.</Text>
            </View>
          )}
        </>}

        {/* Datas */}
        <Text style={styles.sectionLbl}>DATAS</Text>

        <View style={styles.dateRow}>
          <View style={styles.dateCol}>
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
          </View>
          <View style={styles.dateCol}>
            <Text style={styles.lbl}>Data de vencimento</Text>
            <TextInput
              style={styles.input}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.textMuted}
              value={dataVencimento}
              onChangeText={setDataVencimento}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
        </View>

        {/* Cartão */}
        {cartoes.length > 0 && (
          <>
            <Text style={styles.sectionLbl}>CARTÃO</Text>
            <Text style={styles.lbl}>Cartão vinculado</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.cartaoChipRow}>
                <TouchableOpacity
                  style={[styles.cartaoChip, !cartaoId && styles.cartaoChipOn]}
                  onPress={() => setCartaoId('')}
                >
                  <Text style={[styles.cartaoChipTxt, !cartaoId && styles.cartaoChipTxtOn]}>Nenhum</Text>
                </TouchableOpacity>
                {cartoes.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.cartaoChip, cartaoId === c.id && styles.cartaoChipOn]}
                    onPress={() => setCartaoId(c.id)}
                  >
                    <Text style={[styles.cartaoChipTxt, cartaoId === c.id && styles.cartaoChipTxtOn]}>💳 {c.apelido}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </>
        )}

        {/* Parcelas */}
        {ehGrupo && (
          <>
            <Text style={styles.sectionLbl}>PARCELAS</Text>
            <View style={styles.grupoBox}>
              <View style={styles.grupoRow}>
                <View style={styles.grupoInfo}>
                  <Text style={styles.grupoTitle}>Aplicar a todas as parcelas</Text>
                  <Text style={styles.grupoSub}>Atualiza categoria e valor em todas as {totalParcelas} parcelas deste grupo</Text>
                </View>
                <Switch
                  value={aplicarAoGrupo}
                  onValueChange={setAplicarAoGrupo}
                  trackColor={{ false: colors.barTrack, true: 'rgba(82,148,255,0.4)' }}
                  thumbColor={aplicarAoGrupo ? '#5294ff' : colors.textMuted}
                />
              </View>
            </View>
          </>
        )}

        {/* Observações */}
        <Text style={styles.sectionLbl}>OBSERVAÇÕES</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          placeholder="Anotação opcional..."
          placeholderTextColor={colors.textMuted}
          multiline
          value={obs}
          onChangeText={setObs}
        />

        <View style={{ height: 20 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btnCancel} onPress={() => router.back()}>
          <Text style={styles.btnCancelTxt}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSave} onPress={salvar}>
          <Text style={styles.btnSaveTxt}>Salvar alterações</Text>
        </TouchableOpacity>
      </View>
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
    form: { flex:1, paddingHorizontal:16 },
    sectionLbl: { fontSize:10.5, fontWeight:'700', color:c.textMuted, letterSpacing:0.8, marginTop:22, marginBottom:4 },
    lbl: { fontSize:11.5, fontWeight:'500', color:c.textSec, marginBottom:6, marginTop:12 },
    input: { backgroundColor:c.input, borderWidth:1, borderColor:c.border, borderRadius:11, padding:12, color:c.text, fontSize:14 },
    tipoBadgeRow: { flexDirection:'row', gap:8, marginTop:16, marginBottom:4 },
    tipoBadge: { paddingHorizontal:14, paddingVertical:7, borderRadius:20, borderWidth:1 },
    tipoBadgeDesp: { backgroundColor:'rgba(242,85,85,0.1)', borderColor:'rgba(242,85,85,0.35)' },
    tipoBadgeRec: { backgroundColor:'rgba(37,208,126,0.1)', borderColor:'rgba(37,208,126,0.35)' },
    tipoBadgeTxt: { fontSize:12, fontWeight:'700', color:c.text },
    parcelasBadge: { paddingHorizontal:14, paddingVertical:7, borderRadius:20, backgroundColor:'rgba(82,148,255,0.1)', borderWidth:1, borderColor:'rgba(82,148,255,0.35)' },
    parcelasBadgeTxt: { fontSize:12, fontWeight:'700', color:'#5294ff' },
    dateRow: { flexDirection:'row', gap:10 },
    dateCol: { flex:1 },
    cartaoChipRow: { flexDirection:'row', gap:8, paddingVertical:4 },
    cartaoChip: { paddingHorizontal:14, paddingVertical:8, backgroundColor:c.input, borderRadius:16, borderWidth:1, borderColor:c.border },
    cartaoChipOn: { backgroundColor:'rgba(82,148,255,0.18)', borderColor:'#5294ff' },
    cartaoChipTxt: { fontSize:12.5, color:c.textSec, fontWeight:'500' },
    cartaoChipTxtOn: { color:'#5294ff' },
    grupoBox: { backgroundColor:'rgba(82,148,255,0.07)', borderRadius:11, padding:14, borderWidth:1, borderColor:'rgba(82,148,255,0.25)', marginTop:6 },
    grupoRow: { flexDirection:'row', alignItems:'center', gap:12 },
    grupoInfo: { flex:1 },
    grupoTitle: { fontSize:13, fontWeight:'600', color:c.text },
    grupoSub: { fontSize:11, color:c.textMuted, marginTop:2 },
    payGrid: { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:4 },
    payBtn: { paddingHorizontal:14, paddingVertical:9, backgroundColor:c.input, borderRadius:11, borderWidth:1, borderColor:c.border },
    payBtnOn: { backgroundColor:'rgba(82,148,255,0.18)', borderColor:'#5294ff' },
    payTxt: { fontSize:12.5, color:c.textSec, fontWeight:'500' },
    payTxtOn: { color:'#5294ff' },
    pagamentoBox: { backgroundColor:'rgba(37,208,126,0.06)', borderRadius:11, padding:12, borderWidth:1, borderColor:'rgba(37,208,126,0.2)', marginTop:8 },
    pagamentoHint: { fontSize:11, color:c.textMuted, marginTop:4, fontStyle:'italic' },
    footer: { flexDirection:'row', gap:10, padding:16, paddingBottom:36, borderTopWidth:1, borderTopColor:c.borderSoft },
    btnCancel: { flex:1, padding:14, backgroundColor:c.input, borderRadius:11, alignItems:'center', borderWidth:1, borderColor:c.border },
    btnCancelTxt: { color:c.textSec, fontWeight:'600', fontSize:14 },
    btnSave: { flex:2, padding:14, backgroundColor:'#5294ff', borderRadius:11, alignItems:'center' },
    btnSaveTxt: { color:'#fff', fontWeight:'600', fontSize:14 },
  });
}
