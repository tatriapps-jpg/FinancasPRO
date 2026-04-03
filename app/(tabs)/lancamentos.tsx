import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { buscarLancamentos, deletarLancamento } from '../database';

export default function LancamentosScreen() {
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [busca, setBusca] = useState('');

  useFocusEffect(
    useCallback(() => {
      carregarLancamentos();
    }, [])
  );

  function carregarLancamentos() {
    const dados = buscarLancamentos();
    // Ordena: primeiro por dataVencimento desc, depois por createdAt desc
    dados.sort((a, b) => {
      const parsData = (d: string) => {
        if (!d) return 0;
        const [dia, mes, ano] = d.split('/').map(Number);
        return new Date(ano, mes - 1, dia).getTime();
      };
      const vA = parsData(a.dataVencimento);
      const vB = parsData(b.dataVencimento);
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
        <Text style={styles.headerTitle}>Lancamentos</Text>
        <Text style={styles.headerSub}>{lancamentos.length} lancamento(s)</Text>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar lancamento..."
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
              {lancamentos.length === 0 ? 'Nenhum lancamento ainda' : 'Nenhum resultado encontrado'}
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
        style={styles.fab}
        onPress={() => router.push('/novo-lancamento')}
        activeOpacity={0.7}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12151e' },
  header: { padding: 22, paddingTop: 50 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#f0f3ff' },
  headerSub: { fontSize: 13, color: '#6b779a', marginTop: 2 },
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
  fabText: { fontSize: 30, color: '#fff', lineHeight: 34 },
});