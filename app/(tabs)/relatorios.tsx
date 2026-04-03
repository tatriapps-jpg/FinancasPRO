import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { buscarLancamentosPorMes } from '../database';

export default function RelatoriosScreen() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [porCategoria, setPorCategoria] = useState<{ nome: string; valor: number; pct: number }[]>([]);
  const [comparativo, setComparativo] = useState<{ cat: string; anterior: number; atual: number }[]>([]);
  const [totais, setTotais] = useState({ gasto: 0, receita: 0, saldo: 0 });

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [mes, ano])
  );

  function mesAnterior() {
    if (mes === 1) return { m: 12, a: ano - 1 };
    return { m: mes - 1, a: ano };
  }

  function carregarDados() {
    const atual = buscarLancamentosPorMes(mes, ano);
    const despesasAtual = atual.filter(l => l.tipo === 'despesa');
    const receitasAtual = atual.filter(l => l.tipo === 'receita');

    const totalGasto = despesasAtual.reduce((s, l) => s + l.valor, 0);
    const totalReceita = receitasAtual.reduce((s, l) => s + l.valor, 0);
    setTotais({ gasto: totalGasto, receita: totalReceita, saldo: totalReceita - totalGasto });

    const porCat: Record<string, number> = {};
    despesasAtual.forEach(l => {
      porCat[l.categoria] = (porCat[l.categoria] || 0) + l.valor;
    });
    const cats = Object.entries(porCat)
      .sort((a, b) => b[1] - a[1])
      .map(([nome, valor]) => ({
        nome,
        valor,
        pct: totalGasto > 0 ? Math.round((valor / totalGasto) * 100) : 0,
      }));
    setPorCategoria(cats);

    const { m: mA, a: aA } = mesAnterior();
    const anterior = buscarLancamentosPorMes(mA, aA);
    const despesasAnt = anterior.filter(l => l.tipo === 'despesa');

    const porCatAnt: Record<string, number> = {};
    despesasAnt.forEach(l => {
      porCatAnt[l.categoria] = (porCatAnt[l.categoria] || 0) + l.valor;
    });

    const todasCats = new Set([...Object.keys(porCat), ...Object.keys(porCatAnt)]);
    const comp = Array.from(todasCats).map(cat => ({
      cat,
      anterior: porCatAnt[cat] || 0,
      atual: porCat[cat] || 0,
    })).sort((a, b) => b.atual - a.atual);
    setComparativo(comp);
  }

  function navMes(dir: number) {
    let novoMes = mes + dir;
    let novoAno = ano;
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    setMes(novoMes);
    setAno(novoAno);
  }

  const fmt = (v: number) => 'R$' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { m: mA } = mesAnterior();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Relatórios</Text>
        <View style={styles.navMes}>
          <TouchableOpacity onPress={() => navMes(-1)} style={styles.navBtn}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.navTxt}>{MESES[mes - 1]} {ano}</Text>
          <TouchableOpacity onPress={() => navMes(1)} style={styles.navBtn}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.resumoRow}>
        <View style={[styles.resumoCard, { borderTopColor: '#f25555' }]}>
          <Text style={styles.resumoLabel}>GASTO</Text>
          <Text style={[styles.resumoVal, { color: '#f25555' }]}>{fmt(totais.gasto)}</Text>
        </View>
        <View style={[styles.resumoCard, { borderTopColor: '#25d07e' }]}>
          <Text style={styles.resumoLabel}>RECEITA</Text>
          <Text style={[styles.resumoVal, { color: '#25d07e' }]}>{fmt(totais.receita)}</Text>
        </View>
        <View style={[styles.resumoCard, { borderTopColor: '#5294ff' }]}>
          <Text style={styles.resumoLabel}>SALDO</Text>
          <Text style={[styles.resumoVal, { color: totais.saldo >= 0 ? '#5294ff' : '#f25555' }]}>{fmt(totais.saldo)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>POR CATEGORIA — {MESES[mes - 1].toUpperCase()}</Text>
        {porCategoria.length === 0 && (
          <Text style={styles.vazio}>Nenhuma despesa este mês</Text>
        )}
        {porCategoria.map((c, i) => (
          <View key={i} style={styles.catRow}>
            <View style={styles.catTop}>
              <Text style={styles.catName}>{c.nome}</Text>
              <Text style={styles.catPct}>{c.pct}%</Text>
              <Text style={styles.catVal}>{fmt(c.valor)}</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${c.pct}%` as any }]} />
            </View>
          </View>
        ))}
      </View>

      {comparativo.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{MESES[mA - 1].toUpperCase()} × {MESES[mes - 1].toUpperCase()}</Text>
          <View style={styles.compareRow}>
            <Text style={styles.compareHeadCat}>Categoria</Text>
            <Text style={styles.compareHead}>{MESES[mA - 1].substring(0, 3)}</Text>
            <Text style={styles.compareHead}>Atual</Text>
            <Text style={styles.compareHeadDiff}>Δ</Text>
          </View>
          {comparativo.map((r, i) => {
            const diff = r.atual - r.anterior;
            const corDiff = diff > 0 ? '#f25555' : diff < 0 ? '#25d07e' : '#6b779a';
            const sinal = diff > 0 ? '+' : '';
            return (
              <View key={i} style={styles.compareRow}>
                <Text style={styles.compareItemCat} numberOfLines={1}>{r.cat}</Text>
                <Text style={styles.compareVal}>{fmt(r.anterior)}</Text>
                <Text style={styles.compareVal}>{fmt(r.atual)}</Text>
                <Text style={[styles.compareValDiff, { color: corDiff }]} numberOfLines={1}>
                  {sinal}{fmt(diff)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12151e' },
  header: { padding: 22, paddingTop: 50 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#f0f3ff', marginBottom: 14 },
  navMes: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  navBtn: { padding: 6, backgroundColor: '#1c2133', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  navArrow: { fontSize: 22, color: '#5294ff', lineHeight: 24 },
  navTxt: { fontSize: 15, fontWeight: '600', color: '#f0f3ff', minWidth: 140, textAlign: 'center' },
  resumoRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 14 },
  resumoCard: { flex: 1, backgroundColor: '#1c2133', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', borderTopWidth: 3 },
  resumoLabel: { fontSize: 9, fontWeight: '700', color: '#6b779a', letterSpacing: 0.8, marginBottom: 6 },
  resumoVal: { fontSize: 12, fontWeight: '700' },
  card: { marginHorizontal: 16, marginBottom: 14, backgroundColor: '#1c2133', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  cardTitle: { fontSize: 11, fontWeight: '700', color: '#aab4d0', letterSpacing: 0.8, marginBottom: 16 },
  vazio: { fontSize: 13, color: '#6b779a', textAlign: 'center', paddingVertical: 12 },
  catRow: { marginBottom: 12 },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  catName: { flex: 1, fontSize: 13, color: '#f0f3ff', fontWeight: '500' },
  catPct: { fontSize: 11, color: '#6b779a', marginRight: 8 },
  catVal: { fontSize: 13, color: '#aab4d0' },
  barTrack: { height: 5, backgroundColor: '#344060', borderRadius: 10, overflow: 'hidden' },
  barFill: { height: 5, backgroundColor: '#5294ff', borderRadius: 10 },
  compareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  compareHeadCat: { flex: 2, fontSize: 11, color: '#aab4d0', fontWeight: '600' },
  compareHead: { flex: 1.2, fontSize: 11, color: '#aab4d0', fontWeight: '600', textAlign: 'right' },
  compareHeadDiff: { width: 80, fontSize: 11, color: '#aab4d0', fontWeight: '600', textAlign: 'right' },
  compareItemCat: { flex: 2, fontSize: 12, color: '#f0f3ff' },
  compareVal: { flex: 1.2, fontSize: 11, color: '#aab4d0', textAlign: 'right' },
  compareValDiff: { width: 80, fontSize: 11, fontWeight: '700', textAlign: 'right' },
});