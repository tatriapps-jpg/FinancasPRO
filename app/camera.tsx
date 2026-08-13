import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, useTheme } from './theme';

export default function CameraScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [imagem, setImagem] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [dadosExtraidos, setDadosExtraidos] = useState<any>(null);

  async function tirarFoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permissão necessária', 'Precisamos de permissão para usar a câmera.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled) { setImagem(result.assets[0].uri); processarOCR(); }
  }

  async function escolherDaGaleria() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permissão necessária', 'Precisamos de permissão para acessar a galeria.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (!result.canceled) { setImagem(result.assets[0].uri); processarOCR(); }
  }

  async function processarOCR() {
    setCarregando(true);
    setDadosExtraidos(null);
    await new Promise(r => setTimeout(r, 1000));
    setCarregando(false);
    Alert.alert('Em breve', 'Leitura de notas fiscais estará disponível na próxima versão do app.');
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ler Nota / Ticket</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!imagem && (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIco}>📷</Text>
            <Text style={styles.placeholderTxt}>Fotografe ou selecione uma nota fiscal, ticket ou recibo</Text>
            <Text style={styles.placeholderSub}>Funcionalidade de leitura automática em breve</Text>
          </View>
        )}

        {imagem && (
          <Image source={{ uri: imagem }} style={styles.preview} resizeMode="contain" />
        )}

        {carregando && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#5294ff" />
            <Text style={styles.loadingTxt}>Processando imagem...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btnCamera} onPress={tirarFoto}>
          <Text style={styles.btnIco}>📷</Text>
          <Text style={styles.btnTxt}>Tirar foto</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnGaleria} onPress={escolherDaGaleria}>
          <Text style={styles.btnIco}>🖼️</Text>
          <Text style={styles.btnTxt}>Galeria</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex:1, backgroundColor:c.bg },
    header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, paddingTop:50, borderBottomWidth:1, borderBottomColor:c.borderSoft },
    backBtn: { padding:4 },
    backTxt: { fontSize:16, color:'#5294ff', fontWeight:'600' },
    headerTitle: { fontSize:17, fontWeight:'700', color:c.text },
    content: { padding:16, paddingBottom:100 },
    placeholder: { alignItems:'center', padding:40 },
    placeholderIco: { fontSize:64, marginBottom:16 },
    placeholderTxt: { fontSize:15, color:c.textSec, textAlign:'center', fontWeight:'500', lineHeight:22 },
    placeholderSub: { fontSize:12, color:c.textMuted, textAlign:'center', marginTop:8, lineHeight:18 },
    preview: { width:'100%', height:300, borderRadius:16, marginBottom:16 },
    loading: { alignItems:'center', padding:24 },
    loadingTxt: { color:c.textSec, marginTop:12, fontSize:14 },
    footer: { flexDirection:'row', gap:10, padding:16, paddingBottom:36, borderTopWidth:1, borderTopColor:c.borderSoft },
    btnCamera: { flex:1, padding:14, backgroundColor:'#5294ff', borderRadius:11, alignItems:'center', flexDirection:'row', justifyContent:'center', gap:8 },
    btnGaleria: { flex:1, padding:14, backgroundColor:c.input, borderRadius:11, alignItems:'center', flexDirection:'row', justifyContent:'center', gap:8, borderWidth:1, borderColor:c.border },
    btnIco: { fontSize:20 },
    btnTxt: { color:'#fff', fontWeight:'600', fontSize:14 },
  });
}