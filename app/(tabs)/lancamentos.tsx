import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { buscarLancamentos, deletarLancamento } from '../database';

const LIMITE_GRATIS = 100;
const DESBLOQUEADO_KEY = '@financaspro:desbloqueado';

export default function LancamentosScreen() {
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [modalPaywall, setModalPaywall] = useState(false);

  useFocusEffect(
    useCallback(() => {
      carregarLancamentos();
    }, [])
  );

  async function carregarLancamentos() {
    const saved = await AsyncStorage.getItem(DESBLOQUEADO_KEY);
    setDesbloqueado(saved === 'true');

    const dados = buscarLancamentos();
    dados.sort((a, b) => {
      const parsData = (d: string) => {
        if (!d) return 0;
        const [dia, mes, ano] = d.split('/').map(Number);
        return new Date(ano, mes - 1, dia).getTime();
      };

      // Se são do mesmo grupo, ordena por parcelaAtual ASC (1/3, 2/3, 3/3)
      if (a.grupoId && b.grupoId && a.grupoId === b.grupoId) {
        return a.parcelaAtual - b.parcelaAtual;
      }

      // Grupos diferentes: mais recente no topo
      const vA = parsData(a.dataVencimento || a.data);
      const vB = parsData(b.dataVencimento || b.data);
      if (vA !== vB) return vB - vA;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    setLancamentos(dados);
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
    (t.categoria && t.categoria.toLowerCase().includes(busca.toLowerCase()))
  );

  const totalLancamentos = lancamentos.length;
  const atingiuLimite = !desbloqueado && totalLancamentos >= LIMITE_GRATIS;
  const restantes = Math.max(0, LIMITE_GRATIS - totalLancamentos);

  function tentarAdicionar() {
    if (atingiuLimite) {
      setModalPaywall(true);
    } else {
      router.push('/novo-lancamento');
    }
  }

  function deletar(id: string, descricao: string) {
    Alert.alert(
      'Excluir lancamento',
      `Deseja excluir "${descricao}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => {
          deletarLancamento(id);
          carregarLancamentos();
        }}
      ]
    );
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
        dataPagamento: item.dataPagamento || '',
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
        {!desbloqueado && (
          <View style={[styles.contadorBadge, atingiuLimite && styles.contadorBadgeRed]}>
            <Text style={[styles.contadorTxt, atingiuLimite && styles.contadorTxtRed]}>
              {atingiuLimite ? '🔒 Limite atingido' : `${restantes} grátis restantes`}
            </Text>
          </View>
        )}
      </View>

      {/* Barra de progresso gratuito */}
      {!desbloqueado && (
        <View style={styles.progressBox}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {
              width: `${Math.min(100, (totalLancamentos / LIMITE_GRATIS) * 100)}%` as any,
              backgroundColor: atingiuLimite ? '#f25555' : totalLancamentos > 80 ? '#f7b731' : '#5294ff'
            }]} />
          </View>
          <Text style={styles.progressTxt}>{totalLancamentos}/{LIMITE_GRATIS} lançamentos gratuitos</Text>
        </View>
      )}

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar lançamento..."
          placeholderTextColor="#6b779a"
          value={busca}
          onChangeText={setBusca}
        />
        {busca.length > 0 &&
          <TouchableOpacity onPress={() => setBusca('')}>
            <Text style={{ color:'#6b779a', fontSize:16 }}>✕</Text>
          </TouchableOpacity>
        }
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {filtrados.length === 0 && (
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
        {filtrados.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={styles.txRow}
            onPress={() => editar(t)}
            onLongPress={() => deletar(t.id, t.descricao)}
          >
            <View style={styles.txIco}>
              <Text style={{ fontSize: 18 }}>{t.tipo === 'receita' ? '💰' : '💸'}</Text>
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txName}>{t.descricao}</Text>
              <View style={styles.txMeta}>
                <Text style={[styles.txTag, { color: tagColor[t.status] || '#aab4d0', backgroundColor: (tagColor[t.status] || '#aab4d0') + '22' }]}>
                  {tagLabel[t.status] || t.status}
                </Text>
                <Text style={styles.txSub}>{t.categoria}</Text>
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
        {filtrados.length > 0 && (
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

      {/* Modal Paywall */}
      <Modal visible={modalPaywall} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalIco}>🚀</Text>
            <Text style={styles.modalTitle}>Desbloqueie o FinançasPRO</Text>
            <Text style={styles.modalSub}>Você usou todos os 100 lançamentos gratuitos!</Text>

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
              alert('Pagamento in-app será implementado em breve!');
            }}>
              <Text style={styles.btnComprarTxt}>Desbloquear agora — R$ 14,90</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnFechar} onPress={() => setModalPaywall(false)}>
              <Text style={styles.btnFecharTxt}>Agora não</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12151e' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 22, paddingTop: 50, paddingBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#f0f3ff' },
  headerSub: { fontSize: 13, color: '#6b779a', marginTop: 2 },
  contadorBadge: { backgroundColor: 'rgba(82,148,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(82,148,255,0.3)' },
  contadorBadgeRed: { backgroundColor: 'rgba(242,85,85,0.15)', borderColor: 'rgba(242,85,85,0.3)' },
  contadorTxt: { fontSize: 11, color: '#5294ff', fontWeight: '600' },
  contadorTxtRed: { color: '#f25555' },
  progressBox: { paddingHorizontal: 22, paddingBottom: 12 },
  progressTrack: { height: 4, backgroundColor: '#2a3148', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: 4, borderRadius: 4 },
  progressTxt: { fontSize: 10, color: '#6b779a' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, backgroundColor: '#2a3148', borderRadius: 22, padding: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: '#f0f3ff', fontSize: 13.5 },
  empty: { alignItems: 'center', padding: 48 },
  emptyIco: { fontSize: 48, marginBottom: 12 },
  emptyTxt: { fontSize: 15, color: '#aab4d0', fontWeight: '600' },
  emptySub: { fontSize: 13, color: '#6b779a', marginTop: 4 },
  txRow: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  txIco: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#2a3148', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txInfo: { flex: 1 },
  txName: { fontSize: 13.5, fontWeight: '500', color: '#f0f3ff' },
  txMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  txTag: { fontSize: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontWeight: '600' },
  txSub: { fontSize: 11, color: '#6b779a' },
  txRight: { alignItems: 'flex-end' },
  txAmt: { fontSize: 14, fontWeight: '700', color: '#f0f3ff' },
  txDate: { fontSize: 11, color: '#6b779a', marginTop: 2 },
  hint: { textAlign: 'center', fontSize: 11, color: '#6b779a', padding: 16 },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 58, height: 58, borderRadius: 29, backgroundColor: '#5294ff', alignItems: 'center', justifyContent: 'center', elevation: 10, zIndex: 999 },
  fabLocked: { backgroundColor: '#f25555' },
  fabText: { fontSize: 30, color: '#fff', lineHeight: 34 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#1c2133', borderRadius: 24, padding: 28, paddingBottom: 48, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center' },
  modalIco: { fontSize: 48, marginBottom: 12 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#f0f3ff', marginBottom: 8, textAlign: 'center' },
  modalSub: { fontSize: 14, color: '#aab4d0', marginBottom: 20, textAlign: 'center' },
  beneficios: { alignSelf: 'stretch', marginBottom: 20 },
  beneficioItem: { fontSize: 14, color: '#f0f3ff', paddingVertical: 4 },
  precoBox: { alignItems: 'center', marginBottom: 24, backgroundColor: 'rgba(82,148,255,0.1)', borderRadius: 16, padding: 16, alignSelf: 'stretch', borderWidth: 1, borderColor: 'rgba(82,148,255,0.3)' },
  precoLabel: { fontSize: 12, color: '#aab4d0', marginBottom: 4 },
  preco: { fontSize: 36, fontWeight: '700', color: '#5294ff' },
  precoSub: { fontSize: 12, color: '#6b779a', marginTop: 2 },
  btnComprar: { backgroundColor: '#5294ff', borderRadius: 14, padding: 16, alignSelf: 'stretch', alignItems: 'center', marginBottom: 12 },
  btnComprarTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnFechar: { padding: 12 },
  btnFecharTxt: { color: '#6b779a', fontSize: 14 },
});