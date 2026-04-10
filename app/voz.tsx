import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { carregarCategorias } from './categorias';
import { buscarContas, debitarConta } from './contas';
import { inserirLancamento, inserirLancamentosParcelados } from './database';

const CARTOES_KEY = '@financaspro:cartoes';

type Cartao = { id: string; apelido: string; bandeira: string; ultimos4: string; fechamento: string; vencimento: string; limite: string; };
type Conta = { id: string; nome: string; banco: string; tipo: string; saldo: string; };

type Etapa =
  | 'tipo' | 'descricao' | 'valor' | 'categoria'
  | 'formaPag' | 'cartao' | 'parcelas' | 'conta' | 'obs' | 'confirmacao';

type Lancamento = {
  tipo: 'despesa' | 'receita';
  descricao: string;
  valor: string;
  categoria: string;
  formaPag: string;
  cartaoId: string;
  cartaoNome: string;
  parcelas: string;
  contaId: string;
  contaNome: string;
  obs: string;
};

const PERGUNTAS: Record<Etapa, string> = {
  tipo:       'Este lançamento é uma despesa ou uma receita?',
  descricao:  'Qual é a descrição? Por exemplo: Supermercado X, Farmácia Y ou Juca Encanador.',
  valor:      'Qual é o valor?',
  categoria:  'Qual é a categoria? Por exemplo: Alimentação, Combustível, Saúde. Ou diga automático.',
  formaPag:   'Qual a forma de pagamento? Crédito, Débito, Pix, Dinheiro, Boleto ou Outro.',
  cartao:     'Qual cartão deseja usar?',
  parcelas:   'Quantas parcelas? Diga o número ou diga à vista.',
  conta:      'De qual conta será debitado?',
  obs:        'Alguma observação? Diga o que quiser ou diga não.',
  confirmacao: '',
};

const MAP_CATEGORIA: Record<string, string> = {
  mercado: 'Alimentação', supermercado: 'Alimentação', padaria: 'Alimentação',
  restaurante: 'Alimentação', lanche: 'Alimentação', comida: 'Alimentação',
  ifood: 'Alimentação', delivery: 'Alimentação',
  gasolina: 'Combustível', combustível: 'Combustível', posto: 'Combustível',
  uber: 'Transporte', ônibus: 'Transporte', metrô: 'Transporte',
  táxi: 'Transporte', estacionamento: 'Transporte', pedágio: 'Transporte',
  farmácia: 'Saúde', farmacia: 'Saúde', médico: 'Saúde',
  consulta: 'Saúde', remédio: 'Saúde', hospital: 'Saúde',
  netflix: 'Lazer', cinema: 'Lazer', show: 'Lazer', viagem: 'Lazer',
  luz: 'Moradia', água: 'Moradia', aluguel: 'Moradia',
  internet: 'Moradia', condomínio: 'Moradia',
  salário: 'Salário', salario: 'Salário', freelance: 'Freelance',
  oficina: 'Manutenção', mecânico: 'Manutenção', reparo: 'Manutenção',
  encanador: 'Manutenção', eletricista: 'Manutenção',
  escola: 'Educação', faculdade: 'Educação', curso: 'Educação',
  juros: 'Custos Financeiros', multa: 'Custos Financeiros', taxa: 'Custos Financeiros',
};

function detectarCategoria(descricao: string): string {
  const t = descricao.toLowerCase();
  for (const [palavra, cat] of Object.entries(MAP_CATEGORIA)) {
    if (t.includes(palavra)) return cat;
  }
  return '';
}

function interpretarValor(texto: string): string {
  const t = texto.toLowerCase()
    .replace('reais', '').replace('real', '').replace('r$', '').trim();
  const matchNum = t.match(/(\d+[\.,]?\d*)/);
  if (matchNum) return matchNum[1].replace(',', '.');
  const unidades: Record<string, number> = {
    'zero':0,'um':1,'uma':1,'dois':2,'duas':2,'três':3,'quatro':4,'cinco':5,
    'seis':6,'sete':7,'oito':8,'nove':9,'dez':10,'onze':11,'doze':12,
    'treze':13,'quatorze':14,'quinze':15,'dezesseis':16,'dezessete':17,
    'dezoito':18,'dezenove':19,'vinte':20,'trinta':30,'quarenta':40,
    'cinquenta':50,'sessenta':60,'setenta':70,'oitenta':80,'noventa':90,
    'cem':100,'cento':100,'duzentos':200,'trezentos':300,'quatrocentos':400,
    'quinhentos':500,'seiscentos':600,'setecentos':700,'oitocentos':800,
    'novecentos':900,'mil':1000,
  };
  let total = 0;
  for (const p of t.split(/\s+/)) {
    if (unidades[p] !== undefined) total += unidades[p];
  }
  return total > 0 ? String(total) : '';
}

