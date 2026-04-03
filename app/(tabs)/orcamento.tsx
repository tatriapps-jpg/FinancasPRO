import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { buscarTotaisMes } from '../database';

const ORC_KEY = '@financaspro:orcamento';

export default function OrcamentoScreen() {
  const [orcamento, setOrcamento] = useState(5000);
  const [totais, setTotais] = useState({ totalGasto: 0, totalReceita: 0, saldo: 0 });
  const [modal, setModal] = useState(false);
  const [novoOrc, setNovoOrc] = useState('');
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const meses = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const hoje = new Date();
  const diasNoMes = new Date(anoAtual, mesAtual, 0).getDate();
  const diasRestantes = diasNoMes - hoje.getDate();

  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [])
  );

  async function carregarDados() {
    const saved = await AsyncStorage.getItem(ORC_KEY);
    if (saved) setOrcamento(parseFloat(saved));
    const t = buscarTotaisMes(mesAtual, anoAtual);
    setTotais(t);
  }

  async function salvarOrcamento() {
    const v = parseFloat(novoOrc.replace(',','.'));
    if (!v || v <= 0) { alert('Digite um valor valido.'); return; }
    await AsyncStorage.setItem(ORC_KEY, String(v));
    setOrcamento(v);
    setModal(false);
    setNovoOrc('');
  }

  const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const disponivel = orcamento - totais.totalGasto;
  const pct = Math.min(100, (totais.totalGasto / orcamento) * 100);
  const barCor = pct < 70 ? '#25d07e' : pct < 90 ? '#f7b731' : '#f25555';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orcamento</Text>
        <TouchableOpacity onPress={() => { setNovoOrc(String(orcamento)); setModal(true); }} style={styles.editBtn}>
          <Text style={styles.editBtnTxt}>✏️ Editar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>DISPONIVEL PARA GASTAR</Text>
          <Text style={[styles.heroValue, { color: disponivel >= 0 ? '#f7b731' : '#f25555' }]}>
            {fmt(disponivel)}
          </Text>
          <Text style={styles.heroSub}>de {fmt(orcamento)} planejados em {meses[mesAtual-1]}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: barCor }]} />
          </View>
          <Text style={[styles.barPct, { color: barCor }]}>{pct.toFixed(1)}% consumido</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.cell}>
            <Text style={styles.cellLbl}>Orcamento</Text>
            <Text style={[styles.cellVal, { color: '#f0f3ff' }]}>{fmt(orcamento)}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLbl}>Gasto</Text>
            <Text style={[styles.cellVal, { color: '#f25555' }]}>{fmt(totais.totalGasto)}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLbl}>Disponivel</Text>
            <Text style={[styles.cellVal, { color: '#f7b731' }]}>{fmt(disponivel)}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLbl}>Receita</Text>
            <Text style={[styles.cellVal, { color: '#25d07e' }]}>{fmt(totais.totalReceita)}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLbl}>Saldo real</Text>
            <Text style={[styles.cellVal, { color: '#5294ff' }]}>{fmt(totais.saldo)}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLbl}>Dias rest.</Text>
            <Text style={[styles.cellVal, { color: '#aab4d0' }]}>{diasRestantes}</Text>
          </View>
        </View>

        {pct >= 90 && (
          <View style={styles.alertDanger}>
            <Text style={styles.alertTxt}>⚠️ Atencao! Voce ja consumiu {pct.toFixed(0)}% do orcamento!</Text>
          </View>
        )}
        {pct >= 70 && pct < 90 && (
          <View style={styles.alertWarn}>
            <Text style={styles.alertTxt}>🔔 Voce ja consumiu {pct.toFixed(0)}% do orcamento. Fique atento!</Text>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      <Modal visible={modal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Definir Orcamento</Text>
            <Text style={styles.modalSub}>Quanto voce planeja gastar em {meses[mesAtual-1]}?</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: 5000"
              placeholderTextColor="#6b779a"
              keyboardType="numeric"
              value={novoOrc}
              onChangeText={setNovoOrc}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setModal(false)}>
                <Text style={styles.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={salvarOrcamento}>
                <Text style={styles.btnSaveTxt}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#12151e' },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:22, paddingTop:50 },
  headerTitle: { fontSize:22, fontWeight:'700', color:'#f0f3ff' },
  editBtn: { padding:8, backgroundColor:'#2a3148', borderRadius:11, borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  editBtnTxt: { fontSize:13, color:'#aab4d0', fontWeight:'500' },
  heroCard: { margin:16, backgroundColor:'#1c2133', borderRadius:16, padding:24, alignItems:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  heroLabel: { fontSize:10, fontWeight:'600', color:'#aab4d0', letterSpacing:1, marginBottom:8 },
  heroValue: { fontSize:40, fontWeight:'700', letterSpacing:-1 },
  heroSub: { fontSize:12, color:'#aab4d0', marginTop:6, marginBottom:16 },
  barTrack: { width:'100%', height:10, backgroundColor:'#344060', borderRadius:10, overflow:'hidden', marginBottom:6 },
  barFill: { height:10, borderRadius:10 },
  barPct: { fontSize:12, fontWeight:'700' },
  grid: { flexDirection:'row', flexWrap:'wrap', paddingHorizontal:16, gap:9, marginBottom:16 },
  cell: { width:'31%', backgroundColor:'#1c2133', borderRadius:11, padding:14, alignItems:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  cellLbl: { fontSize:10, color:'#aab4d0', textTransform:'uppercase', letterSpacing:0.7, marginBottom:6, fontWeight:'600' },
  cellVal: { fontSize:14, fontWeight:'700' },
  alertDanger: { marginHorizontal:16, marginBottom:8, padding:12, backgroundColor:'rgba(242,85,85,0.11)', borderRadius:11, borderWidth:1, borderColor:'rgba(242,85,85,0.3)' },
  alertWarn: { marginHorizontal:16, marginBottom:8, padding:12, backgroundColor:'rgba(247,183,49,0.11)', borderRadius:11, borderWidth:1, borderColor:'rgba(247,183,49,0.3)' },
  alertTxt: { fontSize:13, color:'#f0f3ff', lineHeight:20 },
  modalBg: { flex:1, backgroundColor:'rgba(0,0,0,0.75)', justifyContent:'center', padding:24 },
  modalBox: { backgroundColor:'#1c2133', borderRadius:20, padding:24, borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  modalTitle: { fontSize:18, fontWeight:'700', color:'#f0f3ff', marginBottom:6 },
  modalSub: { fontSize:13, color:'#6b779a', marginBottom:18 },
  modalInput: { backgroundColor:'#2a3148', borderWidth:1, borderColor:'rgba(255,255,255,0.18)', borderRadius:11, padding:14, color:'#f0f3ff', fontSize:18, fontWeight:'700', marginBottom:16 },
  modalBtns: { flexDirection:'row', gap:10 },
  btnCancel: { flex:1, padding:13, backgroundColor:'#2a3148', borderRadius:11, alignItems:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  btnCancelTxt: { color:'#aab4d0', fontWeight:'600', fontSize:14 },
  btnSave: { flex:1, padding:13, backgroundColor:'#5294ff', borderRadius:11, alignItems:'center' },
  btnSaveTxt: { color:'#fff', fontWeight:'600', fontSize:14 },
});