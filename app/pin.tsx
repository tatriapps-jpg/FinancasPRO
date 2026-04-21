import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import { Colors, useTheme } from './theme';

const PIN_KEY = '@financaspro:pin';

export default function PinScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'verify'|'create'|'confirm'>('verify');
  const [newPin, setNewPin] = useState('');
  const [title, setTitle] = useState('Digite seu PIN');
  const [subtitle, setSubtitle] = useState('');

  useEffect(() => {
    checkPin();
  }, []);

  async function checkPin() {
    const saved = await AsyncStorage.getItem(PIN_KEY);
    if (!saved) {
      setMode('create');
      setTitle('Crie seu PIN');
      setSubtitle('Digite 4 dígitos para proteger o app');
    }
  }

  function pressKey(n: string) {
    if (pin.length >= 4) return;
    const newVal = pin + n;
    setPin(newVal);
    setError('');

    if (newVal.length === 4) {
      setTimeout(() => handlePin(newVal), 150);
    }
  }

  async function handlePin(value: string) {
    if (mode === 'verify') {
      const saved = await AsyncStorage.getItem(PIN_KEY);
      if (value === saved) {
        router.replace('/(tabs)');
      } else {
        Vibration.vibrate(400);
        setError('PIN incorreto. Tente novamente.');
        setPin('');
      }
    } else if (mode === 'create') {
      setNewPin(value);
      setMode('confirm');
      setTitle('Confirme seu PIN');
      setSubtitle('Digite o PIN novamente');
      setPin('');
    } else if (mode === 'confirm') {
      if (value === newPin) {
        await AsyncStorage.setItem(PIN_KEY, value);
        router.replace('/(tabs)');
      } else {
        Vibration.vibrate(400);
        setError('PINs não coincidem. Tente novamente.');
        setMode('create');
        setNewPin('');
        setTitle('Crie seu PIN');
        setSubtitle('Digite 4 dígitos para proteger o app');
        setPin('');
      }
    }
  }

  function delKey() {
    setPin(pin.slice(0, -1));
    setError('');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>💰</Text>
      <Text style={styles.appName}>Fala, Dinheiro!</Text>
      <Text style={styles.appSub}>Controle Financeiro Pessoal</Text>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <Text style={styles.title}>{title}</Text>

      <View style={styles.dots}>
        {[0,1,2,3].map(i => (
          <View key={i} style={[
            styles.dot,
            pin.length > i && styles.dotFilled,
            error ? styles.dotError : null
          ]} />
        ))}
      </View>

      <Text style={styles.error}>{error || ' '}</Text>

      <View style={styles.pad}>
        {['1','2','3','4','5','6','7','8','9'].map(n => (
          <TouchableOpacity key={n} style={styles.key} onPress={() => pressKey(n)}>
            <Text style={styles.keyNum}>{n}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.keyEmpty} />
        <TouchableOpacity style={styles.key} onPress={() => pressKey('0')}>
          <Text style={styles.keyNum}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.key, styles.keyDel]} onPress={delKey}>
          <Text style={styles.keyNum}>⌫</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex:1, backgroundColor:c.bg, alignItems:'center', justifyContent:'center', padding:24 },
    logo: { fontSize:48, marginBottom:8 },
    appName: { fontSize:24, fontWeight:'700', color:c.text, marginBottom:4 },
    appSub: { fontSize:13, color:c.textMuted, marginBottom:32 },
    subtitle: { fontSize:12, color:c.textMuted, marginBottom:4 },
    title: { fontSize:15, fontWeight:'500', color:c.textSec, marginBottom:24 },
    dots: { flexDirection:'row', gap:16, marginBottom:8 },
    dot: { width:15, height:15, borderRadius:10, borderWidth:2, borderColor:c.textMuted },
    dotFilled: { backgroundColor:'#5294ff', borderColor:'#5294ff' },
    dotError: { backgroundColor:'#f25555', borderColor:'#f25555' },
    error: { fontSize:12, color:'#f25555', marginBottom:24, height:18 },
    pad: { flexDirection:'row', flexWrap:'wrap', width:270, gap:12, justifyContent:'center' },
    key: { width:78, height:68, backgroundColor:c.input, borderRadius:16, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:c.border },
    keyDel: { backgroundColor:c.card },
    keyEmpty: { width:78, height:68 },
    keyNum: { fontSize:22, fontWeight:'600', color:c.text },
  });
}