function interpretarTipo(texto: string): 'despesa' | 'receita' | null {
  const t = texto.toLowerCase();
  if (t.includes('despesa') || t.includes('gasto') || t.includes('pagamento')) return 'despesa';
  if (t.includes('receita') || t.includes('receb') || t.includes('entrada') || t.includes('ganho')) return 'receita';
  return null;
}

function interpretarFormaPag(texto: string): string {
  const t = texto.toLowerCase();
  if (t.includes('crédito') || t.includes('credito')) return 'Credito';
  if (t.includes('débito') || t.includes('debito')) return 'Debito';
  if (t.includes('pix')) return 'Pix';
  if (t.includes('dinheiro') || t.includes('espécie')) return 'Dinheiro';
  if (t.includes('boleto')) return 'Boleto';
  if (t.includes('outro')) return 'Outro';
  return '';
}

function interpretarParcelas(texto: string): string {
  const t = texto.toLowerCase();
  if (t.includes('vista') || t.includes('uma') || t.includes('1')) return '1';
  const nums: Record<string, number> = {
    'duas':2,'dois':2,'três':3,'quatro':4,'cinco':5,'seis':6,
    'sete':7,'oito':8,'nove':9,'dez':10,'onze':11,'doze':12,
  };
  for (const [p, n] of Object.entries(nums)) {
    if (t.includes(p)) return String(n);
  }
  const match = t.match(/(\d+)/);
  return match ? match[1] : '1';
}

function hoje(): string {
  const d = new Date();
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
}

