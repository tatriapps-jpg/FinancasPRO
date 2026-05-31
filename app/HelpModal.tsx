import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './theme';

type Tip = { titulo: string; texto: string };
type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  tips: Tip[];
};

export default function HelpModal({ visible, onClose, title, tips }: Props) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[s.box, { backgroundColor: colors.card, borderColor: colors.border }]} activeOpacity={1} onPress={() => {}}>
          <Text style={[s.title, { color: colors.text }]}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={s.scroll}>
            {tips.map((tip, i) => (
              <View key={i} style={s.row}>
                <Text style={s.bullet}>•</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.tipTitulo, { color: colors.text }]}>{tip.titulo}</Text>
                  <Text style={[s.tip, { color: colors.textSec ?? colors.text }]}>{tip.texto}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <Pressable onPress={onClose} style={s.entendiBt}>
            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>Entendi</Text>
          </Pressable>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export const helpBtnStyle = {
  width: 32, height: 32, borderRadius: 16,
  borderWidth: 1.5, borderColor: '#5294ff',
  alignItems: 'center' as const, justifyContent: 'center' as const,
};
export const helpTxtStyle = { fontSize: 15, fontWeight: '700' as const, color: '#5294ff' };

const s = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  box:       { borderRadius: 20, padding: 24, borderWidth: 1, maxHeight: '82%' },
  title:     { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  scroll:    { flex: 1 },
  row:       { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' },
  bullet:    { fontSize: 16, color: '#5294ff', marginRight: 10, lineHeight: 22 },
  tipTitulo: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  tip:       { fontSize: 13, lineHeight: 20 },
  entendiBt: { marginTop: 20, backgroundColor: '#5294ff', borderRadius: 12, padding: 14, alignItems: 'center' },
});