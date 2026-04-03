import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { carregarCategorias } from './categorias';
import { inserirLancamento, inserirLancamentosParcelados } from './database';

const CARTOES_KEY = '@financaspro:cartoes';
const FORMAS_PAG = ['Credito','Debito','Pix','Dinheiro','Boleto','Outro'];

type Cartao = { id: string; apelido: string; bandeira: string; ultimos4: string; fechamento: string; vencimento: string; limite: string; };

export default function NovoLancamentoScreen() {
  const params = useLocalSearchParams();

  const [tipo, setTipo] = useState<'despesa'|'receita'>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('');
  const [formaPag, setFormaPag] = useState('');
  const [cartaoSel, setCartaoSel] = useState<Cartao | null>(null);
  const [parcelas, setParcelas] = useState('1');
  const [data, setData] = useState(hoje());
  const [dataObj, setDataObj] = useState(new Date());
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [status, setStatus] = useState('pago');
  const [obs, setObs] = useState('');
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [previewDatas, setPreviewDatas] = useState<string[]>([]);
  const [categoriasDesp, setCategoriasDesp] = useState<string[]>([]);
  const [categoriasRec, setCategoriasRec] = useState<string[]>([]);

  useEffect(() => {
    loadDados();
    if (params.descricao) setDescricao(params.descricao as string);
    if (params.valor) setValor(params.valor as string);
    if (params.tipo === 'receita') setTipo('receita');
    if (params.formaPag) setFormaPag(params.formaPag as string);
    if (params.parcelas) setParcelas(params.parcelas as string);
    if (params.categoria) setCategoria(params.categoria as string);
  }, []);

  useEffect(() => {
    if (cartaoSel && parcelas) calcularPreview();
  }, [cartaoSel, parcelas, data]);

  useEffect(() => {
    if (parseInt(parcelas) > 1) setStatus('parcelado');
    else setStatus('pago');
  }, [parcelas]);

  function hoje() {
    const d = new Date();
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
  }

  function dateToStr(d: Date) {
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
  }

  async function loadDados() {
    const savedCartoes = await AsyncStorage.getItem(CARTOES_KEY);
    if (savedCartoes) setCartoes(JSON.parse(savedCartoes));
    const desp = await carregarCategorias('despesa');
    const rec = await carregarCategorias('receita');
    setCategoriasDesp(desp);
    setCategoriasRec(rec);
  }

  function onDataCalendario(event: any, selectedDate?: Date) {
    setMostrarCalendario(false);
    if (selectedDate) {
      const anoAtual = new Date().getFullYear();
      if (selectedDate.getFullYear() !== anoAtual) {
        Alert.alert(
          '⚠️ Ano diferente',
          `A data selecionada é de ${selectedDate.getFullYear()}. O ano atual é ${anoAtual}. Deseja continuar?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Continuar', onPress: () => { setDataObj(selectedDate); setData(dateToStr(selectedDate)); } },
          ]
        );
      } else {
        setDataObj(selectedDate);
        setData(dateToStr(selectedDate));
      }
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
    if (!descricao.trim()) { alert('Digite uma descricao.'); return; }
    if (!valor.trim()) { alert('Digite o valor.'); return; }
    if (!categoria) { alert('Selecione uma categoria.'); return; }
    if (tipo === 'despesa' && !formaPag) {
      alert('Selecione a forma de pagamento.'); return;
    }
    if (tipo === 'despesa' && formaPag === 'Credito' && !cartaoSel) {
      alert('Selecione um cartao para pagamento no Credito.'); return;
    }

    const valorNum = parseFloat(valor.replace(',','.'));
    const totalParcelas = parseInt(parcelas) || 1;

    if (formaPag === 'Credito' && cartaoSel && totalParcelas > 1) {
      inserirLancamentosParcelados({
        descricao, valorTotal: valorNum, categoria, formaPag,
        cartaoId: cartaoSel.id, totalParcelas, dataCompra: data,
        diaVencimento: parseInt(cartaoSel.vencimento) || 20,
        diaFechamento: parseInt(cartaoSel.fechamento) || 10,
        status, obs, tipo,
      });
    } else {
      inserirLancamento({
        id: Date.now().toString(), tipo, descricao, valor: valorNum,
        categoria, formaPag, cartaoId: cartaoSel?.id || '',
        parcelas: totalParcelas, parcelaAtual: 1, totalParcelas,
        data, dataVencimento: data, status, obs, grupoId: '',
      });
    }

    alert('Lancamento salvo!');
    router.back();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Novo Lancamento</Text>
        <View style={{ flexDirection:'row', gap:8 }}>
          <TouchableOpacity onPress={() => router.push('/voz')} style={styles.cameraBtn}>
            <Text style={{ fontSize: 22 }}>🎤</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/camera')} style={styles.cameraBtn}>
            <Text style={{ fontSize: 22 }}>📷</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/qrcode')} style={styles.cameraBtn}>
            <Text style={{ fontSize: 22 }}>📲</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tipo==='despesa' && styles.tabOn]} onPress={() => setTipo('despesa')}>
          <Text style={[styles.tabTxt, tipo==='despesa' && styles.tabTxtOn]}>Despesa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tipo==='receita' && styles.tabOn]} onPress={() => setTipo('receita')}>
          <Text style={[styles.tabTxt, tipo==='receita' && styles.tabTxtOn]}>Receita</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.form}>
        <Text style={styles.lbl}>Descricao *</Text>
        <TextInput style={styles.input} placeholder="Ex: Mercado, Salario..." placeholderTextColor="#6b779a" value={descricao} onChangeText={setDescricao} />

        <Text style={styles.lbl}>Valor R$ *</Text>
        <TextInput style={styles.input} placeholder="0,00" placeholderTextColor="#6b779a" keyboardType="numeric" value={valor} onChangeText={setValor} />

        <Text style={styles.lbl}>Data da compra</Text>
        <TouchableOpacity style={styles.dataBtn} onPress={() => setMostrarCalendario(true)}>
          <Text style={styles.dataBtnIco}>📅</Text>
          <Text style={styles.dataBtnTxt}>{data}</Text>
        </TouchableOpacity>

        {mostrarCalendario && (
          <DateTimePicker
            value={dataObj}
            mode="date"
            display="calendar"
            onChange={onDataCalendario}
            locale="pt-BR"
          />
        )}

        <Text style={styles.lbl}>Categoria *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          <View style={styles.chipRow}>
            {(tipo==='despesa' ? categoriasDesp : categoriasRec).map(c => (
              <TouchableOpacity key={c} style={[styles.chip, categoria===c && styles.chipOn]} onPress={() => setCategoria(c)}>
                <Text style={[styles.chipTxt, categoria===c && styles.chipTxtOn]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {tipo === 'despesa' && <>
          <Text style={styles.lbl}>Forma de pagamento *</Text>
          <View style={styles.payGrid}>
            {FORMAS_PAG.map(f => (
              <TouchableOpacity key={f} style={[styles.payBtn, formaPag===f && styles.payBtnOn]} onPress={() => { setFormaPag(f); if (f !== 'Credito') setCartaoSel(null); }}>
                <Text style={[styles.payTxt, formaPag===f && styles.payTxtOn]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {formaPag === 'Credito' && <>
            <Text style={styles.lbl}>Cartao * {cartoes.length === 0 ? '(Nenhum cadastrado)' : ''}</Text>
            {cartoes.length === 0 ? (
              <TouchableOpacity style={styles.alertaCartao} onPress={() => router.push('/cartoes' as any)}>
                <Text style={styles.alertaCartaoTxt}>⚠️ Nenhum cartão cadastrado. Toque para cadastrar.</Text>
              </TouchableOpacity>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <View style={styles.chipRow}>
                  {cartoes.map(c => (
                    <TouchableOpacity key={c.id} style={[styles.chip, cartaoSel?.id===c.id && styles.chipOn]} onPress={() => setCartaoSel(c)}>
                      <Text style={[styles.chipTxt, cartaoSel?.id===c.id && styles.chipTxtOn]}>{c.apelido || c.bandeira+' ****'+c.ultimos4}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}

            {cartaoSel && (
              <View style={styles.cartaoInfo}>
                <Text style={styles.cartaoInfoTxt}>Fecha dia {cartaoSel.fechamento} · Vence dia {cartaoSel.vencimento}</Text>
                {cartaoSel.limite ? <Text style={styles.cartaoInfoTxt}>Limite: R$ {cartaoSel.limite}</Text> : null}
              </View>
            )}

            <Text style={styles.lbl}>Parcelas</Text>
            <View style={styles.payGrid}>
              {['1','2','3','4','5','6','7','8','9','10','11','12','15','18','24'].map(p => (
                <TouchableOpacity key={p} style={[styles.payBtn, parcelas===p && styles.payBtnOn]} onPress={() => setParcelas(p)}>
                  <Text style={[styles.payTxt, parcelas===p && styles.payTxtOn]}>{p==='1'?'A vista':p+'x'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {previewDatas.length > 1 && valor && (
              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>Previsao de vencimentos</Text>
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

          {formaPag !== 'Credito' && formaPag !== '' && <>
            <Text style={styles.lbl}>Status</Text>
            <View style={styles.payGrid}>
              {[['pago','✅ Pago'],['pendente','⏳ Pendente']].map(([v,l]) => (
                <TouchableOpacity key={v} style={[styles.payBtn, status===v && styles.payBtnOn]} onPress={() => setStatus(v)}>
                  <Text style={[styles.payTxt, status===v && styles.payTxtOn]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>}
        </>}

        <Text style={styles.lbl}>Observacoes</Text>
        <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Notas adicionais..." placeholderTextColor="#6b779a" multiline value={obs} onChangeText={setObs} />

        <View style={{ height: 20 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btnCancel} onPress={() => router.back()}>
          <Text style={styles.btnCancelTxt}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSave} onPress={salvar}>
          <Text style={styles.btnSaveTxt}>Salvar lancamento</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#12151e' },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, paddingTop:50, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.08)' },
  backBtn: { padding:4 },
  backTxt: { fontSize:16, color:'#5294ff', fontWeight:'600' },
  headerTitle: { fontSize:17, fontWeight:'700', color:'#f0f3ff' },
  cameraBtn: { padding:4 },
  tabs: { flexDirection:'row', margin:16, backgroundColor:'#2a3148', borderRadius:11, padding:4 },
  tab: { flex:1, padding:9, borderRadius:8, alignItems:'center' },
  tabOn: { backgroundColor:'#1c2133', borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  tabTxt: { fontSize:13, fontWeight:'500', color:'#6b779a' },
  tabTxtOn: { color:'#f0f3ff' },
  form: { flex:1, paddingHorizontal:16 },
  lbl: { fontSize:11.5, fontWeight:'500', color:'#aab4d0', marginBottom:6, marginTop:14 },
  input: { backgroundColor:'#2a3148', borderWidth:1, borderColor:'rgba(255,255,255,0.18)', borderRadius:11, padding:12, color:'#f0f3ff', fontSize:14 },
  dataBtn: { flexDirection:'row', alignItems:'center', backgroundColor:'#2a3148', borderWidth:1, borderColor:'rgba(255,255,255,0.18)', borderRadius:11, padding:12, gap:10 },
  dataBtnIco: { fontSize:18 },
  dataBtnTxt: { fontSize:14, color:'#f0f3ff', fontWeight:'500' },
  chipScroll: { marginBottom:4 },
  chipRow: { flexDirection:'row', gap:8, paddingVertical:4 },
  chip: { paddingHorizontal:14, paddingVertical:8, backgroundColor:'#2a3148', borderRadius:16, borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  chipOn: { backgroundColor:'rgba(82,148,255,0.18)', borderColor:'#5294ff' },
  chipTxt: { fontSize:12.5, color:'#aab4d0', fontWeight:'500' },
  chipTxtOn: { color:'#7ab0ff' },
  payGrid: { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:4 },
  payBtn: { paddingHorizontal:14, paddingVertical:9, backgroundColor:'#2a3148', borderRadius:11, borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  payBtnOn: { backgroundColor:'rgba(82,148,255,0.18)', borderColor:'#5294ff' },
  payTxt: { fontSize:12.5, color:'#aab4d0', fontWeight:'500' },
  payTxtOn: { color:'#7ab0ff' },
  alertaCartao: { backgroundColor:'rgba(242,85,85,0.1)', borderRadius:11, padding:12, borderWidth:1, borderColor:'rgba(242,85,85,0.3)', marginBottom:8 },
  alertaCartaoTxt: { fontSize:13, color:'#f25555', fontWeight:'500' },
  cartaoInfo: { backgroundColor:'#2a3148', borderRadius:11, padding:12, marginBottom:8, borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  cartaoInfoTxt: { fontSize:12, color:'#aab4d0', marginBottom:2 },
  previewCard: { backgroundColor:'#1c2133', borderRadius:11, padding:14, marginTop:8, marginBottom:4, borderWidth:1, borderColor:'rgba(82,148,255,0.3)' },
  previewTitle: { fontSize:11, fontWeight:'700', color:'#5294ff', marginBottom:10, letterSpacing:0.5 },
  previewRow: { flexDirection:'row', justifyContent:'space-between', paddingVertical:6, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.06)' },
  previewParc: { fontSize:12, color:'#6b779a', width:30 },
  previewData: { fontSize:12, color:'#f0f3ff', flex:1, textAlign:'center' },
  previewVal: { fontSize:12, color:'#25d07e', fontWeight:'600' },
  footer: { flexDirection:'row', gap:10, padding:16, paddingBottom:36, borderTopWidth:1, borderTopColor:'rgba(255,255,255,0.08)' },
  btnCancel: { flex:1, padding:14, backgroundColor:'#2a3148', borderRadius:11, alignItems:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  btnCancelTxt: { color:'#aab4d0', fontWeight:'600', fontSize:14 },
  btnSave: { flex:2, padding:14, backgroundColor:'#5294ff', borderRadius:11, alignItems:'center' },
  btnSaveTxt: { color:'#fff', fontWeight:'600', fontSize:14 },
});