export default function VozScreen() {
  const [etapa, setEtapa] = useState<Etapa>('tipo');
  const [gravando, setGravando] = useState(false);
  const [transcricao, setTranscricao] = useState('');
  const [erro, setErro] = useState('');
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [categoriasDisp, setCategoriasDisp] = useState<string[]>([]);
  const [falando, setFalando] = useState(false);

  const [lancamento, setLancamento] = useState<Lancamento>({
    tipo: 'despesa', descricao: '', valor: '', categoria: '',
    formaPag: '', cartaoId: '', cartaoNome: '',
    parcelas: '1', contaId: '', contaNome: '', obs: '',
  });

  const textoFinal = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lancamentoRef = useRef(lancamento);

  useEffect(() => { lancamentoRef.current = lancamento; }, [lancamento]);

  useEffect(() => {
    AsyncStorage.getItem(CARTOES_KEY).then(v => { if (v) setCartoes(JSON.parse(v)); });
    buscarContas().then(setContas);
    carregarCategorias('despesa').then(setCategoriasDisp);
    setTimeout(() => falar(PERGUNTAS['tipo']), 500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); Speech.stop(); };
  }, []);

  function falar(texto: string) {
    setFalando(true);
    Speech.speak(texto, {
      language: 'pt-BR', rate: 0.95,
      onDone: () => { setFalando(false); iniciarGravacao(); },
      onError: () => { setFalando(false); iniciarGravacao(); },
    });
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
    if (textoFinal.current.trim()) processarResposta(textoFinal.current);
  });

  useSpeechRecognitionEvent('error', (event) => {
    setGravando(false);
    if (event.error === 'no-speech') setErro('Não ouvi nada. Tentando novamente...');
    else setErro('Erro no microfone. Tente novamente.');
    setTimeout(() => { setErro(''); iniciarGravacao(); }, 2000);
  });

  async function iniciarGravacao() {
    setErro(''); setTranscricao(''); textoFinal.current = '';
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) { Alert.alert('Permissão negada', 'Habilite o microfone.'); return; }
    ExpoSpeechRecognitionModule.start({ lang: 'pt-BR', interimResults: true, maxAlternatives: 1, continuous: true });
    setGravando(true);
    timerRef.current = setTimeout(() => ExpoSpeechRecognitionModule.stop(), 15000);
  }

  function pararGravacao() {
    if (timerRef.current) clearTimeout(timerRef.current);
    ExpoSpeechRecognitionModule.stop();
    setGravando(false);
  }

  function avancarEtapa(novaEtapa: Etapa, atualizacao: Partial<Lancamento>) {
    const novoLanc = { ...lancamentoRef.current, ...atualizacao };
    setLancamento(novoLanc);
    lancamentoRef.current = novoLanc;
    setTranscricao('');
    textoFinal.current = '';
    if (novaEtapa === 'confirmacao') { setEtapa('confirmacao'); return; }
    setEtapa(novaEtapa);
    setTimeout(() => {
      // Pergunta de conta: lista os nomes
      if (novaEtapa === 'conta') {
        const nomes = contas.map(c => c.nome).join(', ');
        falar(`De qual conta será debitado? Você tem: ${nomes}.`);
      } else if (novaEtapa === 'cartao') {
        const nomes = cartoes.map(c => c.apelido).join(', ');
        falar(`Qual cartão deseja usar? Você tem: ${nomes}.`);
      } else {
        falar(PERGUNTAS[novaEtapa]);
      }
    }, 300);
  }

  function processarResposta(texto: string) {
    const t = texto.toLowerCase().trim();
    const l = lancamentoRef.current;

    switch (etapa) {
      case 'tipo': {
        const tipo = interpretarTipo(t);
        if (!tipo) { falar('Não entendi. ' + PERGUNTAS['tipo']); return; }
        avancarEtapa('descricao', { tipo });
        break;
      }

      case 'descricao': {
        if (!t) { falar('Não ouvi a descrição. ' + PERGUNTAS['descricao']); return; }
        const descricao = texto.charAt(0).toUpperCase() + texto.slice(1);
        const catAuto = detectarCategoria(texto);
        avancarEtapa('valor', { descricao, categoria: catAuto });
        break;
      }

      case 'valor': {
        const valor = interpretarValor(texto);
        if (!valor || valor === '0') { falar('Não entendi o valor. ' + PERGUNTAS['valor']); return; }
        // Se categoria já detectada automaticamente, pula pergunta de categoria
        if (l.categoria) {
          avancarEtapa('formaPag', { valor });
        } else {
          avancarEtapa('categoria', { valor });
        }
        break;
      }

      case 'categoria': {
        let categoria = '';
        if (t.includes('automático') || t.includes('automatico') || t.includes('auto')) {
          categoria = detectarCategoria(l.descricao) || 'Outros';
        } else {
          categoria = categoriasDisp.find(c => t.includes(c.toLowerCase())) || texto;
        }
        avancarEtapa('formaPag', { categoria });
        break;
      }

      case 'formaPag': {
        const formaPag = interpretarFormaPag(t);
        if (!formaPag) { falar('Não entendi. ' + PERGUNTAS['formaPag']); return; }

        if (formaPag === 'Credito') {
          if (cartoes.length > 0) {
            avancarEtapa('cartao', { formaPag });
          } else {
            // Sem cartões cadastrados — pula para obs
            avancarEtapa('obs', { formaPag, cartaoId: '', cartaoNome: '', parcelas: '1' });
          }
          return;
        }

        if ((formaPag === 'Debito' || formaPag === 'Pix') && contas.length > 0) {
          avancarEtapa('conta', { formaPag, cartaoId: '', cartaoNome: '', parcelas: '1' });
          return;
        }

        // Dinheiro, Boleto, Outro ou Débito/Pix sem contas cadastradas
        avancarEtapa('obs', { formaPag, cartaoId: '', cartaoNome: '', parcelas: '1', contaId: '', contaNome: '' });
        break;
      }

      case 'cartao': {
        const cartao = cartoes.find(c =>
          t.includes(c.apelido.toLowerCase()) ||
          t.includes(c.ultimos4) ||
          t.includes(c.bandeira.toLowerCase())
        ) || cartoes[0];
        avancarEtapa('parcelas', { cartaoId: cartao.id, cartaoNome: cartao.apelido });
        break;
      }

      case 'parcelas': {
        const parcelas = interpretarParcelas(t);
        avancarEtapa('obs', { parcelas });
        break;
      }

      case 'conta': {
        // Tenta identificar a conta pelo nome ou banco
        const conta = contas.find(c =>
          t.includes(c.nome.toLowerCase()) ||
          t.includes(c.banco.toLowerCase())
        ) || null;

        if (t.includes('nenhuma') || t.includes('nao') || t.includes('não') || t.includes('pular')) {
          avancarEtapa('obs', { contaId: '', contaNome: '' });
        } else if (conta) {
          avancarEtapa('obs', { contaId: conta.id, contaNome: conta.nome });
        } else {
          // Não identificou — usa a primeira conta ou pula
          if (contas.length === 1) {
            avancarEtapa('obs', { contaId: contas[0].id, contaNome: contas[0].nome });
          } else {
            falar('Não identifiquei a conta. Tente novamente ou diga não para pular.');
            iniciarGravacao();
          }
        }
        break;
      }

      case 'obs': {
        const obs = (t === 'não' || t === 'nao' || t === 'nenhuma' || t === 'nada' || t === 'não tenho') ? '' : texto;
        avancarEtapa('confirmacao', { obs });
        break;
      }
    }
  }

  async function salvarDireto() {
    const l = lancamentoRef.current;
    const valorNum = parseFloat(l.valor.replace(',', '.'));
    const totalParcelas = parseInt(l.parcelas) || 1;

    if (l.formaPag === 'Credito' && l.cartaoId && totalParcelas > 1) {
      const cartao = cartoes.find(c => c.id === l.cartaoId);
      inserirLancamentosParcelados({
        descricao: l.descricao, valorTotal: valorNum,
        categoria: l.categoria, formaPag: l.formaPag,
        cartaoId: l.cartaoId, totalParcelas,
        dataCompra: hoje(),
        diaVencimento: parseInt(cartao?.vencimento || '20'),
        diaFechamento: parseInt(cartao?.fechamento || '10'),
        status: 'parcelado', obs: l.obs, tipo: l.tipo,
      });
    } else {
      inserirLancamento({
        id: Date.now().toString(), tipo: l.tipo,
        descricao: l.descricao, valor: valorNum,
        categoria: l.categoria, formaPag: l.formaPag,
        cartaoId: l.cartaoId, parcelas: totalParcelas,
        parcelaAtual: 1, totalParcelas,
        data: hoje(), dataVencimento: hoje(),
        status: l.formaPag === 'Credito' && totalParcelas === 1 ? 'parcelado' : 'pago',
        obs: l.obs, grupoId: '',
      });
    }

    // Debita da conta se selecionada (Débito ou Pix)
    if (l.contaId && (l.formaPag === 'Debito' || l.formaPag === 'Pix')) {
      await debitarConta(l.contaId, valorNum);
    }

    Speech.speak('Lançamento salvo com sucesso!', { language: 'pt-BR' });
    router.replace('/(tabs)/lancamentos');
  }

  function reiniciar() {
    Speech.stop();
    setEtapa('tipo');
    setTranscricao('');
    setErro('');
    setLancamento({
      tipo: 'despesa', descricao: '', valor: '', categoria: '',
      formaPag: '', cartaoId: '', cartaoNome: '',
      parcelas: '1', contaId: '', contaNome: '', obs: '',
    });
    setTimeout(() => falar(PERGUNTAS['tipo']), 300);
  }

  const fmt = (v: string) => {
    const n = parseFloat(v.replace(',', '.'));
    return isNaN(n) ? v : 'R$ ' + n.toFixed(2).replace('.', ',');
  };

  const ETAPAS_LISTA: Etapa[] = ['tipo','descricao','valor','categoria','formaPag','cartao','parcelas','conta','obs'];
  const ETAPA_LABEL: Record<Etapa, string> = {
    tipo: '1. Tipo', descricao: '2. Descrição', valor: '3. Valor',
    categoria: '4. Categoria', formaPag: '5. Pagamento',
    cartao: '6. Cartão', parcelas: '7. Parcelas',
    conta: '6. Conta', obs: '8. Observação', confirmacao: '✅ Confirmação',
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => { Speech.stop(); router.back(); }} style={s.backBtn}>
          <Text style={s.backTxt}>Voltar</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Lançamento por Voz</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={s.body}>

        {/* Progresso */}
        {etapa !== 'confirmacao' && (
          <View style={s.progressCard}>
            <Text style={s.progressLbl}>{ETAPA_LABEL[etapa]}</Text>
            <View style={s.progressBar}>
              {ETAPAS_LISTA.map((e, i) => (
                <View key={e} style={[
                  s.progressDot,
                  etapa === e && s.progressDotOn,
                  ETAPAS_LISTA.indexOf(etapa) > i && s.progressDotDone
                ]} />
              ))}
            </View>
          </View>
        )}

        {/* Pergunta atual */}
        {etapa !== 'confirmacao' && (
          <View style={s.perguntaCard}>
            {falando && <Text style={s.falandoLbl}>🔊 Perguntando...</Text>}
            <Text style={s.perguntaTxt}>{PERGUNTAS[etapa]}</Text>

            {lancamento.tipo && etapa !== 'tipo' && (
              <Text style={s.coletado}>Tipo: <Text style={s.coletadoVal}>{lancamento.tipo === 'despesa' ? '📉 Despesa' : '📈 Receita'}</Text></Text>
            )}
            {lancamento.descricao && etapa !== 'descricao' && (
              <Text style={s.coletado}>Descrição: <Text style={s.coletadoVal}>{lancamento.descricao}</Text></Text>
            )}
            {lancamento.valor && etapa !== 'valor' && (
              <Text style={s.coletado}>Valor: <Text style={s.coletadoVal}>{fmt(lancamento.valor)}</Text></Text>
            )}
            {lancamento.categoria && (etapa === 'formaPag' || etapa === 'cartao' || etapa === 'parcelas' || etapa === 'conta' || etapa === 'obs') && (
              <Text style={s.coletado}>Categoria: <Text style={s.coletadoVal}>{lancamento.categoria} ⚡</Text></Text>
            )}
            {lancamento.formaPag && (etapa === 'cartao' || etapa === 'parcelas' || etapa === 'conta' || etapa === 'obs') && (
              <Text style={s.coletado}>Pagamento: <Text style={s.coletadoVal}>{lancamento.formaPag}</Text></Text>
            )}
            {lancamento.cartaoNome && (etapa === 'parcelas' || etapa === 'obs') && (
              <Text style={s.coletado}>Cartão: <Text style={s.coletadoVal}>{lancamento.cartaoNome}</Text></Text>
            )}
            {lancamento.contaNome && etapa === 'obs' && (
              <Text style={s.coletado}>Conta: <Text style={s.coletadoVal}>{lancamento.contaNome}</Text></Text>
            )}
          </View>
        )}

        {/* Transcrição */}
        {gravando && (
          <View style={s.transcricaoCard}>
            <Text style={s.transcricaoLbl}>🔴 Ouvindo...</Text>
            <Text style={s.transcricaoTxt}>{transcricao || '...'}</Text>
          </View>
        )}

        {/* Erro */}
        {erro ? <View style={s.erroCard}><Text style={s.erroTxt}>⚠️ {erro}</Text></View> : null}

        {/* Confirmação */}
        {etapa === 'confirmacao' && (
          <View style={s.confirmCard}>
            <Text style={s.confirmTitle}>✅ Conferência final</Text>
            <View style={s.confirmRow}>
              <Text style={s.confirmLbl}>Tipo</Text>
              <Text style={[s.confirmVal, { color: lancamento.tipo === 'receita' ? '#25d07e' : '#f25555' }]}>
                {lancamento.tipo === 'receita' ? '📈 Receita' : '📉 Despesa'}
              </Text>
            </View>
            <View style={s.confirmRow}>
              <Text style={s.confirmLbl}>Descrição</Text>
              <Text style={s.confirmVal}>{lancamento.descricao}</Text>
            </View>
            <View style={s.confirmRow}>
              <Text style={s.confirmLbl}>Valor</Text>
              <Text style={s.confirmVal}>{fmt(lancamento.valor)}</Text>
            </View>
            <View style={s.confirmRow}>
              <Text style={s.confirmLbl}>Categoria</Text>
              <Text style={s.confirmVal}>{lancamento.categoria || '—'}</Text>
            </View>
            <View style={s.confirmRow}>
              <Text style={s.confirmLbl}>Forma de pag.</Text>
              <Text style={s.confirmVal}>{lancamento.formaPag}</Text>
            </View>
            {lancamento.cartaoNome ? (
              <View style={s.confirmRow}>
                <Text style={s.confirmLbl}>Cartão</Text>
                <Text style={s.confirmVal}>{lancamento.cartaoNome}</Text>
              </View>
            ) : null}
            {parseInt(lancamento.parcelas) > 1 ? (
              <View style={s.confirmRow}>
                <Text style={s.confirmLbl}>Parcelas</Text>
                <Text style={s.confirmVal}>{lancamento.parcelas}x</Text>
              </View>
            ) : null}
            {lancamento.contaNome ? (
              <View style={s.confirmRow}>
                <Text style={s.confirmLbl}>Conta debitada</Text>
                <Text style={s.confirmVal}>{lancamento.contaNome}</Text>
              </View>
            ) : null}
            {lancamento.obs ? (
              <View style={s.confirmRow}>
                <Text style={s.confirmLbl}>Observação</Text>
                <Text style={s.confirmVal}>{lancamento.obs}</Text>
              </View>
            ) : null}
            <View style={s.confirmRow}>
              <Text style={s.confirmLbl}>Data</Text>
              <Text style={s.confirmVal}>{hoje()}</Text>
            </View>

            <View style={s.confirmBtns}>
              <TouchableOpacity style={s.btnReiniciar} onPress={reiniciar}>
                <Text style={s.btnReiniciarTxt}>🎤 Refazer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSalvar} onPress={salvarDireto}>
                <Text style={s.btnSalvarTxt}>💾 Salvar →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Botão microfone */}
        {etapa !== 'confirmacao' && !falando && (
          <TouchableOpacity
            style={[s.micBtn, gravando && s.micBtnGravando]}
            onPress={gravando ? pararGravacao : iniciarGravacao}
            activeOpacity={0.8}
          >
            <Text style={s.micIco}>{gravando ? '⏹' : '🎤'}</Text>
            <Text style={s.micTxt}>{gravando ? 'Toque para parar' : 'Toque para falar'}</Text>
          </TouchableOpacity>
        )}

        {falando && (
          <View style={s.falandoBtn}>
            <Text style={s.falandoBtnTxt}>🔊 Aguarde...</Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12151e' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  backBtn: { padding: 4, width: 60 },
  backTxt: { fontSize: 16, color: '#5294ff', fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#f0f3ff' },
  body: { padding: 20, gap: 16, paddingBottom: 60 },

  progressCard: { backgroundColor: '#1c2133', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  progressLbl: { fontSize: 13, color: '#5294ff', fontWeight: '700', marginBottom: 10 },
  progressBar: { flexDirection: 'row', gap: 6 },
  progressDot: { flex: 1, height: 4, borderRadius: 4, backgroundColor: '#2a3148' },
  progressDotOn: { backgroundColor: '#5294ff' },
  progressDotDone: { backgroundColor: '#25d07e' },

  perguntaCard: { backgroundColor: '#1c2133', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: 'rgba(82,148,255,0.2)' },
  falandoLbl: { fontSize: 11, color: '#5294ff', fontWeight: '600', marginBottom: 6 },
  perguntaTxt: { fontSize: 16, color: '#f0f3ff', fontWeight: '600', lineHeight: 24, marginBottom: 12 },
  coletado: { fontSize: 12, color: '#6b779a', marginTop: 4 },
  coletadoVal: { color: '#aab4d0', fontWeight: '600' },

  transcricaoCard: { backgroundColor: '#1c2133', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(82,148,255,0.3)', alignItems: 'center' },
  transcricaoLbl: { fontSize: 12, color: '#f25555', fontWeight: '600', marginBottom: 6 },
  transcricaoTxt: { fontSize: 16, color: '#f0f3ff', textAlign: 'center', lineHeight: 24 },

  erroCard: { backgroundColor: 'rgba(242,85,85,0.1)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(242,85,85,0.3)' },
  erroTxt: { fontSize: 13, color: '#f25555', textAlign: 'center' },

  confirmCard: { backgroundColor: '#1c2133', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: 'rgba(37,208,126,0.3)' },
  confirmTitle: { fontSize: 16, fontWeight: '700', color: '#25d07e', marginBottom: 16 },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  confirmLbl: { fontSize: 13, color: '#6b779a' },
  confirmVal: { fontSize: 13, color: '#f0f3ff', fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  confirmBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnReiniciar: { flex: 1, padding: 13, backgroundColor: '#2a3148', borderRadius: 11, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  btnReiniciarTxt: { fontSize: 13, color: '#aab4d0', fontWeight: '600' },
  btnSalvar: { flex: 1, padding: 13, backgroundColor: '#25d07e', borderRadius: 11, alignItems: 'center' },
  btnSalvarTxt: { fontSize: 13, color: '#fff', fontWeight: '700' },

  micBtn: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#5294ff', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'center' },
  micBtnGravando: { backgroundColor: '#f25555' },
  micIco: { fontSize: 48 },
  micTxt: { fontSize: 12, color: '#fff', fontWeight: '600' },

  falandoBtn: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#2a3148', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', borderWidth: 2, borderColor: '#5294ff' },
  falandoBtnTxt: { fontSize: 14, color: '#5294ff', fontWeight: '600' },
});