import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { buscarLancamentosPorMes, buscarTotaisMes } from '../database';
import HelpModal, { helpBtnStyle, helpTxtStyle } from '../HelpModal';
import { Colors, useTheme } from '../theme';

const ORC_KEY = '@financaspro:orcamento';
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const CORES = ['#5294ff','#25d07e','#f7b731','#f25555','#a855f7','#06b6d4','#f97316'];

const DONUT_SIZE      = 220;
const DONUT_THICKNESS = 24;
const DONUT_RADIUS    = (DONUT_SIZE - DONUT_THICKNESS) / 2;
const CIRCUMFERENCE   = 2 * Math.PI * DONUT_RADIUS;

type CategoriaDado = { nome: string; valor: number; pct: number; cor: string };

function MultiDonut({ dados, totalGasto, orcamento, fmt, trackColor, textColor, textMuted }: {
  dados: CategoriaDado[];
  totalGasto: number;
  orcamento: number;
  fmt: (v: number) => string;
  trackColor: string;
  textColor: string;
  textMuted: string;
}) {
  const cx = DONUT_SIZE / 2;
  const cy = DONUT_SIZE / 2;
  const total = dados.reduce((s, d) => s + d.valor, 0);

  let cumAngle = 0;
  const segments = dados
    .filter(d => d.valor > 0)
    .map(d => {
      const fraction = total > 0 ? d.valor / total : 0;
      const spanAngle = fraction * 360;
      const segLen = fraction * CIRCUMFERENCE;
      const startAngle = cumAngle;
      cumAngle += spanAngle;
      return { cor: d.cor, startAngle, segLen };
    });

  return (
    <View style={{ width: DONUT_SIZE, height: DONUT_SIZE }}>
      <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
        {/* Track */}
        <Circle
          cx={cx} cy={cy} r={DONUT_RADIUS}
          fill="none"
          stroke={trackColor}
          strokeWidth={DONUT_THICKNESS}
        />
        {/* Colored segments — each rotated so its dash starts at the correct angle */}
        {segments.map((seg, i) => (
          <Circle
            key={i}
            cx={cx} cy={cy} r={DONUT_RADIUS}
            fill="none"
            stroke={seg.cor}
            strokeWidth={DONUT_THICKNESS}
            strokeDasharray={`${seg.segLen} ${CIRCUMFERENCE}`}
            strokeDashoffset={0}
            rotation={-90 + seg.startAngle}
            origin={`${cx}, ${cy}`}
            strokeLinecap="butt"
          />
        ))}
      </Svg>

      {/* Center text — absolute, not inside SVG */}
      <View style={{
        position: 'absolute', top: 0, left: 0,
        width: DONUT_SIZE, height: DONUT_SIZE,
        alignItems: 'center', justifyContent: 'center',
      }}>
        {totalGasto > 0 ? (
          <>
            <Text style={{ fontSize: 18, fontWeight: '800', color: textColor, letterSpacing: -0.5 }}>
              {fmt(totalGasto)}
            </Text>
            <Text style={{ fontSize: 10, color: textMuted, fontWeight: '500', marginTop: 4 }}>
              de {fmt(orcamento)}
            </Text>
          </>
        ) : (
          <Text style={{ fontSize: 12, color: textMuted, fontWeight: '600', textAlign: 'center' }}>
            Sem{'\n'}gastos
          </Text>
        )}
      </View>
    </View>
  );
}

