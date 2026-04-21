import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  endConnection,
  getProducts,
  initConnection,
  Purchase,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
} from 'react-native-iap';
import { Colors, useTheme } from './theme';

// ── Substitua pelo SKU real cadastrado no Google Play / App Store ──
const SKU_PREMIUM = Platform.OS === 'android'
  ? 'financaspro_premium'
  : 'financaspro_premium_ios';

const DESBLOQUEADO_KEY = '@faladinheiro:desbloqueado';

const BENEFICIOS = [
  { ico: '♾️',  txt: 'Lançamentos ilimitados' },
  { ico: '📊',  txt: 'Relatórios completos e gráficos' },
  { ico: '💳',  txt: 'Cartões e contas ilimitadas' },
  { ico: '🎤',  txt: 'Entrada por voz' },
  { ico: '📷',  txt: 'Escaneamento de recibos' },
  { ico: '☁️',  txt: 'Backup e exportação (Excel / PDF)' },
  { ico: '🔒',  txt: 'PIN de segurança' },
  { ico: '🌙',  txt: 'Tema escuro e claro' },
];

export default function PaywallScreen() {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors, isDark);

  const [preco, setPreco]         = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    let purchaseUpdateSub: ReturnType<typeof purchaseUpdatedListener>;
    let purchaseErrorSub:  ReturnType<typeof purchaseErrorListener>;

    async function setup() {
      try {
        await initConnection();

        purchaseUpdateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
          if (purchase.transactionId) {
            await AsyncStorage.setItem(DESBLOQUEADO_KEY, 'true');
            Alert.alert(
              '🎉 Compra realizada!',
              'Fala, Dinheiro! Premium foi desbloqueado. Obrigado!',
              [{ text: 'Continuar', onPress: () => router.replace('/(tabs)') }],
            );
          }
        });

        purchaseErrorSub = purchaseErrorListener(err => {
          setProcessando(false);
          if ((err as any).code !== 'E_USER_CANCELLED') {
            Alert.alert('Erro', err.message || 'Não foi possível concluir a compra.');
          }
        });

        const produtos = await getProducts({ skus: [SKU_PREMIUM] });
        if (produtos.length > 0) {
          setPreco(produtos[0].localizedPrice);
        }
      } catch {
        // sem conexão com a loja — continua sem exibir preço
      } finally {
        setCarregando(false);
      }
    }

    setup();

    return () => {
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
      endConnection();
    };
  }, []);

  async function comprar() {
    try {
      setProcessando(true);
      await requestPurchase({ skus: [SKU_PREMIUM] });
    } catch {
      setProcessando(false);
    }
  }

  async function restaurar() {
    try {
      setProcessando(true);
      const { getPurchaseHistory } = await import('react-native-iap');
      const hist = await getPurchaseHistory();
      const temCompra = hist.some(p => p.productId === SKU_PREMIUM);
      if (temCompra) {
        await AsyncStorage.setItem(DESBLOQUEADO_KEY, 'true');
        Alert.alert(
          '✅ Compra restaurada!',
          'Seu acesso premium foi reativado.',
          [{ text: 'Continuar', onPress: () => router.replace('/(tabs)') }],
        );
      } else {
        Alert.alert('Nenhuma compra encontrada', 'Não encontramos uma compra anterior para esta conta.');
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível restaurar a compra. Verifique sua conexão e tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  if (carregando) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#5294ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Premium</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <Text style={styles.heroIco}>💰</Text>
        <Text style={styles.heroTitle}>Fala, Dinheiro!{'\n'}Premium</Text>
        <Text style={styles.heroSub}>
          Você atingiu o limite de <Text style={styles.destaque}>100 lançamentos</Text> do plano gratuito.
          {'\n'}Desbloqueie tudo por um único pagamento.
        </Text>

        {/* Badge único pagamento */}
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>SEM ASSINATURA · PAGUE UMA VEZ SÓ</Text>
        </View>

        {/* Benefícios */}
        <View style={styles.beneficiosCard}>
          {BENEFICIOS.map((b, i) => (
            <View key={i} style={[styles.beneficioRow, i < BENEFICIOS.length - 1 && styles.beneficioSep]}>
              <Text style={styles.beneficioIco}>{b.ico}</Text>
              <Text style={styles.beneficioTxt}>{b.txt}</Text>
              <Text style={styles.check}>✓</Text>
            </View>
          ))}
        </View>

        {/* Preço */}
        {preco && (
          <View style={styles.precoRow}>
            <Text style={styles.precoLabel}>Pagamento único</Text>
            <Text style={styles.preco}>{preco}</Text>
          </View>
        )}

        {/* Botão comprar */}
        <TouchableOpacity
          style={[styles.btnComprar, processando && styles.btnDisabled]}
          onPress={comprar}
          disabled={processando}
          activeOpacity={0.85}
        >
          {processando
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnComprarTxt}>
                Desbloquear agora{preco ? ` · ${preco}` : ''}
              </Text>
          }
        </TouchableOpacity>

        {/* Restaurar */}
        <TouchableOpacity onPress={restaurar} disabled={processando} style={styles.restaurarBtn}>
          <Text style={styles.restaurarTxt}>Restaurar compra anterior</Text>
        </TouchableOpacity>

        {/* Rodapé legal */}
        <Text style={styles.legal}>
          Pagamento único processado pela {Platform.OS === 'android' ? 'Google Play' : 'App Store'}.
          Sem cobranças recorrentes. Acesso permanente ao aplicativo.
        </Text>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function makeStyles(c: Colors, isDark: boolean) {
  return StyleSheet.create({
    loading: {
      flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center',
    },
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: c.borderSoft,
    },
    backBtn: { padding: 4 },
    backTxt: { fontSize: 16, color: '#5294ff', fontWeight: '600' },
    headerTitle: { fontSize: 17, fontWeight: '700', color: c.text },

    scroll: { paddingHorizontal: 24, paddingTop: 8, alignItems: 'center' },

    heroIco: { fontSize: 56, marginBottom: 12 },
    heroTitle: {
      fontSize: 30, fontWeight: '800', color: c.text,
      textAlign: 'center', lineHeight: 36, marginBottom: 12,
    },
    heroSub: {
      fontSize: 14, color: c.textSec, textAlign: 'center',
      lineHeight: 21, marginBottom: 16,
    },
    destaque: { color: '#f25555', fontWeight: '700' },

    badge: {
      backgroundColor: isDark ? 'rgba(82,148,255,0.15)' : 'rgba(82,148,255,0.1)',
      borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
      borderWidth: 1, borderColor: 'rgba(82,148,255,0.4)',
      marginBottom: 24,
    },
    badgeTxt: { fontSize: 11, fontWeight: '700', color: '#5294ff', letterSpacing: 0.8 },

    beneficiosCard: {
      width: '100%', backgroundColor: c.card, borderRadius: 16,
      borderWidth: 1, borderColor: c.border, overflow: 'hidden', marginBottom: 24,
    },
    beneficioRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 13, paddingHorizontal: 16, gap: 12,
    },
    beneficioSep: { borderBottomWidth: 1, borderBottomColor: c.borderLight },
    beneficioIco: { fontSize: 20, width: 28, textAlign: 'center' },
    beneficioTxt: { flex: 1, fontSize: 14, color: c.text, fontWeight: '500' },
    check: { fontSize: 14, color: '#25d07e', fontWeight: '700' },

    precoRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      width: '100%', marginBottom: 14,
      backgroundColor: c.card, borderRadius: 12,
      paddingVertical: 14, paddingHorizontal: 18,
      borderWidth: 1, borderColor: c.border,
    },
    precoLabel: { fontSize: 14, color: c.textSec, fontWeight: '500' },
    preco: { fontSize: 22, fontWeight: '800', color: '#5294ff' },

    btnComprar: {
      width: '100%', backgroundColor: '#5294ff',
      borderRadius: 14, paddingVertical: 16,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 14,
      shadowColor: '#5294ff',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 6,
    },
    btnDisabled: { opacity: 0.6 },
    btnComprarTxt: { fontSize: 16, fontWeight: '700', color: '#fff' },

    restaurarBtn: { paddingVertical: 10, marginBottom: 20 },
    restaurarTxt: { fontSize: 13, color: c.textMuted, textDecorationLine: 'underline' },

    legal: {
      fontSize: 11, color: c.textMuted, textAlign: 'center',
      lineHeight: 17, paddingHorizontal: 8,
    },
  });
}
