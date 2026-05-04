import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={[s.box, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
          <Text style={[s.title, { color: colors.text }]}>{title}</Text>
          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
            {tips.map((tip, i) => (
              <View key={i} style={s.row}>
                <Text style={s.bullet}>›</Text>
                <Text style={[s.tip, { color: colors.textSec ?? colors.text }]}>{tip}</Text>
              </View>
            ))}
          </ScrollView>
          <Pressable onPress={onClose} style={s.btn}>
            <Text style={s.btnTxt}>Entendi</Text>
          </Pressable>
        </Pressable>
      </Pressable>
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
    borderRadius: 20, padding: 24, borderWidth: 1, maxHeight: '85%', flex: 1,
  },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  scroll: { flex: 1 },
  row:    { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' },
  bullet: { fontSize: 16, color: '#5294ff', marginRight: 10, lineHeight: 22 },
  tip:    { flex: 1, fontSize: 14, lineHeight: 22 },
  btn:    { marginTop: 20, backgroundColor: '#5294ff', borderRadius: 8,
            height: 48, width: '100%', justifyContent: 'center', alignItems: 'center' },
  btnTxt: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