export default function OrcamentoScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [orcamento, setOrcamento] = useState(0);
  const [helpVisible, setHelpVisible] = useState(false);
  const [totais, setTotais] = useState({ totalGasto: 0, totalReceita: 0, saldo: 0 });
  const [porCategoria, setPorCategoria] = useState<CategoriaDado[]>([]);
  const [modal, setModal] = useState(false);
  const [novoOrc, setNovoOrc] = useState('');

  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();
  const diasNoMes = new Date(anoAtual, mesAtual, 0).getDate();
  const diasPassados = hoje.getDate();
  const diasRestantes = diasNoMes - diasPassados;

  useFocusEffect(useCallback(() => { carregarDados(); }, []));

  async function carregarDados() {
    const saved = await AsyncStorage.getItem(ORC_KEY);
    setOrcamento(saved ? parseFloat(saved) : 0);

    const t = buscarTotaisMes(mesAtual, anoAtual);
    setTotais(t);

    const lancamentos = buscarLancamentosPorMes(mesAtual, anoAtual);
    const despesas = lancamentos.filter((l: any) => l.tipo === 'despesa');
    const totalDesp = despesas.reduce((s: number, l: any) => s + l.valor, 0);

    const porCat: Record<string, number> = {};
    despesas.forEach((l: any) => {
      const cat = l.categoria || 'Outros';
      porCat[cat] = (porCat[cat] || 0) + l.valor;
    });

    setPorCategoria(
      Object.entries(porCat)
        .sort((a, b) => b[1] - a[1])
        .map(([nome, valor], i) => ({
          nome,
          valor,
          pct: totalDesp > 0 ? Math.round((valor / totalDesp) * 100) : 0,
          cor: CORES[i % CORES.length],
        }))
    );
  }

  async function salvarOrcamento() {
    const v = parseFloat(novoOrc.replace(',', '.'));
    if (isNaN(v) || v < 0) { Alert.alert('Atenção', 'Digite um valor válido ou 0 para desativar.'); return; }
    await AsyncStorage.setItem(ORC_KEY, String(v));
    setOrcamento(v);
    setModal(false);
    setNovoOrc('');
  }

  const orcamentoAtivo = orcamento > 0;
  const fmt = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const disponivel = orcamento - totais.totalGasto;
  const pct = orcamento > 0 ? Math.min(100, (totais.totalGasto / orcamento) * 100) : 0;
  const barCor = pct < 70 ? '#25d07e' : pct < 90 ? '#f7b731' : '#f25555';
  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Orçamento — {MESES[mesAtual - 1]}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={() => { setNovoOrc(String(orcamento)); setModal(true); }}
            style={s.editBtn}
          >
            <Text style={s.editBtnTxt}>✏️ Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setHelpVisible(true)} style={helpBtnStyle}>
            <Text style={helpTxtStyle}>?</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.body}>

        {!orcamentoAtivo && (
          <View style={s.semOrcamento}>
            <Text style={s.semOrcIco}>💰</Text>
            <Text style={s.semOrcTxt}>Orçamento não definido</Text>
            <Text style={s.semOrcSub}>Defina um limite mensal para acompanhar seus gastos</Text>
            <TouchableOpacity style={s.btnDefinirOrc} onPress={() => { setNovoOrc(''); setModal(true); }}>
              <Text style={s.btnDefinirOrcTxt}>Definir orçamento</Text>
            </TouchableOpacity>
          </View>
        )}

        {orcamentoAtivo && (
          <>
            {/* Donut multicor */}
            <View style={s.donutCard}>
              <MultiDonut
                dados={porCategoria}
                totalGasto={totais.totalGasto}
                orcamento={orcamento}
                fmt={fmt}
                trackColor={colors.barTrack2 ?? '#2a2a3a'}
                textColor={colors.text}
                textMuted={colors.textMuted}
              />

              {porCategoria.length > 0 ? (
                <View style={s.legenda}>
                  {porCategoria.map((item, i) => (
                    <View key={i} style={s.legendaItem}>
                      <View style={[s.legendaDot, { backgroundColor: item.cor }]} />
                      <View style={s.legendaInfo}>
                        <Text style={s.legendaNome} numberOfLines={1}>{item.nome}</Text>
                        <Text style={s.legendaVal}>{item.pct}% · {fmt(item.valor)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={s.semDados}>Nenhuma despesa este mês</Text>
              )}
            </View>

            {/* 3 cards */}
            <View style={s.cardsRow}>
              <View style={s.card}>
                <Text style={s.cardLbl}>Orçamento</Text>
                <Text style={[s.cardVal, { color: colors.text }]}>{fmt(orcamento)}</Text>
              </View>
              <View style={s.card}>
                <Text style={s.cardLbl}>Gasto</Text>
                <Text style={[s.cardVal, { color: '#f25555' }]}>{fmt(totais.totalGasto)}</Text>
              </View>
              <View style={s.card}>
                <Text style={s.cardLbl}>Disponível</Text>
                <Text style={[s.cardVal, { color: disponivel >= 0 ? '#f7b731' : '#f25555' }]}>
                  {fmt(disponivel)}
                </Text>
              </View>
            </View>

            {/* Barra de progresso */}
            <View style={s.barCard}>
              <View style={s.barRow}>
                <Text style={s.barLbl}>Progresso do mês</Text>
                <Text style={[s.barPct, { color: barCor }]}>{pct.toFixed(1)}%</Text>
              </View>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${pct}%` as any, backgroundColor: barCor }]} />
              </View>
              <Text style={s.barSub}>{diasRestantes} dias restantes em {MESES[mesAtual - 1]}</Text>
            </View>

            {/* Alertas */}
            {pct >= 90 && (
              <View style={s.alertDanger}>
                <Text style={s.alertTxt}>🚨 Você consumiu {pct.toFixed(0)}% do orçamento!</Text>
              </View>
            )}
            {pct >= 70 && pct < 90 && (
              <View style={s.alertWarn}>
                <Text style={s.alertTxt}>🔔 Você consumiu {pct.toFixed(0)}% do orçamento. Atenção!</Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={modal} transparent animationType="slide">
        <View style={s.modalBg}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Definir Orçamento</Text>
            <Text style={s.modalSub}>Quanto planeja gastar em {MESES[mesAtual - 1]}? Digite 0 para desativar.</Text>
            <TextInput
              style={s.modalInput}
              placeholder="Ex: 5000 (0 = desativar)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={novoOrc}
              onChangeText={setNovoOrc}
              autoFocus
            />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setModal(false)}>
                <Text style={s.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSave} onPress={salvarOrcamento}>
                <Text style={s.btnSaveTxt}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <HelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        title="Como definir seu orçamento"
        tips={[
          { emoji: '✏️', titulo: 'Definir limite', texto: 'Toque em ✏️ Editar para definir ou alterar o limite mensal de gastos.' },
          { emoji: '🚫', titulo: 'Desativar', texto: 'Digite 0 para desativar o orçamento.' },
          { emoji: '📶', titulo: 'Barra de progresso', texto: 'Verde: menos de 70%. Amarelo: 70–90%. Vermelho: acima de 90%.' },
          { emoji: '🍩', titulo: 'Gráfico de rosca', texto: 'Mostra os gastos divididos por categoria.' },
          { emoji: '🔄', titulo: 'Renovação automática', texto: 'O orçamento é mensal e se renova automaticamente todo mês.' },
          { emoji: '🔔', titulo: 'Notificações', texto: 'Você receberá uma notificação ao atingir 80% e 100% do limite.' },
        ]}
      />
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: 52, paddingBottom: 14,
      borderBottomWidth: 1, borderBottomColor: c.borderSoft,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: c.text },
    editBtn: { paddingVertical: 7, paddingHorizontal: 13, backgroundColor: c.input, borderRadius: 11, borderWidth: 1, borderColor: c.border },
    editBtnTxt: { fontSize: 13, color: c.textSec, fontWeight: '600' },

    body: { paddingHorizontal: 16, paddingTop: 20, gap: 14 },

    donutCard: {
      alignItems: 'center',
      paddingVertical: 24, paddingHorizontal: 16,
      backgroundColor: c.card, borderRadius: 20,
      borderWidth: 1, borderColor: c.borderSoft,
      gap: 20,
    },

    legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%' },
    legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '47%' },
    legendaDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
    legendaInfo: { flex: 1 },
    legendaNome: { fontSize: 11, color: c.text, fontWeight: '600' },
    legendaVal: { fontSize: 10, color: c.textMuted, marginTop: 1 },
    semDados: { fontSize: 13, color: c.textMuted },
    semOrcamento: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
    semOrcIco: { fontSize: 52, marginBottom: 16 },
    semOrcTxt: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 8 },
    semOrcSub: { fontSize: 13, color: c.textMuted, textAlign: 'center', marginBottom: 28, lineHeight: 20 },
    btnDefinirOrc: { backgroundColor: '#5294ff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
    btnDefinirOrcTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },

    cardsRow: { flexDirection: 'row', gap: 10 },
    card: {
      flex: 1, backgroundColor: c.card, borderRadius: 14,
      padding: 14, alignItems: 'center',
      borderWidth: 1, borderColor: c.borderSoft,
    },
    cardLbl: { fontSize: 10, color: c.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
    cardVal: { fontSize: 13, fontWeight: '700', textAlign: 'center' },

    barCard: { backgroundColor: c.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.borderSoft },
    barRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    barLbl: { fontSize: 13, color: c.textSec, fontWeight: '600' },
    barPct: { fontSize: 13, fontWeight: '700' },
    barTrack: { height: 10, backgroundColor: c.barTrack, borderRadius: 10, overflow: 'hidden', marginBottom: 8 },
    barFill: { height: 10, borderRadius: 10 },
    barSub: { fontSize: 11, color: c.textMuted },

    projCard: { backgroundColor: c.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.borderSoft },
    projCardPerigo: { borderColor: 'rgba(242,85,85,0.4)', backgroundColor: 'rgba(242,85,85,0.06)' },
    projTitle: { fontSize: 13, fontWeight: '700', color: c.text, marginBottom: 12 },
    projRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    projLbl: { fontSize: 13, color: c.textMuted },
    projVal: { fontSize: 13, fontWeight: '700', color: c.text },
    projAlerta: { fontSize: 12, color: '#f25555', marginTop: 8, lineHeight: 18 },

    alertDanger: { padding: 13, backgroundColor: 'rgba(242,85,85,0.11)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(242,85,85,0.3)' },
    alertWarn: { padding: 13, backgroundColor: 'rgba(247,183,49,0.11)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(247,183,49,0.3)' },
    alertTxt: { fontSize: 13, color: c.text, lineHeight: 20 },

    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 },
    modalBox: { backgroundColor: c.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: c.border },
    modalTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 6 },
    modalSub: { fontSize: 13, color: c.textMuted, marginBottom: 18 },
    modalInput: {
      backgroundColor: c.input, borderWidth: 1, borderColor: c.border,
      borderRadius: 11, padding: 14, color: c.text, fontSize: 18, fontWeight: '700', marginBottom: 16,
    },
    modalBtns: { flexDirection: 'row', gap: 10 },
    btnCancel: { flex: 1, padding: 13, backgroundColor: c.input, borderRadius: 11, alignItems: 'center', borderWidth: 1, borderColor: c.border },
    btnCancelTxt: { color: c.textSec, fontWeight: '600', fontSize: 14 },
    btnSave: { flex: 1, padding: 13, backgroundColor: '#5294ff', borderRadius: 11, alignItems: 'center' },
    btnSaveTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },
  });
}
