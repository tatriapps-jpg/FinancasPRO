import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from './theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  tips: string[];
};

export default function HelpModal({ visible, onClose, title, tips }: Props) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          style={[s.box, { backgroundColor: colors.card, borderColor: colors.border }]}
          activeOpacity={1}
          onPress={() => {}}
        >
          <Text style={[s.title, { color: colors.text }]}>{title}</Text>
          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
            {tips.map((tip, i) => (
              <View key={i} style={s.row}>
                <Text style={s.bullet}>›</Text>
                <Text style={[s.tip, { color: colors.textSec ?? colors.text }]}>{tip}</Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={{ marginTop: 20 }}>
            <View style={{ backgroundColor: '#5294ff', borderRadius: 8, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>Entendi</Text>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// Estilo do botão "?" no header — exportado para uso uniforme em todas as telas
export const helpBtnStyle = {
  width: 32, height: 32, borderRadius: 16,
  borderWidth: 1.5, borderColor: '#5294ff',
  alignItems: 'center' as const, justifyContent: 'center' as const,
};
export const helpTxtStyle = { fontSize: 15, fontWeight: '700' as const, color: '#5294ff' };

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', padding: 24,
  },
  box: {
    borderRadius: 20, padding: 24, borderWidth: 1, maxHeight: '85%',
  },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  scroll: { maxHeight: 340 },
  row: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' },
  bullet: { fontSize: 16, color: '#5294ff', marginRight: 10, lineHeight: 22 },
  tip: { flex: 1, fontSize: 14, lineHeight: 22 },
});
