import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function QRCodeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ler QR Code</Text>
        <View style={{ width: 70 }} />
      </View>
      <View style={styles.content}>
        <Text style={styles.ico}>📲</Text>
        <Text style={styles.titulo}>QR Code</Text>
        <Text style={styles.sub}>Esta funcionalidade estara disponivel na versao final do app na Play Store.</Text>
        <Text style={styles.sub2}>No momento estamos em fase de desenvolvimento com Expo Go, que nao suporta leitura de QR Code nativa.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnTxt}>Voltar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#12151e' },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, paddingTop:50, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.08)' },
  backBtn: { padding:4 },
  backTxt: { fontSize:16, color:'#5294ff', fontWeight:'600' },
  headerTitle: { fontSize:17, fontWeight:'700', color:'#f0f3ff' },
  content: { flex:1, alignItems:'center', justifyContent:'center', padding:32 },
  ico: { fontSize:64, marginBottom:16 },
  titulo: { fontSize:20, fontWeight:'700', color:'#f0f3ff', marginBottom:12 },
  sub: { fontSize:14, color:'#aab4d0', textAlign:'center', lineHeight:22, marginBottom:12 },
  sub2: { fontSize:13, color:'#6b779a', textAlign:'center', lineHeight:20, marginBottom:32 },
  btn: { padding:14, backgroundColor:'#5294ff', borderRadius:11, paddingHorizontal:32 },
  btnTxt: { color:'#fff', fontWeight:'600', fontSize:14 },
});