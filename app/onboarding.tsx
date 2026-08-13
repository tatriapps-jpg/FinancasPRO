import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { capitalizarPalavras, detectarCategoria, interpretarValor } from './voz-utils';
import { gerarId, inserirCartao, inserirLancamento } from './database';
import { Colors, useTheme } from './theme';

const ORC_KEY = '@financaspro:orcamento';
const CONTAS_KEY = '@financaspro:contas';
const ONBOARDING_KEY = '@financaspro:onboardingConcluido';
const PIN_KEY = '@financaspro:pin';
const PRIMEIRO_LANCAMENTO_KEY = '@faladinheiro:primeiroLancamento';

const BANDEIRAS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outro'];
const TIPOS_CONTA = ['Corrente', 'Poupança', 'Investimento'];

const TOTAL_STEPS = 7; // 0..6

function hoje(): string {
  const d = new Date();
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function parseBRValue(val: string): string {
  const v = (val || '').trim();
  const temVirgula = v.includes(',');
  const temPonto = v.includes('.');
  if (temVirgula && temPonto) return v.replace(/\./g, '').replace(',', '.');
  if (temVirgula) {
    const decimais = v.split(',')[1] || '';
    return decimais.length === 3 ? v.replace(',', '') : v.replace(',', '.');
  }
  if (temPonto) {
    const partes = v.split('.');
    if (partes.length > 2 || partes[partes.length - 1].length === 3) return partes.join('');
  }
  return v;
}

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [step, setStep] = useState(0);
  const [salvando, setSalvando] = useState(false);

  // Etapa 1 — Orçamento
  const [orcamento, setOrcamento] = useState('');

  // Etapa 2 — Conta bancária
  const [contaNome, setContaNome] = useState('');
  const [contaBanco, setContaBanco] = useState('');
  const [contaTipo, setContaTipo] = useState('Corrente');
  const [contaSaldo, setContaSaldo] = useState('');
  const [contaAdicionada, setContaAdicionada] = useState(false);

  // Etapa 3 — Cartão de crédito
  const [cartaoApelido, setCartaoApelido] = useState('');
  const [cartaoBandeira, setCartaoBandeira] = useState('Visa');
  const [cartaoUltimos4, setCartaoUltimos4] = useState('');
  const [cartaoLimite, setCartaoLimite] = useState('');
  const [cartaoFechamento, setCartaoFechamento] = useState('');
  const [cartaoVencimento, setCartaoVencimento] = useState('');
  const [cartaoAdicionado, setCartaoAdicionado] = useState(false);

  // Etapa 4 — Dinheiro em espécie
  const [especie, setEspecie] = useState('');

  function avancar() {
    setStep(s => Math.min(s + 1, TOTAL_STEPS - 1));
  }
  function voltar() {
    if (step === 0) return;
    setStep(s => s - 1);
  }

  async function concluirOrcamento() {
    const normalizado = parseBRValue(orcamento.trim());
    const valor = parseFloat(normalizado);
    if (orcamento.trim() && (isNaN(valor) || valor <= 0)) {
      Alert.alert('Atenção', 'Digite um valor válido ou pule esta etapa.');
      return;
    }
    if (orcamento.trim()) {
      await AsyncStorage.setItem(ORC_KEY, String(valor));
    }
    avancar();
  }

  async function concluirConta() {
    if (!contaNome.trim() || !contaBanco.trim()) {
      Alert.alert('Atenção', 'Preencha nome e banco, ou toque em "Pular esta etapa".');
      return;
    }
    const saved = await AsyncStorage.getItem(CONTAS_KEY);
    const lista = saved ? JSON.parse(saved) : [];
    const nova = {
      id: gerarId(),
      nome: contaNome.trim(),
      banco: contaBanco.trim(),
      tipo: contaTipo,
      saldo: contaSaldo.trim() ? parseBRValue(contaSaldo.trim()) : '0',
    };
    await AsyncStorage.setItem(CONTAS_KEY, JSON.stringify([...lista, nova]));
    setContaAdicionada(true);
    avancar();
  }

  function concluirCartao() {
    if (!cartaoUltimos4 || cartaoUltimos4.length !== 4) {
      Alert.alert('Atenção', 'Digite os 4 últimos dígitos do cartão, ou toque em "Pular esta etapa".');
      return;
    }
    if (!cartaoFechamento || !cartaoVencimento) {
      Alert.alert('Atenção', 'Digite o dia de fechamento e vencimento, ou toque em "Pular esta etapa".');
      return;
    }
    const diaFech = parseInt(cartaoFechamento, 10);
    const diaVenc = parseInt(cartaoVencimento, 10);
    if (isNaN(diaFech) || diaFech < 1 || diaFech > 31 || isNaN(diaVenc) || diaVenc < 1 || diaVenc > 31) {
      Alert.alert('Atenção', 'Os dias de fechamento e vencimento devem ser entre 1 e 31.');
      return;
    }
    const apelidoFinal = cartaoApelido.trim() || cartaoBandeira + ' ****' + cartaoUltimos4;
    inserirCartao({
      id: gerarId(),
      apelido: apelidoFinal,
      bandeira: cartaoBandeira,
      ultimos4: cartaoUltimos4,
      fechamento: cartaoFechamento,
      vencimento: cartaoVencimento,
      limite: cartaoLimite.trim() ? parseBRValue(cartaoLimite.trim()) : '0',
    });
    setCartaoAdicionado(true);
    avancar();
  }

  async function concluirEspecie() {
    const normalizado = parseBRValue(especie.trim());
    const valor = especie.trim() ? parseFloat(normalizado) : 0;
    if (especie.trim() && isNaN(valor)) {
      Alert.alert('Atenção', 'Digite um valor válido ou pule esta etapa.');
      return;
    }
    const saved = await AsyncStorage.getItem(CONTAS_KEY);
    const lista = saved ? JSON.parse(saved) : [];
    const jaExiste = lista.some((c: any) => c.id === 'especie_fixa');
    let novas;
    if (jaExiste) {
      novas = lista.map((c: any) => (c.id === 'especie_fixa' ? { ...c, saldo: String(valor) } : c));
    } else {
      novas = [...lista, { id: 'especie_fixa', nome: 'Dinheiro em Espécie', banco: 'Espécie', tipo: 'Espécie', saldo: String(valor) }];
    }
    await AsyncStorage.setItem(CONTAS_KEY, JSON.stringify(novas));
    avancar();
  }

  async function proximaRotaFinal(): Promise<'/pin' | '/(tabs)'> {
    const pin = await AsyncStorage.getItem(PIN_KEY);
    return pin ? '/(tabs)' : '/pin';
  }

  async function finalizar() {
    setSalvando(true);
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    const rota = await proximaRotaFinal();
    setSalvando(false);
    router.replace(rota);
  }

  async function pularTudo() {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    const rota = await proximaRotaFinal();
    router.replace(rota);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Barra de progresso */}
        <View style={styles.progressWrap}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${(step / (TOTAL_STEPS - 1)) * 100}%` }]} />
          </View>
          {step > 0 && step < TOTAL_STEPS - 1 && (
            <TouchableOpacity onPress={pularTudo}>
              <Text style={styles.pularTudoTxt}>Pular tudo</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {step === 0 && <EtapaBoasVindas colors={colors} styles={styles} onNext={avancar} />}

          {step === 1 && (
            <EtapaVoz
              colors={colors}
              styles={styles}
              onNext={avancar}
              onSkip={avancar}
            />
          )}

          {step === 2 && (
            <EtapaOrcamento
              colors={colors}
              styles={styles}
              valor={orcamento}
              setValor={setOrcamento}
              onNext={concluirOrcamento}
              onSkip={avancar}
              onBack={voltar}
            />
          )}

          {step === 3 && (
            <EtapaConta
              colors={colors}
              styles={styles}
              nome={contaNome} setNome={setContaNome}
              banco={contaBanco} setBanco={setContaBanco}
              tipo={contaTipo} setTipo={setContaTipo}
              saldo={contaSaldo} setSaldo={setContaSaldo}
              onNext={concluirConta}
              onSkip={avancar}
              onBack={voltar}
            />
          )}

          {step === 4 && (
            <EtapaCartao
              colors={colors}
              styles={styles}
              apelido={cartaoApelido} setApelido={setCartaoApelido}
              bandeira={cartaoBandeira} setBandeira={setCartaoBandeira}
              ultimos4={cartaoUltimos4} setUltimos4={setCartaoUltimos4}
              limite={cartaoLimite} setLimite={setCartaoLimite}
              fechamento={cartaoFechamento} setFechamento={setCartaoFechamento}
              vencimento={cartaoVencimento} setVencimento={setCartaoVencimento}
              onNext={concluirCartao}
              onSkip={avancar}
              onBack={voltar}
            />
          )}

          {step === 5 && (
            <EtapaEspecie
              colors={colors}
              styles={styles}
              valor={especie}
              setValor={setEspecie}
              onNext={concluirEspecie}
              onSkip={avancar}
              onBack={voltar}
            />
          )}

          {step === 6 && (
            <EtapaConclusao
              colors={colors}
              styles={styles}
              orcamentoDefinido={!!orcamento.trim()}
              contaAdicionada={contaAdicionada}
              cartaoAdicionado={cartaoAdicionado}
              especieDefinida={!!especie.trim()}
              onFinish={finalizar}
              salvando={salvando}
            />
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Etapas
// ─────────────────────────────────────────────────────────────────────────

function EtapaBoasVindas({ colors, styles, onNext }: any) {
  return (
    <View style={styles.etapa}>
      <Text style={styles.emoji}>👋💰</Text>
      <Text style={styles.titulo}>Bem-vindo(a) ao Fala, Dinheiro!</Text>
      <Text style={styles.paragrafo}>
        Aqui você registra seus gastos e recebimentos só de voz — sem digitar nada. Que tal já
        experimentar agora, com um gasto de verdade?
      </Text>
      <Text style={styles.paragrafo}>
        Depois, se quiser, configuramos rapidinho orçamento, conta, cartão e dinheiro em espécie —
        leva menos de 2 minutos e dá pra pular qualquer etapa.
      </Text>
      <TouchableOpacity style={styles.btnPrimario} onPress={onNext}>
        <Text style={styles.btnPrimarioTxt}>Vamos começar →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Etapa de voz — primeira coisa que o usuário faz no app: experimentar
// o recurso principal, falando um gasto real, que já é salvo de verdade.
// ─────────────────────────────────────────────────────────────────────────

type SubEtapaVoz = 'intro' | 'descricao' | 'valor' | 'confirmando' | 'feito' | 'permissao-negada';

function EtapaVoz({ colors, styles, onNext, onSkip }: any) {
  const [subEtapa, setSubEtapa] = useState<SubEtapaVoz>('intro');
  const [gravando, setGravando] = useState(false);
  const [transcricao, setTranscricao] = useState('');
  const [erro, setErro] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [valor, setValor] = useState('');

  const subEtapaRef = useRef<SubEtapaVoz>('intro');
  const descricaoRef = useRef('');
  const brutoRef = useRef<string[]>([]);
  const textoFinal = useRef('');
  const jaProcessou = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      Speech.stop();
      ExpoSpeechRecognitionModule.stop();
    };
  }, []);

  function mudarSubEtapa(v: SubEtapaVoz) {
    subEtapaRef.current = v;
    setSubEtapa(v);
  }

  useSpeechRecognitionEvent('result', (event) => {
    const t = event.results?.[0]?.transcript || '';
    setTranscricao(t);
    textoFinal.current = t;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => ExpoSpeechRecognitionModule.stop(), 2000);
  });

  useSpeechRecognitionEvent('end', () => {
    setGravando(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (textoFinal.current.trim() && !jaProcessou.current) {
      jaProcessou.current = true;
      processar(textoFinal.current);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    setGravando(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (textoFinal.current.trim() && !jaProcessou.current) {
      jaProcessou.current = true;
      processar(textoFinal.current);
      return;
    }
    if (event.error !== 'no-speech') {
      setErro('Não consegui ouvir. Tente de novo.');
    }
  });

  function processar(texto: string) {
    brutoRef.current.push(texto);
    if (subEtapaRef.current === 'descricao') {
      const desc = capitalizarPalavras(texto.trim());
      descricaoRef.current = desc;
      setDescricao(desc);
      setCategoria(detectarCategoria(texto) || '');
      setErro('');
      mudarSubEtapa('valor');
      setTimeout(() => iniciarGravacaoInterna(), 400);
    } else if (subEtapaRef.current === 'valor') {
      const val = interpretarValor(texto);
      if (!val || val === '0') {
        setErro('Não entendi o valor. Toque no microfone e tente de novo, ex: "cinquenta reais".');
        return;
      }
      setValor(val);
      setErro('');
      mudarSubEtapa('confirmando');
    }
  }

  function iniciarGravacaoInterna() {
    setTranscricao(''); textoFinal.current = ''; jaProcessou.current = false;
    ExpoSpeechRecognitionModule.start({ lang: 'pt-BR', interimResults: true, maxAlternatives: 3, continuous: true });
    setGravando(true);
    timerRef.current = setTimeout(() => ExpoSpeechRecognitionModule.stop(), 8000);
  }

  async function comecar() {
    setErro('');
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) { mudarSubEtapa('permissao-negada'); return; }
    mudarSubEtapa('descricao');
    setTimeout(() => iniciarGravacaoInterna(), 200);
  }

  function tentarNovamente() {
    setDescricao(''); setCategoria(''); setValor(''); setErro('');
    brutoRef.current = [];
    mudarSubEtapa('intro');
  }

  async function salvar() {
    const valorNum = parseFloat(valor.replace(',', '.'));
    if (isNaN(valorNum) || valorNum <= 0) return;
    const cat = categoria || detectarCategoria(descricao) || 'Outros';
    const bruto = brutoRef.current.join(' · ');
    inserirLancamento({
      id: gerarId(), tipo: 'despesa',
      descricao, valor: valorNum,
      categoria: cat, formaPag: 'Dinheiro',
      cartaoId: '', contaId: '',
      parcelas: 1, parcelaAtual: 1, totalParcelas: 1,
      data: hoje(), dataVencimento: hoje(),
      status: 'pago', obs: bruto ? `[voz] ${bruto}` : '', grupoId: '',
    });
    const jaTinhaPrimeiro = await AsyncStorage.getItem(PRIMEIRO_LANCAMENTO_KEY);
    if (!jaTinhaPrimeiro) await AsyncStorage.setItem(PRIMEIRO_LANCAMENTO_KEY, String(Date.now()));
    mudarSubEtapa('feito');
  }

  const fmt = (v: string) => {
    const n = parseFloat(v.replace(',', '.'));
    return isNaN(n) ? v : 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <View style={styles.etapa}>
      {subEtapa === 'intro' && (
        <>
          <Text style={styles.emoji}>🎙️</Text>
          <Text style={styles.titulo}>Experimente agora</Text>
          <Text style={styles.paragrafo}>
            Toque no microfone e registre um gasto real. A gente pergunta duas coisas rapidinho:
            o que você gastou (ex: "mercado") e depois quanto custou (ex: "cinquenta reais").
          </Text>
          <TouchableOpacity style={styles.vozMicBtn} onPress={comecar}>
            <Text style={styles.vozMicIco}>🎤</Text>
            <Text style={styles.vozMicTxt}>Toque para falar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSkip} style={{ marginTop: 20 }}>
            <Text style={styles.linkTxt}>Pular, prefiro configurar sem voz</Text>
          </TouchableOpacity>
        </>
      )}

      {(subEtapa === 'descricao' || subEtapa === 'valor') && (
        <>
          <Text style={styles.emoji}>{gravando ? '🔴' : '🎙️'}</Text>
          <Text style={styles.titulo}>
            {subEtapa === 'descricao' ? 'O que você gastou?' : 'Quanto custou?'}
          </Text>
          <Text style={styles.paragrafo}>
            {subEtapa === 'descricao'
              ? 'Diga, por exemplo: "mercado", "gasolina" ou "remédio".'
              : 'Diga o valor por extenso, por exemplo: "cinquenta reais".'}
          </Text>
          {descricao && subEtapa === 'valor' ? (
            <Text style={styles.dica}>Entendi: "{descricao}" 👍</Text>
          ) : null}
          <View style={styles.vozTranscricaoBox}>
            <Text style={styles.vozTranscricaoTxt}>
              {gravando ? (transcricao || 'Ouvindo...') : 'Toque no microfone'}
            </Text>
          </View>
          {erro ? <Text style={styles.erroVoz}>⚠️ {erro}</Text> : null}
          <TouchableOpacity
            style={[styles.vozMicBtn, gravando && styles.vozMicBtnAtivo]}
            onPress={iniciarGravacaoInterna}
            disabled={gravando}
          >
            <Text style={styles.vozMicIco}>{gravando ? '⏹' : '🎤'}</Text>
            <Text style={styles.vozMicTxt}>{gravando ? 'Ouvindo...' : 'Toque para falar'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSkip} style={{ marginTop: 20 }}>
            <Text style={styles.linkTxt}>Pular, prefiro configurar sem voz</Text>
          </TouchableOpacity>
        </>
      )}

      {subEtapa === 'confirmando' && (
        <>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.titulo}>Entendi certinho!</Text>
          <View style={styles.resumoBox}>
            <View style={styles.resumoLinha}>
              <Text style={styles.resumoIcone}>📝</Text>
              <Text style={styles.resumoTxt}>{descricao}</Text>
            </View>
            <View style={styles.resumoLinha}>
              <Text style={styles.resumoIcone}>💰</Text>
              <Text style={styles.resumoTxt}>{fmt(valor)}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.btnPrimario} onPress={salvar}>
            <Text style={styles.btnPrimarioTxt}>✅ Registrar esse gasto</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={tentarNovamente} style={{ marginTop: 14 }}>
            <Text style={styles.linkTxt}>🎤 Tentar de novo</Text>
          </TouchableOpacity>
        </>
      )}

      {subEtapa === 'feito' && (
        <>
          <Text style={styles.emoji}>✅</Text>
          <Text style={styles.titulo}>Prontinho!</Text>
          <Text style={styles.paragrafo}>
            Seu primeiro gasto já está registrado. É assim que funciona — rápido, só de voz.
          </Text>
          <TouchableOpacity style={styles.btnPrimario} onPress={onNext}>
            <Text style={styles.btnPrimarioTxt}>Continuar →</Text>
          </TouchableOpacity>
        </>
      )}

      {subEtapa === 'permissao-negada' && (
        <>
          <Text style={styles.emoji}>🔇</Text>
          <Text style={styles.titulo}>Sem acesso ao microfone</Text>
          <Text style={styles.paragrafo}>
            Sem a permissão do microfone não dá pra usar a voz agora. Você pode habilitar depois
            nas configurações do celular, ou continuar e configurar tudo digitando.
          </Text>
          <TouchableOpacity style={styles.btnPrimario} onPress={onSkip}>
            <Text style={styles.btnPrimarioTxt}>Continuar →</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function EtapaOrcamento({ colors, styles, valor, setValor, onNext, onSkip, onBack }: any) {
  return (
    <View style={styles.etapa}>
      <Text style={styles.stepLabel}>Etapa 1 de 4</Text>
      <Text style={styles.emoji}>🎯</Text>
      <Text style={styles.titulo}>Qual o seu orçamento do mês?</Text>
      <Text style={styles.paragrafo}>
        É uma estimativa de quanto você pretende gastar por mês. Com isso, o app mostra o quanto já
        foi consumido e avisa quando você estiver perto do limite.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 3000"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        value={valor}
        onChangeText={setValor}
      />
      <TouchableOpacity style={styles.btnPrimario} onPress={onNext}>
        <Text style={styles.btnPrimarioTxt}>Continuar →</Text>
      </TouchableOpacity>
      <RodapeNavegacao onBack={onBack} onSkip={onSkip} styles={styles} />
    </View>
  );
}

function EtapaConta({ colors, styles, nome, setNome, banco, setBanco, tipo, setTipo, saldo, setSaldo, onNext, onSkip, onBack }: any) {
  return (
    <View style={styles.etapa}>
      <Text style={styles.stepLabel}>Etapa 2 de 4</Text>
      <Text style={styles.emoji}>🏦</Text>
      <Text style={styles.titulo}>Cadastre uma conta bancária</Text>
      <Text style={styles.paragrafo}>
        Assim você pode registrar PIX enviados e recebidos, e acompanhar o saldo de cada conta separadamente.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Nome da conta (ex: Conta principal)"
        placeholderTextColor={colors.textMuted}
        value={nome}
        onChangeText={setNome}
      />
      <TextInput
        style={styles.input}
        placeholder="Banco (ex: Nubank, Itaú, Bradesco)"
        placeholderTextColor={colors.textMuted}
        value={banco}
        onChangeText={setBanco}
      />
      <View style={styles.chipsRow}>
        {TIPOS_CONTA.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, tipo === t && styles.chipAtivo]}
            onPress={() => setTipo(t)}
          >
            <Text style={[styles.chipTxt, tipo === t && styles.chipTxtAtivo]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Saldo atual (opcional)"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        value={saldo}
        onChangeText={setSaldo}
      />
      <TouchableOpacity style={styles.btnPrimario} onPress={onNext}>
        <Text style={styles.btnPrimarioTxt}>Salvar e continuar →</Text>
      </TouchableOpacity>
      <Text style={styles.dica}>💡 Tem mais contas? Você pode cadastrar quantas quiser depois, em Configurações.</Text>
      <RodapeNavegacao onBack={onBack} onSkip={onSkip} styles={styles} />
    </View>
  );
}

function EtapaCartao({ colors, styles, apelido, setApelido, bandeira, setBandeira, ultimos4, setUltimos4, limite, setLimite, fechamento, setFechamento, vencimento, setVencimento, onNext, onSkip, onBack }: any) {
  return (
    <View style={styles.etapa}>
      <Text style={styles.stepLabel}>Etapa 3 de 4</Text>
      <Text style={styles.emoji}>💳</Text>
      <Text style={styles.titulo}>Cadastre um cartão de crédito</Text>
      <Text style={styles.paragrafo}>
        Registre suas compras parceladas e acompanhe o limite disponível e a fatura de cada cartão.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Apelido (opcional, ex: Nubank Roxinho)"
        placeholderTextColor={colors.textMuted}
        value={apelido}
        onChangeText={setApelido}
      />
      <View style={styles.chipsRow}>
        {BANDEIRAS.map(b => (
          <TouchableOpacity
            key={b}
            style={[styles.chip, bandeira === b && styles.chipAtivo]}
            onPress={() => setBandeira(b)}
          >
            <Text style={[styles.chipTxt, bandeira === b && styles.chipTxtAtivo]}>{b}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Últimos 4 dígitos"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        maxLength={4}
        value={ultimos4}
        onChangeText={setUltimos4}
      />
      <TextInput
        style={styles.input}
        placeholder="Limite (opcional)"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        value={limite}
        onChangeText={setLimite}
      />
      <View style={styles.rowDois}>
        <TextInput
          style={[styles.input, styles.inputMetade]}
          placeholder="Dia fechamento"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={2}
          value={fechamento}
          onChangeText={setFechamento}
        />
        <TextInput
          style={[styles.input, styles.inputMetade]}
          placeholder="Dia vencimento"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={2}
          value={vencimento}
          onChangeText={setVencimento}
        />
      </View>
      <TouchableOpacity style={styles.btnPrimario} onPress={onNext}>
        <Text style={styles.btnPrimarioTxt}>Salvar e continuar →</Text>
      </TouchableOpacity>
      <Text style={styles.dica}>💡 Tem mais cartões? Você pode cadastrar quantos quiser depois, em Configurações.</Text>
      <RodapeNavegacao onBack={onBack} onSkip={onSkip} styles={styles} />
    </View>
  );
}

function EtapaEspecie({ colors, styles, valor, setValor, onNext, onSkip, onBack }: any) {
  return (
    <View style={styles.etapa}>
      <Text style={styles.stepLabel}>Etapa 4 de 4</Text>
      <Text style={styles.emoji}>💵</Text>
      <Text style={styles.titulo}>Quanto dinheiro você tem em mãos?</Text>
      <Text style={styles.paragrafo}>
        Esse valor entra como "Dinheiro em Espécie" e é atualizado automaticamente conforme você
        registra gastos e recebimentos em dinheiro.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 150"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        value={valor}
        onChangeText={setValor}
      />
      <TouchableOpacity style={styles.btnPrimario} onPress={onNext}>
        <Text style={styles.btnPrimarioTxt}>Salvar e continuar →</Text>
      </TouchableOpacity>
      <RodapeNavegacao onBack={onBack} onSkip={onSkip} styles={styles} />
    </View>
  );
}

function EtapaConclusao({ colors, styles, orcamentoDefinido, contaAdicionada, cartaoAdicionado, especieDefinida, onFinish, salvando }: any) {
  const itens = [
    { label: 'Orçamento do mês', ok: orcamentoDefinido },
    { label: 'Conta bancária', ok: contaAdicionada },
    { label: 'Cartão de crédito', ok: cartaoAdicionado },
    { label: 'Dinheiro em espécie', ok: especieDefinida },
  ];
  return (
    <View style={styles.etapa}>
      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.titulo}>Tudo pronto!</Text>
      <Text style={styles.paragrafo}>Aqui está o que você configurou agora:</Text>
      <View style={styles.resumoBox}>
        {itens.map(it => (
          <View key={it.label} style={styles.resumoLinha}>
            <Text style={styles.resumoIcone}>{it.ok ? '✅' : '⚪'}</Text>
            <Text style={styles.resumoTxt}>{it.label}{it.ok ? '' : ' — pulado, configure quando quiser em Configurações'}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.paragrafo}>
        Você pode cadastrar mais contas e cartões, ou ajustar tudo isso, depois em Configurações → Cartões, Contas ou Dinheiro.
      </Text>
      <View style={styles.resumoBox}>
        <Text style={styles.dicasFinaisTitulo}>💡 Antes de começar</Text>
        <View style={styles.resumoLinha}>
          <Text style={styles.resumoIcone}>❓</Text>
          <Text style={styles.resumoTxt}>Toque no (?) no topo de qualquer tela para ver instruções específicas dela.</Text>
        </View>
        <View style={styles.resumoLinha}>
          <Text style={styles.resumoIcone}>✏️</Text>
          <Text style={styles.resumoTxt}>Todo lançamento pode ser editado (toque nele) ou excluído (toque e segure).</Text>
        </View>
        <View style={styles.resumoLinha}>
          <Text style={styles.resumoIcone}>🗣️</Text>
          <Text style={styles.resumoTxt}>Se o app não entender "Pix" ao falar, diga "é Pix" — funciona melhor.</Text>
        </View>
        <View style={styles.resumoLinha}>
          <Text style={styles.resumoIcone}>⚙️</Text>
          <Text style={styles.resumoTxt}>Em Configurações dá pra: cadastrar cartões, contas e dinheiro em espécie, personalizar categorias, ativar PIN/biometria, mudar tema e velocidade da voz, fazer backup e restaurar dados.</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.btnPrimario} onPress={onFinish} disabled={salvando}>
        <Text style={styles.btnPrimarioTxt}>{salvando ? 'Abrindo...' : 'Começar a usar o app 🚀'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function RodapeNavegacao({ onBack, onSkip, styles }: any) {
  return (
    <View style={styles.rodape}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.linkTxt}>‹ Voltar</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSkip}>
        <Text style={styles.linkTxt}>Pular esta etapa</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────────────────────────────────

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    progressWrap: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 16 },
    progressBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.barTrack2, overflow: 'hidden' },
    progressFill: { height: 6, borderRadius: 3, backgroundColor: '#5294ff' },
    pularTudoTxt: { fontSize: 13, color: c.textMuted, fontWeight: '600' },
    scroll: { flexGrow: 1, padding: 24, paddingBottom: 48 },
    etapa: { flex: 1, alignItems: 'center', paddingTop: 12 },
    stepLabel: { fontSize: 12, fontWeight: '700', color: '#5294ff', letterSpacing: 0.6, marginBottom: 8, textTransform: 'uppercase' },
    emoji: { fontSize: 44, marginBottom: 12 },
    titulo: { fontSize: 22, fontWeight: '700', color: c.text, textAlign: 'center', marginBottom: 12 },
    paragrafo: { fontSize: 14, color: c.textSec, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
    input: {
      width: '100%', backgroundColor: c.input, borderRadius: 14, borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: c.text, marginBottom: 12,
    },
    rowDois: { flexDirection: 'row', width: '100%', gap: 12 },
    inputMetade: { flex: 1 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, justifyContent: 'center' },
    chip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: c.border,
      backgroundColor: c.card,
    },
    chipAtivo: { backgroundColor: '#5294ff', borderColor: '#5294ff' },
    chipTxt: { fontSize: 13, color: c.textSec, fontWeight: '600' },
    chipTxtAtivo: { color: '#fff' },
    btnPrimario: {
      width: '100%', backgroundColor: '#5294ff', borderRadius: 14, paddingVertical: 16,
      alignItems: 'center', marginTop: 8,
    },
    btnPrimarioTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
    dica: { fontSize: 12, color: c.textMuted, textAlign: 'center', lineHeight: 17, marginTop: 4 },
    rodape: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20 },
    linkTxt: { fontSize: 13, color: c.textMuted, fontWeight: '600' },
    resumoBox: { width: '100%', backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.borderSoft, padding: 16, marginBottom: 16 },
    dicasFinaisTitulo: { fontSize: 13, fontWeight: '700', color: c.text, marginBottom: 12 },
    resumoLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
    resumoIcone: { fontSize: 15 },
    resumoTxt: { fontSize: 13, color: c.textSec, flex: 1, lineHeight: 18 },
    vozMicBtn: {
      width: 120, height: 120, borderRadius: 60, backgroundColor: '#5294ff',
      alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12,
    },
    vozMicBtnAtivo: { backgroundColor: '#f25555' },
    vozMicIco: { fontSize: 40 },
    vozMicTxt: { fontSize: 11, color: '#fff', fontWeight: '600' },
    vozTranscricaoBox: {
      width: '100%', minHeight: 56, backgroundColor: c.input, borderRadius: 14,
      borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center',
      padding: 14, marginBottom: 8,
    },
    vozTranscricaoTxt: { fontSize: 15, color: c.text, textAlign: 'center' },
    erroVoz: { fontSize: 12, color: '#f25555', textAlign: 'center', marginBottom: 8 },
  });
}
