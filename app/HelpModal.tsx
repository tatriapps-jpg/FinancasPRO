import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, useTheme } from './theme';

type Tip = { titulo: string; texto: string; emoji?: string };
type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  tips: Tip[];
};

export default function HelpModal({ visible, onClose, title, tips }: Props) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  const total = tips.length;
  const atual = tips[step] ?? tips[0];
  const isFirst = step === 0;
  const isLast = step === total - 1;

  function proxima() {
    if (!isLast) setStep(step + 1);
    else onClose();
  }

  function anterior() {
    if (!isFirst) setStep(step - 1);
  }

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.box} activeOpacity={1} onPress={() => {}}>
          <View style={s.topRow}>
            <Text style={s.title} numberOfLines={1}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.fechar}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={s.dots}>
            {tips.map((_, i) => (
              <View key={i} style={[s.dot, i === step ? s.dotAtivo : s.dotInativo]} />
            ))}
          </View>

          <View style={s.corpo}>
            <Text style={s.emoji}>{atual?.emoji || '💡'}</Text>
            <Text style={s.tipTitulo}>{atual?.titulo}</Text>
            <Text style={s.tip}>{atual?.texto}</Text>
          </View>

          <View style={s.footer}>
            <TouchableOpacity onPress={anterior} disabled={isFirst} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[s.nav, isFirst && s.navOculto]}>‹ Anterior</Text>
            </TouchableOpacity>
            <Text style={s.contador}>{step + 1} / {total}</Text>
            <TouchableOpacity onPress={proxima} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[s.nav, s.navProximo, isLast && s.navOculto]}>Próxima ›</Text>
            </TouchableOpacity>
          </View>

          {isLast && (
            <Pressable onPress={onClose} style={s.entendiBt}>
              <Text style={s.entendiTxt}>Entendi</Text>
            </Pressable>
          )}
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

function makeStyles(c: Colors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
    box: { borderRadius: 20, padding: 22, borderWidth: 1, backgroundColor: c.card, borderColor: c.border },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    title: { flex: 1, fontSize: 14, fontWeight: '600', color: c.textSec },
    fechar: { fontSize: 16, color: c.textMuted, marginLeft: 12 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginBottom: 18 },
    dot: { height: 6, borderRadius: 3 },
    dotAtivo: { width: 16, backgroundColor: '#5294ff' },
    dotInativo: { width: 6, backgroundColor: c.border },
    corpo: { alignItems: 'center', minHeight: 150, justifyContent: 'center', paddingHorizontal: 4 },
    emoji: { fontSize: 38, marginBottom: 12 },
    tipTitulo: { fontSize: 15, fontWeight: '600', color: c.text, marginBottom: 8, textAlign: 'center' },
    tip: { fontSize: 13, lineHeight: 20, color: c.textSec, textAlign: 'center' },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
    nav: { fontSize: 12, color: c.textMuted },
    navProximo: { color: '#5294ff', fontWeight: '600' },
    navOculto: { opacity: 0 },
    contador: { fontSize: 11, color: c.textMuted },
    entendiBt: { marginTop: 14, backgroundColor: '#5294ff', borderRadius: 12, padding: 14, alignItems: 'center' },
    entendiTxt: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  });
}
