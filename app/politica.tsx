import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, useTheme } from './theme';

export default function PoliticaScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Política de Privacidade</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.ico}>🔒</Text>

        <Section titulo="Seus dados ficam no seu dispositivo" colors={colors}>
          O Fala, Dinheiro! armazena todos os dados exclusivamente no seu dispositivo. Não
          coletamos, transmitimos nem armazenamos seus dados financeiros em servidores externos.
        </Section>

        <Section titulo="O que NÃO coletamos" colors={colors}>
          {'• Dados financeiros pessoais\n'}
          {'• Informações de cartões ou contas bancárias\n'}
          {'• Localização geográfica\n'}
          {'• Contatos do dispositivo\n'}
          {'• Histórico de navegação'}
        </Section>

        <Section titulo="Microfone e reconhecimento de voz" colors={colors}>
          O microfone é utilizado exclusivamente para o recurso de lançamento por voz. O
          processamento ocorre localmente no dispositivo — nenhum áudio é enviado a servidores externos.
        </Section>

        <Section titulo="Pagamento in-app" colors={colors}>
          Processado pelo Google Play Billing. A TaTri Apps não tem acesso aos dados de
          pagamento — todo o processo é gerenciado pelo Google.
        </Section>

        <Section titulo="Backup" colors={colors}>
          O arquivo de backup é gerado e salvo localmente no seu dispositivo. Você tem total
          controle sobre o arquivo e decide onde armazená-lo.
        </Section>

        <Section titulo="Contato" colors={colors}>
          Em caso de dúvidas sobre esta política, entre em contato:{'\n'}
          {'tatriapps@gmail.com'}
        </Section>

        <Text style={styles.rodape}>TaTri Apps © 2026 · Versão {Constants.expoConfig?.version ?? '1.0.1'}</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function Section({ titulo, children, colors }: { titulo: string; children: React.ReactNode; colors: Colors }) {
  const st = StyleSheet.create({
    section: { backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.borderSoft },
    sectionTitulo: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 },
    sectionTexto: { fontSize: 13, color: colors.textSec, lineHeight: 20 },
  });
  return (
    <View style={st.section}>
      <Text style={st.sectionTitulo}>{titulo}</Text>
      <Text style={st.sectionTexto}>{children}</Text>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 16, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: c.borderSoft,
    },
    backBtn: { padding: 4 },
    backTxt: { fontSize: 16, color: '#5294ff', fontWeight: '600' },
    headerTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    scroll: { flex: 1 },
    content: { padding: 20 },
    ico: { fontSize: 48, textAlign: 'center', marginBottom: 20, marginTop: 8 },
    rodape: { fontSize: 11, color: c.textMuted, textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
  });
}
