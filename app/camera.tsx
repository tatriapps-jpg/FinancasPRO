import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CameraScreen() {
  const [imagem, setImagem] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [dadosExtraidos, setDadosExtraidos] = useState<any>(null);

  async function tirarFoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { alert('Precisamos de permissao para usar a camera.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled) { setImagem(result.assets[0].uri); processarOCR(result.assets[0].uri); }
  }

  async function escolherDaGaleria() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { alert('Precisamos de permissao para acessar a galeria.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (!result.canceled) { setImagem(result.assets[0].uri); processarOCR(result.assets[0].uri); }
  }

  async function processarOCR(uri: string) {
    setCarregando(true);
    setDadosExtraidos(null);
    try {
      const result = await TextRecognition.recognize(uri);
      const texto = result.text;
      extrairDados(texto);
    } catch (e) {
      alert('Erro ao processar imagem. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  function extrairDados(texto: string) {
    const linhas = texto.split('\n');

    let valor = '';
    const regexValor = /R\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))/gi;
    const valores: string[] = [];
    let match;
    while ((match = regexValor.exec(texto)) !== null) { valores.push(match[1]); }
    if (valores.length > 0) {
      valor = valores.sort((a, b) =>
        parseFloat(b.replace('.','').replace(',','.')) -
        parseFloat(a.replace('.','').replace(',','.'))
      )[0];
    }

    let data = '';
    const matchData = texto.match(/(\d{2}\/\d{2}\/\d{2,4})/);
    if (matchData) data = matchData[1];

    let estabelecimento = '';
    for (const linha of linhas) {
      if (linha.trim().length > 3) { estabelecimento = linha.trim(); break; }
    }

    let cartao = '';
    const matchCartao = texto.match(/\*{2,4}\s*(\d{4})|(\d{4})\s*\*{2,4}/);
    if (matchCartao) cartao = matchCartao[1] || matchCartao[2];

    let parcelas = '';
    const matchParc = texto.match(/(\d{1,2})\s*[xX\/]\s*R?\$?\s*\d/);
    if (matchParc) parcelas = matchParc[1];

    setDadosExtraidos({ valor, data, estabelecimento, cartao, parcelas });
  }

  function usarDados() {
    if (!dadosExtraidos) return;
    router.push({
      pathname: '/novo-lancamento',
      params: {
        descricao: dadosExtraidos.estabelecimento,
        valor: dadosExtraidos.valor,
        data: dadosExtraidos.data,
        cartao: dadosExtraidos.cartao,
        parcelas: dadosExtraidos.parcelas,
      }
    });
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
            <Text style={styles.placeholderSub}>O app vai tentar extrair os dados automaticamente</Text>
          </View>
        )}

        {imagem && (
          <Image source={{ uri: imagem }} style={styles.preview} resizeMode="contain" />
        )}

        {carregando && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#5294ff" />
            <Text style={styles.loadingTxt}>Lendo o documento...</Text>
          </View>
        )}

        {dadosExtraidos && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Dados encontrados</Text>
            {dadosExtraidos.estabelecimento ? <View style={styles.resultRow}><Text style={styles.resultLbl}>Estabelecimento</Text><Text style={styles.resultVal}>{dadosExtraidos.estabelecimento}</Text></View> : null}
            {dadosExtraidos.valor ? <View style={styles.resultRow}><Text style={styles.resultLbl}>Valor total</Text><Text style={styles.resultVal}>R$ {dadosExtraidos.valor}</Text></View> : null}
            {dadosExtraidos.data ? <View style={styles.resultRow}><Text style={styles.resultLbl}>Data</Text><Text style={styles.resultVal}>{dadosExtraidos.data}</Text></View> : null}
            {dadosExtraidos.cartao ? <View style={styles.resultRow}><Text style={styles.resultLbl}>Cartao</Text><Text style={styles.resultVal}>****{dadosExtraidos.cartao}</Text></View> : null}
            {dadosExtraidos.parcelas ? <View style={styles.resultRow}><Text style={styles.resultLbl}>Parcelas</Text><Text style={styles.resultVal}>{dadosExtraidos.parcelas}x</Text></View> : null}
            {!dadosExtraidos.valor && !dadosExtraidos.data && (
              <Text style={styles.resultWarn}>Nao foi possivel extrair dados. Tente uma foto mais nitida.</Text>
            )}
            <TouchableOpacity style={styles.btnUsar} onPress={usarDados}>
              <Text style={styles.btnUsarTxt}>Usar esses dados no lancamento</Text>
            </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#12151e' },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, paddingTop:50, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.08)' },
  backBtn: { padding:4 },
  backTxt: { fontSize:16, color:'#5294ff', fontWeight:'600' },
  headerTitle: { fontSize:17, fontWeight:'700', color:'#f0f3ff' },
  content: { padding:16, paddingBottom:100 },
  placeholder: { alignItems:'center', padding:40 },
  placeholderIco: { fontSize:64, marginBottom:16 },
  placeholderTxt: { fontSize:15, color:'#aab4d0', textAlign:'center', fontWeight:'500', lineHeight:22 },
  placeholderSub: { fontSize:12, color:'#6b779a', textAlign:'center', marginTop:8, lineHeight:18 },
  preview: { width:'100%', height:300, borderRadius:16, marginBottom:16 },
  loading: { alignItems:'center', padding:24 },
  loadingTxt: { color:'#aab4d0', marginTop:12, fontSize:14 },
  resultCard: { backgroundColor:'#1c2133', borderRadius:16, padding:18, borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  resultTitle: { fontSize:15, fontWeight:'700', color:'#25d07e', marginBottom:14 },
  resultRow: { flexDirection:'row', justifyContent:'space-between', paddingVertical:8, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.06)' },
  resultLbl: { fontSize:13, color:'#6b779a' },
  resultVal: { fontSize:13, color:'#f0f3ff', fontWeight:'500', flex:1, textAlign:'right' },
  resultWarn: { fontSize:12, color:'#f7b731', marginTop:8, lineHeight:18 },
  btnUsar: { marginTop:16, padding:14, backgroundColor:'#5294ff', borderRadius:11, alignItems:'center' },
  btnUsarTxt: { color:'#fff', fontWeight:'600', fontSize:14 },
  footer: { flexDirection:'row', gap:10, padding:16, paddingBottom:36, borderTopWidth:1, borderTopColor:'rgba(255,255,255,0.08)' },
  btnCamera: { flex:1, padding:14, backgroundColor:'#5294ff', borderRadius:11, alignItems:'center', flexDirection:'row', justifyContent:'center', gap:8 },
  btnGaleria: { flex:1, padding:14, backgroundColor:'#2a3148', borderRadius:11, alignItems:'center', flexDirection:'row', justifyContent:'center', gap:8, borderWidth:1, borderColor:'rgba(255,255,255,0.18)' },
  btnIco: { fontSize:20 },
  btnTxt: { color:'#fff', fontWeight:'600', fontSize:14 },
});