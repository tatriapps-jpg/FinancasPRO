import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as XLSX from 'xlsx';
import { buscarLancamentosEmAtraso, buscarLancamentosPorMes } from '../database';
import HelpModal, { helpBtnStyle, helpTxtStyle } from '../HelpModal';
import { Colors, useTheme } from '../theme';

export default function RelatoriosScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const hoje = new Date();
  const [helpVisible, setHelpVisible] = useState(false);
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [porCategoria, setPorCategoria] = useState<{ nome: string; valor: number; pct: number }[]>([]);
  const [comparativo, setComparativo] = useState<{ cat: string; anterior: number; atual: number }[]>([]);
  const [totais, setTotais] = useState({ gasto: 0, receita: 0, saldo: 0 });
  const [exportando, setExportando] = useState(false);
  const [qtdAtrasados, setQtdAtrasados] = useState(0);

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  useFocusEffect(useCallback(() => { carregarDados(); }, [mes, ano]));

  function mesAnterior() {
    if (mes === 1) return { m: 12, a: ano - 1 };
    return { m: mes - 1, a: ano };
  }

  function carregarDados() {
    setQtdAtrasados(buscarLancamentosEmAtraso().length);
    const atual = buscarLancamentosPorMes(mes, ano);
    const despesasAtual = atual.filter(l => l.tipo === 'despesa');
    const receitasAtual = atual.filter(l => l.tipo === 'receita');
    const totalGasto = despesasAtual.reduce((s, l) => s + l.valor, 0);
    const totalReceita = receitasAtual.reduce((s, l) => s + l.valor, 0);
    setTotais({ gasto: totalGasto, receita: totalReceita, saldo: totalReceita - totalGasto });

    const porCat: Record<string, number> = {};
    despesasAtual.forEach(l => { porCat[l.categoria] = (porCat[l.categoria] || 0) + l.valor; });
    setPorCategoria(Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([nome, valor]) => ({
      nome, valor, pct: totalGasto > 0 ? Math.round((valor / totalGasto) * 100) : 0,
    })));

    const { m: mA, a: aA } = mesAnterior();
    const anterior = buscarLancamentosPorMes(mA, aA);
    const porCatAnt: Record<string, number> = {};
    anterior.filter(l => l.tipo === 'despesa').forEach(l => {
      porCatAnt[l.categoria] = (porCatAnt[l.categoria] || 0) + l.valor;
    });
    const todasCats = new Set([...Object.keys(porCat), ...Object.keys(porCatAnt)]);
    setComparativo(Array.from(todasCats).map(cat => ({
      cat, anterior: porCatAnt[cat] || 0, atual: porCat[cat] || 0,
    })).sort((a, b) => b.atual - a.atual));
  }

  function navMes(dir: number) {
    let novoMes = mes + dir; let novoAno = ano;
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    setMes(novoMes); setAno(novoAno);
  }

  function sortByDataVenc(items: any[]): any[] {
    const toMs = (d: string) => {
      if (!d) return 0;
      const [dd, mm, yy] = d.split('/').map(Number);
      return new Date(yy, mm - 1, dd).getTime();
    };
    return [...items].sort((a, b) => toMs(a.dataVencimento || a.data) - toMs(b.dataVencimento || b.data));
  }

  function getLancamentosTrimestreAtual(): any[] {
    const result: any[] = [];
    for (let i = 0; i < 3; i++) {
      let m = mes - i; let a = ano;
      if (m <= 0) { m += 12; a -= 1; }
      result.push(...buscarLancamentosPorMes(m, a));
    }
    return sortByDataVenc(result);
  }

  function getLancamentosAnoAtual(): any[] {
    const result: any[] = [];
    for (let m = 1; m <= 12; m++) result.push(...buscarLancamentosPorMes(m, ano));
    return sortByDataVenc(result);
  }

  async function gerarExcel(lancamentos: any[], nomeArquivo: string, nomePlanilha: string, comTotais: boolean, comColunaMes: boolean = false) {
    try {
      setExportando(true);

      const arredondar = (v: number) => Math.round(v * 100) / 100;

      const dados = lancamentos.map(l => {
        const base: Record<string, any> = {
          'Data': l.data || '',
          'Vencimento': l.dataVencimento || '',
          'Descrição': l.descricao || '',
          'Tipo': l.tipo === 'despesa' ? 'Despesa' : 'Receita',
          'Categoria': l.categoria || '',
          'Forma Pag.': l.formaPag || '',
          'Valor': 'R$ ' + Number(l.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          'Status': l.status || '',
          'Observação': l.obs || '',
        };
        if (!comColunaMes) return base;
        const dv = l.dataVencimento || l.data;
        const parts = dv?.split('/');
        const mesPart = (parts?.length === 3) ? `${MESES[parseInt(parts[1]) - 1]} ${parts[2]}` : '';
        return { 'Mês': mesPart, ...base };
      });

      if (comTotais) {
        const totalRec = lancamentos.filter(l => l.tipo === 'receita').reduce((s, l) => s + (l.valor || 0), 0);
        const totalDesp = lancamentos.filter(l => l.tipo === 'despesa').reduce((s, l) => s + (l.valor || 0), 0);
        const fmtT = (v: number) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        dados.push({} as any);
        dados.push({ 'Descrição': 'TOTAL RECEITAS', 'Valor': fmtT(totalRec) } as any);
        dados.push({ 'Descrição': 'TOTAL DESPESAS', 'Valor': fmtT(totalDesp) } as any);
        dados.push({ 'Descrição': 'SALDO', 'Valor': fmtT(totalRec - totalDesp) } as any);
      }

      const ws = XLSX.utils.json_to_sheet(dados);
      const baseCols = [{ wch:12 },{ wch:12 },{ wch:30 },{ wch:10 },{ wch:18 },{ wch:12 },{ wch:14 },{ wch:10 },{ wch:20 }];
      ws['!cols'] = comColunaMes ? [{ wch: 16 }, ...baseCols] : baseCols;
      const valorColIdx = comColunaMes ? 7 : 6;

      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let row = range.s.r + 1; row <= range.e.r; row++) {
        const cell = ws[XLSX.utils.encode_cell({ r: row, c: valorColIdx })];
        if (cell && cell.t === 'n') {
          cell.z = '#,##0.00';
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, nomePlanilha);

      const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const uint8 = new Uint8Array(wbout);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const base64 = btoa(binary);

      const uri = `${FileSystem.documentDirectory}${nomeArquivo}`;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });

      const disponivel = await Sharing.isAvailableAsync();
      if (!disponivel) { Alert.alert('Erro', 'Compartilhamento não disponível.'); return; }
      await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Exportar Excel — Fala, Dinheiro!',
      });
    } catch (e: any) {
      Alert.alert('Erro ao exportar', e?.message || 'Tente novamente.');
    } finally {
      setExportando(false);
    }
  }

  const fmt = (v: number) => 'R$' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { m: mA } = mesAnterior();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={styles.headerTitle}>Relatórios</Text>
          <TouchableOpacity onPress={() => setHelpVisible(true)} style={helpBtnStyle}>
            <Text style={helpTxtStyle}>?</Text>
          </TouchableOpacity>
        </View>
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

      {qtdAtrasados > 0 && (
        <View style={styles.atrasadoBadge}>
          <Text style={styles.atrasadoTxt}>⚠️ {qtdAtrasados} lançamento{qtdAtrasados > 1 ? 's' : ''} em atraso</Text>
        </View>
      )}

      <View style={styles.resumoRow}>
        <View style={[styles.resumoCard, { borderTopColor: '#25d07e' }]}>
          <Text style={styles.resumoLabel}>RECEITA</Text>
          <Text style={[styles.resumoVal, { color: '#25d07e' }]}>{fmt(totais.receita)}</Text>
        </View>
        <View style={[styles.resumoCard, { borderTopColor: '#f25555' }]}>
          <Text style={styles.resumoLabel}>GASTO</Text>
          <Text style={[styles.resumoVal, { color: '#f25555' }]}>{fmt(totais.gasto)}</Text>
        </View>
        <View style={[styles.resumoCard, { borderTopColor: '#5294ff' }]}>
          <Text style={styles.resumoLabel}>SALDO</Text>
          <Text style={[styles.resumoVal, { color: totais.saldo >= 0 ? '#5294ff' : '#f25555' }]}>{fmt(totais.saldo)}</Text>
        </View>
      </View>

      <View style={styles.exportRow}>
        <TouchableOpacity
          style={[styles.btnExport, exportando && { opacity: 0.6 }]}
          onPress={() => gerarExcel(buscarLancamentosPorMes(mes, ano), `FalaDinheiro_${MESES[mes-1]}_${ano}.xlsx`, `${MESES[mes-1]} ${ano}`, true)}
          disabled={exportando}
        >
          <Text style={styles.btnExportIco}>📅</Text>
          <Text style={styles.btnExportTxt}>{exportando ? '...' : 'Mês atual'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnExportTri, exportando && { opacity: 0.6 }]}
          onPress={() => gerarExcel(getLancamentosTrimestreAtual(), `FalaDinheiro_Trimestre_${mes}_${ano}.xlsx`, 'Trimestre', true, true)}
          disabled={exportando}
        >
          <Text style={styles.btnExportIco}>📆</Text>
          <Text style={styles.btnExportTxt}>{exportando ? '...' : 'Trimestre'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnExportAlt, exportando && { opacity: 0.6 }]}
          onPress={() => gerarExcel(getLancamentosAnoAtual(), `FalaDinheiro_Ano_${ano}.xlsx`, `Ano ${ano}`, true, true)}
          disabled={exportando}
        >
          <Text style={styles.btnExportIco}>📋</Text>
          <Text style={styles.btnExportTxt}>{exportando ? '...' : `Ano ${ano}`}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>POR CATEGORIA — {MESES[mes - 1].toUpperCase()}</Text>
        {porCategoria.length === 0 && <Text style={styles.vazio}>Nenhuma despesa este mês</Text>}
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
            const corDiff = diff > 0 ? '#f25555' : diff < 0 ? '#25d07e' : colors.textMuted;
            return (
              <View key={i} style={styles.compareRow}>
                <Text style={styles.compareItemCat} numberOfLines={1}>{r.cat}</Text>
                <Text style={styles.compareVal}>{fmt(r.anterior)}</Text>
                <Text style={styles.compareVal}>{fmt(r.atual)}</Text>
                <Text style={[styles.compareValDiff, { color: corDiff }]} numberOfLines={1}>
                  {diff > 0 ? '+' : ''}{fmt(diff)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
      <View style={{ height: 20 }} />
      </ScrollView>
      <HelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        title="Como usar os relatórios"
        tips={[
          { emoji: '🔄', titulo: 'Navegação', texto: 'Use as setas ‹ › para navegar entre os meses.' },
          { emoji: '📋', titulo: 'Resumo', texto: 'Mostra total de receitas, despesas e saldo do período selecionado.' },
          { emoji: '📊', titulo: 'Gráfico', texto: 'O gráfico de barras exibe os gastos por categoria.' },
          { emoji: '⚖️', titulo: 'Comparativo', texto: 'A tabela compara os gastos do mês atual com o mês anterior — verde significa que gastou menos, vermelho que gastou mais.' },
          { emoji: '📤', titulo: 'Exportar Excel', texto: 'Toque em "Mês atual" para exportar o mês. Toque em "Trimestre" para os últimos 3 meses. Toque em "Ano 2026" para o ano completo.' },
        ]}
      />
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { padding: 22, paddingTop: 50 },
    headerTitle: { fontSize: 22, fontWeight: '700', color: c.text, marginBottom: 14 },
    navMes: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    navBtn: { padding: 6, backgroundColor: c.card, borderRadius: 10, borderWidth: 1, borderColor: c.borderSoft },
    navArrow: { fontSize: 22, color: '#5294ff', lineHeight: 24 },
    navTxt: { fontSize: 15, fontWeight: '600', color: c.text, minWidth: 140, textAlign: 'center' },
    atrasadoBadge: { marginHorizontal: 16, marginBottom: 12, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: 'rgba(242,85,85,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(242,85,85,0.35)' },
    atrasadoTxt: { fontSize: 13, fontWeight: '700', color: '#f25555' },
    resumoRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 14 },
    resumoCard: { flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.borderSoft, borderTopWidth: 3 },
    resumoLabel: { fontSize: 9, fontWeight: '700', color: c.textMuted, letterSpacing: 0.8, marginBottom: 6 },
    resumoVal: { fontSize: 12, fontWeight: '700' },
    exportRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 14 },
    btnExport: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: c.card, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: 'rgba(37,208,126,0.4)' },
    btnExportTri: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: c.card, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: 'rgba(247,183,49,0.4)' },
    btnExportAlt: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: c.card, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: 'rgba(82,148,255,0.4)' },
    btnExportIco: { fontSize: 16 },
    btnExportTxt: { fontSize: 11, color: c.text, fontWeight: '600' },
    card: { marginHorizontal: 16, marginBottom: 14, backgroundColor: c.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: c.borderSoft },
    cardTitle: { fontSize: 11, fontWeight: '700', color: c.textSec, letterSpacing: 0.8, marginBottom: 16 },
    vazio: { fontSize: 13, color: c.textMuted, textAlign: 'center', paddingVertical: 12 },
    catRow: { marginBottom: 12 },
    catTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    catName: { flex: 1, fontSize: 13, color: c.text, fontWeight: '500' },
    catPct: { fontSize: 11, color: c.textMuted, marginRight: 8 },
    catVal: { fontSize: 13, color: c.textSec },
    barTrack: { height: 5, backgroundColor: c.barTrack, borderRadius: 10, overflow: 'hidden' },
    barFill: { height: 5, backgroundColor: '#5294ff', borderRadius: 10 },
    compareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.borderLight },
    compareHeadCat: { flex: 2, fontSize: 11, color: c.textSec, fontWeight: '600' },
    compareHead: { flex: 1.2, fontSize: 11, color: c.textSec, fontWeight: '600', textAlign: 'right' },
    compareHeadDiff: { width: 80, fontSize: 11, color: c.textSec, fontWeight: '600', textAlign: 'right' },
    compareItemCat: { flex: 2, fontSize: 12, color: c.text },
    compareVal: { flex: 1.2, fontSize: 11, color: c.textSec, textAlign: 'right' },
    compareValDiff: { width: 80, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  });
}