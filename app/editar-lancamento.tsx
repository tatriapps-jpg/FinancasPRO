import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { atualizarLancamento } from './database';

const CATEGORIAS_DESP = ['Mercado','Farmacia','Combustivel','Moradia','Energia','Internet','Lazer','Saude','Educacao','Pets','Vestuario','Transporte','Alimentacao','Custos Financeiros','Outros'];
const CATEGORIAS_REC = ['Salario','Pro-labore','Freelance','Rendimentos','Reembolso','Outros'];

export default function EditarLancamentoScreen() {
  const params = useLocalSearchParams();

  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('');
  const [status, setStatus] = useState('pago');
  const [obs, setObs] = useState('');
  const [tipo, setTipo] = useState('despesa');
  const [dataPagamento, setDataPagamento] = useState('');

  function hoje() {
    const d = new Date();
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
  }

  useEffect(() => {
    if (params.descricao) setDescricao(params.descricao as string);
    if (params.valor) setValor(String(params.valor));
    if (params.categoria) setCategoria(params.categoria as string);
    if (params.status) setStatus(params.status as string);
    if (params.obs) setObs(params.obs as string);
    if (params.tipo) setTipo(params.tipo as string);
    if (params.dataPagamento) setDataPagamento(params.dataPagamento as string);
  }, []);

  // Quando mudar status para pago, preenche data de hoje automaticamente
  function handleStatus(novoStatus: string) {
    setStatus(novoStatus);
    if (novoStatus === 'pago' && !dataPagamento) {
      setDataPagamento(hoje());
    }
    if (novoStatus !== 'pago') {
      setDataPagamento('');
    }
  }

  function salvar() {
    if (!descricao.trim()) { alert('Digite uma descricao.'); return; }
    if (!valor.trim()) { alert('Digite o valor.'); return; }

    atualizarLancamento(
      params.id as string,
      descricao,
      parseFloat(valor.replace(',','.')),
      categoria,
      status,
      dataPagamento
    );
    alert('Lancamento atualizado!');
    router.back();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Lancamento</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={styles.form}>
        <Text style={styles.lbl}>Descricao *</Text>
        <TextInput style={styles.input} placeholderTextColor="#6b779a" value={descricao} onChangeText={setDescricao} />

        <Text style={styles.lbl}>Valor R$ *</Text>
        <TextInput style={styles.input} placeholderTextColor="#6b779a" keyboardType="numeric" value={valor} onChangeText={setValor} />

        <Text style={styles.lbl}>Categoria</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          <View style={styles.chipRow}>
            {(tipo === 'despesa' ? CATEGORIAS_DESP : CATEGORIAS_REC).map(c => (
              <TouchableOpacity key={c} style={[styles.chip, categoria===c && styles.chipOn]} onPress={() => setCategoria(c)}>
                <Text style={[styles.chipTxt, categoria===c && styles.chipTxtOn]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {tipo === 'despesa' && <>
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
                placeholderTextColor="#6b779a"
                value={dataPagamento}
                onChangeText={setDataPagamento}
                keyboardType="numeric"
                maxLength={10}
              />
              <Text style={styles.pagamentoHint}>Preenchido automaticamente com a data de hoje. Altere se necessário.</Text>
            </View>
          )}
        </>}

        <Text style={styles.lbl}>Observacoes</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          placeholderTextColor="#6b779a"
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
          <Text style={styles.btnSaveTxt}>Salvar alteracoes</Text>
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
  form: { flex:1, paddingHorizontal:16 },
  lbl: { fontSize:11.5, fontWeight:'500', color:'#aab4d0', marginBottom:6, marginTop:14 },
  input: { backgroundColor:'#2a3148', borderWidth:1, borderColor:'rgba(255,255,255,0.18)', borderRadius:11, padding:12, color:'#f0f3ff', fontSize:14 },
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
  pagamentoBox: { backgroundColor:'rgba(37,208,126,0.06)', borderRadius:11, padding:12, borderWidth:1, borderColor:'rgba(37,208,126,0.2)', marginTop:8 },
  pagamentoHint: { fontSize:11, color:'#6b779a', marginTop:4, fontStyle:'italic' },
  footer: { flexDirection:'row', gap:10, padding:16, paddingBottom:36, borderTopWidth:1, borderTopColor:'rgba(255,255,255,0.08)' },
  btnCancel: { flex:1, padding:14, backgroundColor:'#2a3148', borderRadius:11, alignItems:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  btnCancelTxt: { color:'#aab4d0', fontWeight:'600', fontSize:14 },
  btnSave: { flex:2, padding:14, backgroundColor:'#5294ff', borderRadius:11, alignItems:'center' },
  btnSaveTxt: { color:'#fff', fontWeight:'600', fontSize:14 },
});