import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { carregarCategorias } from './categorias';
import { buscarContas, creditarConta, debitarConta } from './contas';
import { buscarCartoes, buscarLancamentos, gerarId, inserirLancamento, inserirLancamentosParcelados } from './database';
import { agendarNotificacoesVencimento, verificarAlertaOrcamento, resetarLembreteMotivacional } from './notificacoes';
import HelpModal, { helpBtnStyle, helpTxtStyle } from './HelpModal';
import { Colors, useTheme } from './theme';

const DESBLOQUEADO_KEY = '@faladinheiro:desbloqueado';
const LIMITE_GRATIS = 150;
const PRIMEIRO_LANCAMENTO_KEY = '@faladinheiro:primeiroLancamento';
const LIMITE_DIAS = 30;

type Cartao = { id: string; apelido: string; bandeira: string; ultimos4: string; fechamento: string; vencimento: string; limite: string; };
type Conta = { id: string; nome: string; banco: string; tipo: string; saldo: string; };
type Etapa = 'tipo' | 'descricao' | 'valor' | 'categoria' | 'formaPag' | 'cartao' | 'parcelas' | 'conta' | 'contaReceita' | 'obs' | 'confirmacao';
type Lancamento = {
  tipo: 'despesa' | 'receita';
  descricao: string; valor: string; categoria: string;
  formaPag: string; cartaoId: string; cartaoNome: string;
  parcelas: string; contaId: string; contaNome: string; obs: string;
};

const PERGUNTAS_CURTAS: Record<Etapa, string> = {
  tipo: 'Despesa ou receita?',
  descricao: 'Descrição?',
  valor: 'Valor?',
  categoria: 'Categoria?',
  formaPag: 'Forma de pagamento?',
  cartao: 'Qual cartão?',
  parcelas: 'Parcelas?',
  conta: 'Qual conta?',
  contaReceita: 'Conta que recebeu?',
  obs: 'Observação?',
  confirmacao: '',
};

const MAP_CATEGORIA: Record<string, string> = {
  mercado: 'Mercado', supermercado: 'Mercado', armazem: 'Mercado', armazém: 'Mercado',
  mercadinho: 'Mercado', hipermercado: 'Mercado',
  restaurante: 'Alimentação', lanche: 'Alimentação', comida: 'Alimentação',
  ifood: 'Alimentação', delivery: 'Alimentação', alimentacao: 'Alimentação',
  alimentação: 'Alimentação', padaria: 'Alimentação', cafe: 'Alimentação',
  café: 'Alimentação', pizzaria: 'Alimentação', hamburger: 'Alimentação',
  uber: 'Transporte', onibus: 'Transporte', ônibus: 'Transporte',
  metro: 'Transporte', metrô: 'Transporte', taxi: 'Transporte', táxi: 'Transporte',
  estacionamento: 'Transporte', pedagio: 'Transporte', pedágio: 'Transporte',
  gasolina: 'Transporte', combustivel: 'Transporte', combustível: 'Transporte',
  posto: 'Transporte', etanol: 'Transporte', diesel: 'Transporte',
  farmacia: 'Saúde', farmácia: 'Saúde', drogaria: 'Saúde', drogarias: 'Saúde',
  medico: 'Saúde', médico: 'Saúde', consulta: 'Saúde', remedio: 'Saúde',
  remédio: 'Saúde', hospital: 'Saúde', clinica: 'Saúde', clínica: 'Saúde',
  netflix: 'Lazer', spotify: 'Lazer', cinema: 'Lazer', show: 'Lazer',
  viagem: 'Lazer', passagem: 'Lazer', hotel: 'Lazer', lazer: 'Lazer', assinatura: 'Lazer',
  luz: 'Moradia', energia: 'Moradia', agua: 'Moradia', água: 'Moradia',
  aluguel: 'Moradia', internet: 'Moradia', condominio: 'Moradia',
  condomínio: 'Moradia', moradia: 'Moradia',
  escola: 'Educação', faculdade: 'Educação', curso: 'Educação',
  educacao: 'Educação', educação: 'Educação',
  oficina: 'Serviços', mecanico: 'Serviços', mecânico: 'Serviços',
  reparo: 'Serviços', encanador: 'Serviços', eletricista: 'Serviços',
  manutencao: 'Serviços', manutenção: 'Serviços', advogado: 'Serviços',
  contador: 'Serviços', servico: 'Serviços', serviço: 'Serviços',
  roupa: 'Vestuário', calcado: 'Vestuário', calçado: 'Vestuário',
  vestuario: 'Vestuário', vestuário: 'Vestuário',
  juros: 'Finanças', multa: 'Finanças', imposto: 'Finanças',
  ir: 'Finanças', iptu: 'Finanças', ipva: 'Finanças',
  tributo: 'Finanças', darf: 'Finanças', taxa: 'Finanças',
  emprestimo: 'Finanças', empréstimo: 'Finanças', financiamento: 'Finanças',
  investimento: 'Investimentos', poupanca: 'Investimentos', poupança: 'Investimentos',
  vendas: 'Vendas', venda: 'Vendas',
  salario: 'Salário', salário: 'Salário', freelance: 'Freelance',
};

// ─── helpers ────────────────────────────────────────────────────────────────

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function capitalizarPalavras(texto: string): string {
  return texto.toLowerCase().split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function detectarCategoria(descricao: string): string {
  const t = normalizar(descricao);
  for (const [palavra, cat] of Object.entries(MAP_CATEGORIA)) {
    const p = normalizar(palavra);
    if (new RegExp(`\\b${p}\\b`).test(t)) return cat;
  }
  return '';
}

// ─── Extenso → número ────────────────────────────────────────────────────────
// Dicionário de palavras numéricas (normalizado sem acentos)
const PALAVRAS_NUM: Record<string, number> = {
  zero: 0,
  um: 1, uma: 1, dois: 2, duas: 2,
  tres: 3, trez: 3, treis: 3, tree: 3, tri: 3,
  quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14,
  quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50,
  sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, sem: 100, cento: 100,
  duzentos: 200, duzentas: 200,
  trezentos: 300, trezentas: 300,
  quatrocentos: 400, quatrocentas: 400,
  quinhentos: 500, quinhentas: 500,
  seiscentos: 600, seiscentas: 600,
  setecentos: 700, setecentas: 700,
  oitocentos: 800, oitocentas: 800,
  novecentos: 900, novecentas: 900,
  mil: 1_000,
  milhao: 1_000_000, milhoes: 1_000_000,
};

/**
 * Soma tokens de extenso (palavras E dígitos) em um valor inteiro.
 * Aceita mistura dígito+palavra: ["10","mil"] → 10000, ["dez","mil"] → 10000.
 * Tokens "e" e "com" são ignorados como conectores.
 *
 * Casos de teste:
 *   ["dez","mil"]              → 10000
 *   ["10","mil"]               → 10000  ← fix: dígito como multiplicador
 *   ["vinte","mil"]            → 20000
 *   ["5","mil"]                → 5000   ← fix
 *   ["dois","mil","trezentos"] → 2300
 *   ["2","mil","300"]          → 2300   ← fix
 *   ["trezentos","cinquenta"]  → 350
 *   ["mil","quinhentos"]       → 1500
 *   ["um","milhao"]            → 1000000
 *   ["1","milhao"]             → 1000000 ← fix
 */
function somarExtenso(tokens: string[]): number {
  let total = 0;
  let atual = 0;
  for (const tok of tokens) {
    if (!tok || tok === 'e' || tok === 'com') continue;
    const fromDict = PALAVRAS_NUM[tok];
    const fromInt  = parseInt(tok, 10);
    const n = fromDict !== undefined ? fromDict : (!isNaN(fromInt) ? fromInt : undefined);
    if (n === undefined) continue;
    if (n >= 1_000_000) { total += (atual || 1) * n; atual = 0; }
    else if (n === 1000) { total += (atual || 1) * 1000; atual = 0; }
    else                 { atual += n; }
  }
  return total + atual;
}

/**
 * Interpreta valores falados em português.
 * Suporta:
 *  - números diretos: "50", "150,30", "R$ 45"
 *  - por extenso puro: "cem", "dez mil", "dois mil e trezentos"
 *  - misto dígito+extenso: "10 mil", "5 mil", "2 mil e 300"
 *  - milhão: "um milhão", "1 milhão e 500 mil"
 *  - centavos: "cem reais e quinze centavos"
 *  - separadores de centavos: "258 com 52", "258 e 52", "258 vírgula 52", "258 52"
 */
function interpretarValor(texto: string): string {
  let t = texto.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/r\$/g, '')
    .replace(/reais?/g, '')
    .replace(/centavos?/g, ' centavos')
    .trim();

  // Separadores de centavos: "258 com 52", "258 e 52", "258 vírgula 52", "258 52"
  // Deve vir antes de semEspaco para evitar que "258 52" vire "25852"
  const matchSepCents = t.match(/^(\d+)\s+(?:(?:com|e|virgula|ponto)\s+)?(\d{1,2})$/);
  if (matchSepCents) return `${matchSepCents[1]}.${matchSepCents[2].padEnd(2, '0')}`;

  // Tenta número direto com até 2 casas decimais.
  // IMPORTANTE: \d* permitia "10.000" bater aqui antes do matchMilhar → retornava 10 em vez de 10000.
  // /^(\d+(?:\.\d{1,2})?)$/ restringe a 0–2 casas, deixando "10.000" cair no matchMilhar abaixo.
  const semEspaco = t.replace(/\s/g, '').replace(',', '.');
  const matchDireto = semEspaco.match(/^(\d+(?:\.\d{1,2})?)$/);
  if (matchDireto) return matchDireto[1];

  // Separador de milhar europeu: "1.200" → 1200, "1.200,50" → 1200.50
  const matchMilhar = t.match(/^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/);
  if (matchMilhar) {
    const inteiro = matchMilhar[1].replace(/\./g, '');
    const cents = matchMilhar[2] ? matchMilhar[2].padEnd(2, '0') : '';
    return cents ? `${inteiro}.${cents}` : inteiro;
  }

  // Tenta padrão "X,YY" com casas decimais — lookahead evita capturar separador de milhar
  const matchDecimal = t.match(/(\d+)[,.](\d{1,2})(?!\d)/);
  if (matchDecimal) return `${matchDecimal[1]}.${matchDecimal[2].padEnd(2, '0')}`;

  // Extenso: separa parte de reais e centavos, converte com somarExtenso
  const temCentavos = t.includes('centavos');
  let parteReais = t;
  let parteCentavos = '';

  if (temCentavos) {
    // 1ª prioridade: duplo espaço criado ao remover "reais" (ex: "cem reais e quinze centavos" → "cem  e quinze  centavos")
    const sepDouble = t.match(/^(.*?)\s{2,}(?:(?:e|com|virgula|ponto|,)\s+)?(.*?)\s*centavos/);
    if (sepDouble && sepDouble[2]) {
      parteReais    = sepDouble[1].trim();
      parteCentavos = sepDouble[2].trim();
    } else {
      // 2ª prioridade: conector explícito sem "reais" (ex: "dez mil e quinze centavos")
      // Busca gananciosa captura o ÚLTIMO conector antes de centavos
      const sepConn = t.match(/^(.*)\s+(?:e|com|virgula|ponto)\s+(.*?)\s*centavos/);
      if (sepConn) {
        parteReais    = sepConn[1].trim();
        parteCentavos = sepConn[2].trim();
      } else {
        // Só centavos sem reais (ex: "quinze centavos")
        parteReais    = '';
        parteCentavos = t.replace(/\s*centavos.*$/, '').trim();
      }
    }
  }

  const valorReais    = somarExtenso(parteReais.split(/\s+/));
  const valorCentavos = parteCentavos ? somarExtenso(parteCentavos.split(/\s+/)) : 0;

  if (valorReais > 0 || valorCentavos > 0) {
    const resultado = valorReais + valorCentavos / 100;
    return resultado.toFixed(2).replace(/\.?0+$/, '') || String(resultado);
  }

  return '';
}

function interpretarTipo(texto: string): 'despesa' | 'receita' | null {
  const t = normalizar(texto);
  if (t.includes('despesa') || t.includes('gasto') || t.includes('pagamento') || t.includes('despeza')) return 'despesa';
  if (t.includes('receita') || t.includes('receb') || t.includes('entrada') || t.includes('ganho') || t.includes('renda') || t.includes('receite')) return 'receita';
  return null;
}

// Detecta Pix em todas as variações fonéticas que o Speech pt-BR pode transcrever
function ehPix(t: string): boolean {
  return (
    t === 'pi' || t === 'pí' ||
    t.match(/\bpi[xks]\b/) !== null ||
    t.match(/\bp[ií]x/) !== null ||
    t.includes('pix')   || t.includes('pics')   || t.includes('pis')   ||
    t.includes('pik')   || t.includes('piks')   || t.includes('pixs')  ||
    t.includes('pique') || t.includes('pick')   || t.includes('pyx')   ||
    t.includes('pex')   || t.includes('pixi')   || t.includes('pixe')  ||
    t.includes('pichi') || t.includes('pich')   || t.includes('pixar') ||
    t.includes('pixou') || t.includes('bix')    || t.includes('fix')   ||
    t.includes('pixici')|| t.includes('piquici')|| t.includes('phix')
  );
}

function interpretarFormaPag(texto: string): string {
  const t = normalizar(texto);
  if (t.includes('credito') || t.includes('cartao') || t.includes('cartão')) return 'Credito';
  if (t.includes('debito') || t.includes('debto') || t.includes('debico')) return 'Debito';
  if (ehPix(t)) return 'Pix';
  if (t.includes('dinheiro') || t.includes('especie') || t.includes('cash') || t.includes('espécie') || t.includes('dinhero')) return 'Dinheiro';
  if (t.includes('boleto') || t.includes('boletos') || t.includes('boletu')) return 'Boleto';
  if (t.includes('deposito') || t.includes('depósito') || t.includes('depositar')) return 'Depósito';
  if (t.includes('transferencia') || t.includes('transferência') || t.includes('ted') || t.includes('doc')) return 'Transferência';
  if (t.includes('outro')) return 'Outro';
  return '';
}

// Formas de pagamento aceitas para receitas
function interpretarFormaPagReceita(texto: string): string {
  const t = normalizar(texto);
  if (ehPix(t)) return 'Pix';
  if (t.includes('deposito') || t.includes('depositar') || t.includes('depósito')) return 'Depósito';
  if (t.includes('transferencia') || t.includes('transferência') || t.includes('ted') || t.includes('doc')) return 'Transferência';
  if (t.includes('dinheiro') || t.includes('especie') || t.includes('cash')) return 'Dinheiro';
  return '';
}

function interpretarParcelas(texto: string): string {
  const t = normalizar(texto);
  if (
    t.includes('vista') || t.includes('uma vez') || t === 'um' || t === '1' ||
    t.includes('unico') || t.includes('único') || t.includes('uma parcela') ||
    t.includes('uma so') || t.includes('uma só')
  ) return '1';
  const nums: Record<string, number> = {
    duas: 2, dois: 2,
    tres: 3, três: 3, trez: 3, treis: 3, tree: 3, tri: 3,
    quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
    onze: 11, doze: 12, quinze: 15, dezoito: 18, vinte: 20,
  };
  for (const [p, n] of Object.entries(nums)) {
    if (t.includes(p)) return String(n);
  }
  const match = t.match(/(\d+)/);
  return match ? match[1] : '1';
}

function hoje(): string {
  const d = new Date();
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

const PALAVRAS_NEGACAO = ['não', 'nao', 'nãoo', 'naoo', 'nan', 'num', 'non', 'nop', 'nope', 'negativo', 'nenhuma', 'nada', 'zero', 'pular', 'sem', 'none'];

// ─── dicas de pronúncia ─────────────────────────────────────────────────────

const DICAS = [
  { titulo: '🎙 Aguarde um instante', texto: 'O app precisa de um momento para ativar o microfone. Aguarde antes de falar.' },
  { titulo: '💰 Valores por extenso', texto: 'Diga o valor por extenso: "cinquenta reais", "cento e vinte reais e cinquenta centavos", "dois mil e trezentos". Evite falar apenas números isolados.' },
  { titulo: '💳 Formas de pagamento', texto: 'Diga: "pix", "crédito", "débito", "dinheiro", "boleto", "transferência" ou "depósito". O app reconhece variações como "cartão", "cartão de crédito", "à vista".' },
  { titulo: '🏷️ Cartões e contas', texto: 'Use apelidos simples como "Nubank" ou "Itaú" — não é necessário informar número, bandeira ou dados reais. O app busca pelo nome que você cadastrou.' },
  { titulo: '📂 Categorias', texto: 'Na etapa de categoria, diga o nome da categoria (ex: "Supermercado", "Saúde") ou diga "automático" para o app detectar pela descrição. Ex: "mercado" já sugere Supermercado.' },
  { titulo: '🔢 Parcelas', texto: 'Diga o número de parcelas por extenso: "três", "seis", "doze". Para pagamento único diga "um" ou "à vista". Parcelamento só funciona com cartão de crédito.' },
  { titulo: '✅ Observações', texto: 'Na etapa de observações, diga qualquer anotação que queira registrar. Diga "não" para pular esta etapa e ir direto para a confirmação.' },
  { titulo: '🎙️ Dica de dispositivo', texto: 'Cada aparelho reconhece voz de forma diferente. Se o app disser "Não entendi", tente falar mais devagar, mais alto ou use palavras alternativas para o mesmo comando.' },
  { titulo: '👁 Olhe a tela nas primeiras vezes', texto: 'O app exibe na tela o que entendeu de cada etapa. Nas primeiras vezes, acompanhe visualmente para aprender o ritmo certo.' },
  { titulo: '🐢 Velocidade da voz', texto: 'Nas configurações você pode ajustar a velocidade da voz do app: Lenta, Normal ou Rápida. Se a voz estiver muito rápida, reduza nas configurações.' },
];

// ─── componente principal ───────────────────────────────────────────────────

export default function VozScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [helpVisible, setHelpVisible] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>('tipo');
  const [gravando, setGravando] = useState(false);
  const [transcricao, setTranscricao] = useState('');
  const [erro, setErro] = useState('');
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [categoriasDisp, setCategoriasDisp] = useState<string[]>([]);
  const [categoriasRec, setCategoriasRec] = useState<string[]>([]);
  const [falando, setFalando] = useState(false);
  const [dicasExpandidas, setDicasExpandidas] = useState(false);

  const jaProcessou = useRef(false);

  const [lancamento, setLancamento] = useState<Lancamento>({
    tipo: 'despesa', descricao: '', valor: '', categoria: '',
    formaPag: '', cartaoId: '', cartaoNome: '', parcelas: '1',
    contaId: '', contaNome: '', obs: '',
  });

  const textoFinal = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lancamentoRef = useRef(lancamento);
  const etapaRef = useRef<Etapa>('tipo');
  const cartoesRef = useRef<Cartao[]>([]);
  const contasRef = useRef<Conta[]>([]);
  const categoriasDispRef = useRef<string[]>([]);
  const categoriasRecRef  = useRef<string[]>([]);
  const vozVelocidadeRef = useRef(1.3);
  const vozPedirCategoriaRef = useRef(true);
  const vozPedirObservacaoRef = useRef(true);
  const gravacaoAtiva = useRef(false);
  const historicoEtapas = useRef<Etapa[]>([]);

  useEffect(() => { lancamentoRef.current = lancamento; }, [lancamento]);
  useEffect(() => { etapaRef.current = etapa; }, [etapa]);
  useEffect(() => { cartoesRef.current = cartoes; }, [cartoes]);
  useEffect(() => { contasRef.current = contas; }, [contas]);
  useEffect(() => { categoriasDispRef.current = categoriasDisp; }, [categoriasDisp]);
  useEffect(() => { categoriasRecRef.current  = categoriasRec;  }, [categoriasRec]);

  useEffect(() => {
    AsyncStorage.getItem('@financaspro:vozVelocidade').then(v => {
      if (v) vozVelocidadeRef.current = parseFloat(v);
    });
    const cs = buscarCartoes();
    setCartoes(cs);
    cartoesRef.current = cs;
    buscarContas().then(cs2 => { setContas(cs2); contasRef.current = cs2; });
    carregarCategorias('despesa').then(setCategoriasDisp);
    carregarCategorias('receita').then(setCategoriasRec);
    setTimeout(() => falar(getPergunta('tipo')), 200);
    AsyncStorage.getItem('@faladinheiro:vozPedirCategoria').then(v => { if (v !== null) vozPedirCategoriaRef.current = v === 'true'; });
    AsyncStorage.getItem('@faladinheiro:vozPedirObservacao').then(v => { if (v !== null) vozPedirObservacaoRef.current = v === 'true'; });
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      Speech.stop();
    };
  }, []);

  function getPergunta(e: Etapa): string {
    if (e === 'descricao') return lancamentoRef.current.tipo === 'receita' ? 'De onde ou de quem recebeu?' : 'Descrição?';
    if (e === 'contaReceita') { const nomes = contasRef.current.map(c => c.nome).join(', '); return `Conta recebedora? ${nomes}.`; }
    if (e === 'formaPag' && lancamentoRef.current.tipo === 'receita') return 'Forma de recebimento?';
    if (e === 'conta') { const nomes = contasRef.current.map(c => c.nome).join(', '); return `Qual conta? ${nomes}.`; }
    if (e === 'cartao') { const nomes = cartoesRef.current.map(c => c.apelido).join(', '); return `Qual cartão? ${nomes}.`; }
    if (e === 'categoria') return lancamentoRef.current.tipo === 'receita' ? 'Categoria?' : 'Categoria?';
    return PERGUNTAS_CURTAS[e];
  }

  function falar(texto: string) {
    setFalando(true);
    Speech.speak(texto, {
      language: 'pt-BR',
      rate: vozVelocidadeRef.current,
      pitch: 1.0,
      onDone: () => {
        setFalando(false);
        setTimeout(() => iniciarGravacao(), 400);
      },
      onError: () => {
        setFalando(false);
        setTimeout(() => iniciarGravacao(), 400);
      },
    });
  }

  useSpeechRecognitionEvent('result', (event) => {
    const t = event.results?.[0]?.transcript || '';
    setTranscricao(t);
    textoFinal.current = t;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => ExpoSpeechRecognitionModule.stop(), etapaRef.current === 'obs' ? 2500 : 2000);
  });

  useSpeechRecognitionEvent('end', () => {
    gravacaoAtiva.current = false;
    setGravando(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (textoFinal.current.trim() && !jaProcessou.current) {
      jaProcessou.current = true;
      processarResposta(textoFinal.current);
    } else if (!textoFinal.current.trim() && !jaProcessou.current) {
      setTimeout(() => iniciarGravacao(), 800);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    gravacaoAtiva.current = false;
    setGravando(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (textoFinal.current.trim() && !jaProcessou.current) {
      jaProcessou.current = true;
      processarResposta(textoFinal.current);
      return;
    }
    if (etapaRef.current === 'obs') {
      setErro('Não ouvi. Diga sua observação ou diga não.');
      return;
    }
    if (event.error === 'no-speech') {
      setTimeout(() => iniciarGravacao(), 800);
    } else {
      setErro('Erro no microfone. Tente novamente.');
      setTimeout(() => { setErro(''); iniciarGravacao(); }, 2000);
    }
  });

  async function iniciarGravacao() {
    if (gravacaoAtiva.current) return;
    setErro(''); setTranscricao(''); textoFinal.current = ''; jaProcessou.current = false;
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) { Alert.alert('Permissão negada', 'Habilite o microfone.'); return; }
    await new Promise(resolve => setTimeout(resolve, 150));
    ExpoSpeechRecognitionModule.start({
      lang: 'pt-BR',
      interimResults: true,
      maxAlternatives: 3,
      continuous: true,
    });
    gravacaoAtiva.current = true;
    setGravando(true);
    timerRef.current = setTimeout(() => ExpoSpeechRecognitionModule.stop(), 12000);
  }

  function pararGravacao() {
    if (timerRef.current) clearTimeout(timerRef.current);
    ExpoSpeechRecognitionModule.stop();
    setGravando(false);
  }

  function avancarEtapa(novaEtapa: Etapa, atualizacao: Partial<Lancamento>) {
    historicoEtapas.current = [...historicoEtapas.current, etapaRef.current];
    const novoLanc = { ...lancamentoRef.current, ...atualizacao };
    setLancamento(novoLanc);
    lancamentoRef.current = novoLanc;
    setTranscricao(''); textoFinal.current = ''; jaProcessou.current = false;
    if (novaEtapa === 'confirmacao') {
      salvarDireto();
      return;
    }
    setEtapa(novaEtapa);
    etapaRef.current = novaEtapa;
    setTimeout(() => falar(getPergunta(novaEtapa)), 150);
  }

  function processarResposta(texto: string) {
    const t = normalizar(texto);
    const l = lancamentoRef.current;

    switch (etapaRef.current) {
      case 'tipo': {
        let tipo = interpretarTipo(t);
        if (!tipo && t.length < 8) {
          if (t.includes('d') || t.includes('desp')) tipo = 'despesa';
          else if (t.includes('r') || t.includes('rec')) tipo = 'receita';
        }
        if (!tipo) { falar('Não entendi, repita. Despesa ou receita?'); return; }
        avancarEtapa('descricao', { tipo });
        break;
      }

      case 'descricao': {
        if (!t) { falar('Não entendi, repita. ' + getPergunta('descricao')); return; }
        const descricao = capitalizarPalavras(texto);
        const catAuto = detectarCategoria(texto);
        avancarEtapa('valor', { descricao, categoria: catAuto });
        break;
      }

      case 'valor': {
        const valor = interpretarValor(texto);
        if (!valor || valor === '0') { falar('Não entendi, repita. Qual o valor?'); return; }

        if (l.tipo === 'receita') {
          // Receita: após valor → forma de pagamento (Pix/Depósito/Transferência/Dinheiro)
          if (!vozPedirCategoriaRef.current) avancarEtapa('formaPag', { valor, categoria: detectarCategoria(l.descricao) || l.categoria || '' });
          else if (l.categoria) avancarEtapa('formaPag', { valor });
          else avancarEtapa('categoria', { valor });
        } else {
          // Despesa: fluxo normal
          if (!vozPedirCategoriaRef.current) avancarEtapa('formaPag', { valor, categoria: detectarCategoria(l.descricao) || l.categoria || '' });
          else if (l.categoria) avancarEtapa('formaPag', { valor });
          else avancarEtapa('categoria', { valor });
        }
        break;
      }

      case 'categoria': {
        let categoria = '';
        const catsList = l.tipo === 'receita' ? categoriasRecRef.current : categoriasDispRef.current;

        if (t.includes('automatico') || t.includes('auto')) {
          categoria = detectarCategoria(l.descricao) || 'Outros';
        } else {
          const tNorm = normalizar(t);
          const encontrada = catsList.find(c => tNorm.includes(normalizar(c)));
          if (encontrada) categoria = encontrada;
          else if (l.tipo === 'receita') categoria = 'Outros';
          else categoria = detectarCategoria(texto) || capitalizarPalavras(texto);
        }

        // Após categoria → sempre vai para formaPag (tanto despesa quanto receita)
        const listaAtual = l.tipo === 'receita' ? categoriasRecRef.current : categoriasDispRef.current;
        if (categoria && !listaAtual.includes(categoria) && !t.includes('automatico') && !t.includes('auto') && categoria !== 'Outros') {
          lancamentoRef.current = { ...lancamentoRef.current, categoria };
          setLancamento(lancamentoRef.current);
          setEtapa('formaPag');
          etapaRef.current = 'formaPag';
          Speech.speak(`Categoria ${categoria} não cadastrada. Continuando assim mesmo.`, { language: 'pt-BR', rate: vozVelocidadeRef.current, onDone: () => setTimeout(() => falar(getPergunta('formaPag')), 300) });
          return;
        }
        avancarEtapa('formaPag', { categoria });
        break;
      }

      case 'formaPag': {
        let formaPag = '';

        if (l.tipo === 'receita') {
          // Receita: aceita Pix, Depósito, Transferência, Dinheiro, Crédito
          formaPag = interpretarFormaPagReceita(t);
          if (!formaPag) { falar('Não entendi, repita. Forma de recebimento? Pix, Depósito, Transferência ou Dinheiro.'); return; }

          // Após forma de pagamento na receita → pergunta conta onde foi recebido
          if (formaPag === 'Dinheiro') {
            avancarEtapa(vozPedirObservacaoRef.current ? 'obs' : 'confirmacao', { formaPag, cartaoId: '', cartaoNome: '', parcelas: '1', contaId: '', contaNome: '' });
          } else if (contasRef.current.length > 0) {
            avancarEtapa('contaReceita', { formaPag, cartaoId: '', cartaoNome: '', parcelas: '1' });
          } else {
            avancarEtapa(vozPedirObservacaoRef.current ? 'obs' : 'confirmacao', { formaPag, cartaoId: '', cartaoNome: '', parcelas: '1', contaId: '', contaNome: '' });
          }
          return;
        }

        // Despesa: fluxo original
        formaPag = interpretarFormaPag(t);
        if (!formaPag) { falar('Não entendi, repita. ' + getPergunta('formaPag')); return; }

        if (formaPag === 'Credito') {
          if (cartoesRef.current.length > 0) avancarEtapa('cartao', { formaPag });
          else avancarEtapa(vozPedirObservacaoRef.current ? 'obs' : 'confirmacao', { formaPag, cartaoId: '', cartaoNome: '', parcelas: '1' });
          return;
        }
        if ((formaPag === 'Debito' || formaPag === 'Pix' || formaPag === 'Transferência') && contasRef.current.length > 0) {
          avancarEtapa('conta', { formaPag, cartaoId: '', cartaoNome: '', parcelas: '1' });
          return;
        }
        avancarEtapa(vozPedirObservacaoRef.current ? 'obs' : 'confirmacao', { formaPag, cartaoId: '', cartaoNome: '', parcelas: '1', contaId: '', contaNome: '' });
        break;
      }

      case 'cartao': {
        const cartaoEncontrado = cartoesRef.current.find(c =>
          t.includes(normalizar(c.apelido)) ||
          t.includes(c.ultimos4) ||
          t.includes(normalizar(c.bandeira)) ||
          normalizar(c.apelido).split(' ').some(palavra => palavra.length > 3 && t.includes(palavra))
        );
        if (cartaoEncontrado) {
          avancarEtapa('parcelas', { cartaoId: cartaoEncontrado.id, cartaoNome: cartaoEncontrado.apelido });
        } else if (cartoesRef.current.length === 1) {
          // Fallback automático só com 1 cartão
          avancarEtapa('parcelas', { cartaoId: cartoesRef.current[0].id, cartaoNome: cartoesRef.current[0].apelido });
        } else {
          const nomes = cartoesRef.current.map(c => c.apelido).join(' ou ');
          falar(`Não identifiquei. Diga ${nomes}.`);
        }
        break;
      }

      case 'parcelas': {
        const textoLimpo = t.trim();
        const parcelas = (textoLimpo.length < 4 && /^\d+$/.test(textoLimpo))
          ? textoLimpo
          : interpretarParcelas(t);
        avancarEtapa(vozPedirObservacaoRef.current ? 'obs' : 'confirmacao', { parcelas });
        break;
      }

      case 'conta': {
        // Conta para débito em despesas
        if (PALAVRAS_NEGACAO.some(p => t.includes(normalizar(p)))) {
          avancarEtapa(vozPedirObservacaoRef.current ? 'obs' : 'confirmacao', { contaId: '', contaNome: '' });
          return;
        }
        const conta = contasRef.current.find(c =>
          t.includes(normalizar(c.nome)) ||
          t.includes(normalizar(c.banco)) ||
          normalizar(c.nome).split(' ').every(p => t.includes(p))
        ) || null;
        if (conta) {
          avancarEtapa(vozPedirObservacaoRef.current ? 'obs' : 'confirmacao', { contaId: conta.id, contaNome: conta.nome });
        } else if (contasRef.current.length === 1) {
          avancarEtapa(vozPedirObservacaoRef.current ? 'obs' : 'confirmacao', { contaId: contasRef.current[0].id, contaNome: contasRef.current[0].nome });
        } else {
          falar('Não identifiquei. Tente novamente ou diga não.');
        }
        break;
      }

      case 'contaReceita': {
        // Conta onde a receita foi recebida
        if (PALAVRAS_NEGACAO.some(p => t.includes(normalizar(p)))) {
          avancarEtapa(vozPedirObservacaoRef.current ? 'obs' : 'confirmacao', { contaId: '', contaNome: '' });
          return;
        }
        const contaRec = contasRef.current.find(c => {
          const nomeNorm = normalizar(c.nome).replace(/\s+/g, '');
          const tSemEspaco = t.replace(/\s+/g, '');
          return t.includes(normalizar(c.nome)) ||
            t.includes(normalizar(c.banco)) ||
            normalizar(c.nome).split(' ').every(p => p.length > 2 && t.includes(p)) ||
            tSemEspaco.includes(nomeNorm) ||
            nomeNorm.includes(tSemEspaco);
        }) || null;
        if (contaRec) {
          avancarEtapa(vozPedirObservacaoRef.current ? 'obs' : 'confirmacao', { contaId: contaRec.id, contaNome: contaRec.nome });
        } else if (contasRef.current.length === 1) {
          avancarEtapa(vozPedirObservacaoRef.current ? 'obs' : 'confirmacao', { contaId: contasRef.current[0].id, contaNome: contasRef.current[0].nome });
        } else {
          falar('Não identifiquei. Tente novamente ou diga não.');
        }
        break;
      }

      case 'obs': {
        const primeiraPalavra = t.split(' ')[0];
        const eNegacao = PALAVRAS_NEGACAO.some(p => t.includes(normalizar(p))) || PALAVRAS_NEGACAO.includes(primeiraPalavra) || t.trim().length < 5;
        const obs = eNegacao ? '' : capitalizarPalavras(texto);
        lancamentoRef.current = { ...lancamentoRef.current, obs };
        setLancamento(lancamentoRef.current);
        setTranscricao(''); textoFinal.current = ''; jaProcessou.current = false;
        salvarDireto();
        break;
      }
    }
  }

  async function salvarDireto() {
    const [desbloqueado, primLancStr] = await Promise.all([
      AsyncStorage.getItem(DESBLOQUEADO_KEY),
      AsyncStorage.getItem(PRIMEIRO_LANCAMENTO_KEY),
    ]);
    if (desbloqueado !== 'true') {
      const todosLanc = buscarLancamentos();
      const gruposUnicos = new Set(todosLanc.filter((l: any) => l.grupoId).map((l: any) => l.grupoId));
      const total = todosLanc.filter((l: any) => !l.grupoId).length + gruposUnicos.size;
      const primTs = primLancStr ? parseInt(primLancStr, 10) : null;
      const diasDecorridos = primTs ? Math.floor((Date.now() - primTs) / 86400000) : 0;
      if (total >= LIMITE_GRATIS || diasDecorridos >= LIMITE_DIAS) {
        const motivo = diasDecorridos >= LIMITE_DIAS
          ? `Seu período gratuito de ${LIMITE_DIAS} dias encerrou.`
          : `Você já registrou ${LIMITE_GRATIS} lançamentos no plano gratuito.`;
        Alert.alert('🔒 Limite atingido', `${motivo} Desbloqueie o Premium para continuar sem limites.`);
        return;
      }
    }
    const primExistente = await AsyncStorage.getItem(PRIMEIRO_LANCAMENTO_KEY);
    if (!primExistente) await AsyncStorage.setItem(PRIMEIRO_LANCAMENTO_KEY, String(Date.now()));

    const l = lancamentoRef.current;
    const valorNum = parseFloat(l.valor.replace(',', '.'));
    const totalParcelas = parseInt(l.parcelas) || 1;

    if (l.formaPag === 'Credito' && l.cartaoId) {
      const cartao = cartoesRef.current.find(c => c.id === l.cartaoId);
      inserirLancamentosParcelados({
        descricao: l.descricao, valorTotal: valorNum,
        categoria: l.categoria, formaPag: l.formaPag,
        cartaoId: l.cartaoId, contaId: l.contaId || '',
        totalParcelas, dataCompra: hoje(),
        diaVencimento: parseInt(cartao?.vencimento || '20'),
        diaFechamento: parseInt(cartao?.fechamento || '10'),
        status: 'parcelado', obs: l.obs, tipo: l.tipo,
      });
    } else {
      inserirLancamento({
        id: gerarId(), tipo: l.tipo,
        descricao: l.descricao, valor: valorNum,
        categoria: l.categoria, formaPag: l.formaPag,
        cartaoId: l.cartaoId, contaId: l.contaId || '',
        parcelas: totalParcelas,
        parcelaAtual: 1, totalParcelas, data: hoje(), dataVencimento: hoje(),
        status: (l.formaPag === 'Credito' || l.formaPag === 'Boleto') ? 'pendente' : 'pago',
        obs: l.obs, grupoId: '',
      });
    }

    if (l.tipo === 'despesa' && l.formaPag === 'Dinheiro') {
      await debitarConta('especie_fixa', valorNum);
    } else if (l.contaId && l.tipo === 'despesa' && (l.formaPag === 'Debito' || l.formaPag === 'Pix' || l.formaPag === 'Transferência')) {
      await debitarConta(l.contaId, valorNum);
    }
    if (l.tipo === 'receita' && l.formaPag === 'Dinheiro') {
      await creditarConta('especie_fixa', valorNum);
    } else if (l.contaId && l.tipo === 'receita') {
      await creditarConta(l.contaId, valorNum);
    }

    await agendarNotificacoesVencimento();
    verificarAlertaOrcamento().catch(() => {});
    resetarLembreteMotivacional().catch(() => {});
    Speech.speak('Salvo!', {
      language: 'pt-BR', rate: vozVelocidadeRef.current,
      onDone: () => router.replace('/(tabs)/lancamentos'),
      onError: () => router.replace('/(tabs)/lancamentos'),
    });
  }

  function reiniciar() {
    Speech.stop();
    historicoEtapas.current = [];
    setEtapa('tipo'); etapaRef.current = 'tipo';
    setTranscricao(''); setErro(''); jaProcessou.current = false;
    setLancamento({
      tipo: 'despesa', descricao: '', valor: '', categoria: '',
      formaPag: '', cartaoId: '', cartaoNome: '', parcelas: '1',
      contaId: '', contaNome: '', obs: '',
    });
    setTimeout(() => falar(getPergunta('tipo')), 300);
  }

  function voltarEtapa() {
    const hist = historicoEtapas.current;
    if (hist.length === 0) return;
    const anterior = hist[hist.length - 1];
    historicoEtapas.current = hist.slice(0, -1);
    Speech.stop();
    setErro(''); setTranscricao(''); textoFinal.current = ''; jaProcessou.current = false;
    setEtapa(anterior);
    etapaRef.current = anterior;
    setTimeout(() => falar(getPergunta(anterior)), 150);
  }

  const fmt = (v: string) => {
    const n = parseFloat(v.replace(',', '.'));
    return isNaN(n) ? v : 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const ETAPAS_LISTA: Etapa[] = ['tipo', 'descricao', 'valor', 'categoria', 'formaPag', 'cartao', 'parcelas', 'conta', 'contaReceita', 'obs'];
  const ETAPA_LABEL: Record<Etapa, string> = {
    tipo: '1. Tipo', descricao: '2. Descrição', valor: '3. Valor',
    categoria: '4. Categoria', formaPag: '5. Pagamento',
    cartao: '6. Cartão', parcelas: '7. Parcelas',
    conta: '6. Conta', contaReceita: '6. Conta', obs: '8. Observação', confirmacao: '✅ Confirmação',
  };

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => { Speech.stop(); router.back(); }} style={s.backBtn}>
          <Text style={s.backTxt} numberOfLines={1}>Voltar</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Lançamento por Voz</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity onPress={() => setHelpVisible(true)} style={helpBtnStyle}>
            <Text style={helpTxtStyle}>?</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.body}>

        {/* Barra de progresso */}
        {etapa !== 'confirmacao' && (
          <View style={s.progressCard}>
            <View style={s.progressTop}>
              <Text style={s.progressLbl}>{ETAPA_LABEL[etapa]}</Text>
            </View>
            <View style={s.progressBar}>
              {ETAPAS_LISTA.map((e, i) => (
                <View key={e} style={[
                  s.progressDot,
                  etapa === e && s.progressDotOn,
                  ETAPAS_LISTA.indexOf(etapa) > i && s.progressDotDone,
                ]} />
              ))}
            </View>

          </View>
        )}

        {/* Pergunta atual + dados coletados */}
        {etapa !== 'confirmacao' && (
          <View style={s.perguntaCard}>
            {falando && <Text style={s.falandoLbl}>🔊 Perguntando...</Text>}
            <Text style={s.perguntaTxt}>{getPergunta(etapa)}</Text>
            {lancamento.tipo && etapa !== 'tipo' && (
              <Text style={s.coletado}>Tipo: <Text style={s.coletadoVal}>{lancamento.tipo === 'despesa' ? '📉 Despesa' : '📈 Receita'}</Text></Text>
            )}
            {lancamento.descricao && etapa !== 'descricao' && (
              <Text style={s.coletado}>Descrição: <Text style={s.coletadoVal}>{lancamento.descricao}</Text></Text>
            )}
            {lancamento.valor && etapa !== 'valor' && (
              <Text style={s.coletado}>Valor: <Text style={s.coletadoVal}>{fmt(lancamento.valor)}</Text></Text>
            )}
            {lancamento.categoria && (etapa === 'formaPag' || etapa === 'cartao' || etapa === 'parcelas' || etapa === 'conta' || etapa === 'contaReceita' || etapa === 'obs') && (
              <Text style={s.coletado}>Categoria: <Text style={s.coletadoVal}>{lancamento.categoria} ⚡</Text></Text>
            )}
            {lancamento.formaPag && (etapa === 'cartao' || etapa === 'parcelas' || etapa === 'conta' || etapa === 'contaReceita' || etapa === 'obs') && (
              <Text style={s.coletado}>Pagamento: <Text style={s.coletadoVal}>{lancamento.formaPag}</Text></Text>
            )}
            {lancamento.cartaoNome && (etapa === 'parcelas' || etapa === 'obs') && (
              <Text style={s.coletado}>Cartão: <Text style={s.coletadoVal}>{lancamento.cartaoNome}</Text></Text>
            )}
            {lancamento.cartaoNome && etapa === 'obs' && (
              <Text style={s.coletado}>Parcelas: <Text style={s.coletadoVal}>{lancamento.parcelas}x</Text></Text>
            )}
            {lancamento.contaNome && etapa === 'obs' && (
              <Text style={s.coletado}>Conta: <Text style={s.coletadoVal}>{lancamento.contaNome}</Text></Text>
            )}
          </View>
        )}

        {/* Transcrição em tempo real */}
        {gravando && (
          <View style={s.transcricaoCard}>
            <Text style={s.transcricaoLbl}>🔴 Ouvindo...</Text>
            <Text style={s.transcricaoTxt}>{transcricao || '...'}</Text>
          </View>
        )}

        {/* Erro */}
        {erro ? (
          <View style={s.erroCard}>
            <Text style={s.erroTxt}>⚠️ {erro}</Text>
            {etapaRef.current === 'obs' && (
              <TouchableOpacity onPress={iniciarGravacao} style={s.btnTentarNovamente}>
                <Text style={s.btnTentarNovamenteTxt}>🎤 Tentar novamente</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

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
            <View style={s.confirmRow}><Text style={s.confirmLbl}>Descrição</Text><Text style={s.confirmVal}>{lancamento.descricao}</Text></View>
            <View style={s.confirmRow}><Text style={s.confirmLbl}>Valor</Text><Text style={s.confirmVal}>{fmt(lancamento.valor)}</Text></View>
            <View style={s.confirmRow}><Text style={s.confirmLbl}>Categoria</Text><Text style={s.confirmVal}>{lancamento.categoria || '—'}</Text></View>
            <View style={s.confirmRow}><Text style={s.confirmLbl}>Forma de pag.</Text><Text style={s.confirmVal}>{lancamento.formaPag}</Text></View>
            {lancamento.cartaoNome ? <View style={s.confirmRow}><Text style={s.confirmLbl}>Cartão</Text><Text style={s.confirmVal}>{lancamento.cartaoNome}</Text></View> : null}
            {parseInt(lancamento.parcelas) > 1 ? <View style={s.confirmRow}><Text style={s.confirmLbl}>Parcelas</Text><Text style={s.confirmVal}>{lancamento.parcelas}x</Text></View> : null}
            {lancamento.contaNome ? (
              <View style={s.confirmRow}>
                <Text style={s.confirmLbl}>{lancamento.tipo === 'receita' ? 'Conta recebida' : 'Conta debitada'}</Text>
                <Text style={s.confirmVal}>{lancamento.contaNome}</Text>
              </View>
            ) : null}
            {lancamento.obs ? <View style={s.confirmRow}><Text style={s.confirmLbl}>Observação</Text><Text style={s.confirmVal}>{lancamento.obs}</Text></View> : null}
            <View style={s.confirmRow}><Text style={s.confirmLbl}>Data</Text><Text style={s.confirmVal}>{hoje()}</Text></View>
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
            <Text style={s.micTxt}>{gravando ? 'Parar' : 'Falar'}</Text>
          </TouchableOpacity>
        )}

        {/* Navegação: Voltar + Recomeçar */}
        {etapa !== 'confirmacao' && (
          <View style={s.botoesNav}>
            {etapa !== 'tipo' && (
              <TouchableOpacity style={s.btnVoltar} onPress={voltarEtapa}>
                <Text style={s.btnVoltarTxt} numberOfLines={1}>◀ Voltar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.btnRecomecar} onPress={reiniciar}>
              <Text style={s.btnRecomecarTxt}>🔄 Recomeçar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Indicador falando */}
        {falando && (
          <View style={s.falandoBtn}>
            <Text style={s.falandoBtnTxt}>🔊</Text>
          </View>
        )}

        {/* Painel de dicas expansível */}
        <TouchableOpacity style={s.dicasHeader} onPress={() => setDicasExpandidas(v => !v)} activeOpacity={0.8}>
          <Text style={s.dicasHeaderTxt}>💡 Dicas de pronúncia</Text>
          <Text style={s.dicasChevron}>{dicasExpandidas ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {dicasExpandidas && (
          <View style={s.dicasBody}>
            {DICAS.map((d, i) => (
              <View key={i} style={s.dicaItem}>
                <Text style={s.dicaTitulo}>{d.titulo}</Text>
                <Text style={s.dicaTexto}>{d.texto}</Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
      <HelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        title="Como usar o lançamento por voz"
        tips={[
          { titulo: 'Tipo', texto: 'Diga "despesa" ou "receita" para escolher o tipo.' },
          { titulo: 'Pix', texto: 'Para Pix, diga "é Pix" — funciona melhor do que só "Pix".' },
          { titulo: 'Valor', texto: 'Fale o valor por extenso: "dez mil reais", "cinquenta e cinco reais".' },
          { titulo: 'Voltar etapa', texto: 'Toque em "◀ Voltar" para refazer a etapa anterior sem recomeçar tudo.' },
          { titulo: 'Não entendi', texto: 'Se ouvir "Não entendi, repita", fale mais devagar e com clareza, ou toque em ◀ Voltar para refazer a etapa.' },
          { titulo: 'Categoria e Observação', texto: 'Nas Configurações você pode desativar a pergunta de categoria e observação para agilizar o lançamento.' },
        ]}
      />
    </View>
  );
}

// ─── estilos ─────────────────────────────────────────────────────────────────

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 16, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: c.borderSoft,
    },
    backBtn: { padding: 4, minWidth: 70, flexShrink: 0 },
    backTxt: { fontSize: 16, color: '#5294ff', fontWeight: '600' },
    headerTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    tutorialBtn: { alignItems: 'center', padding: 4, width: 60 },
    tutorialBtnTxt: { fontSize: 18 },
    tutorialBtnLbl: { fontSize: 9, color: c.textMuted, fontWeight: '600' },
    body: { padding: 20, gap: 16, paddingBottom: 60 },
    progressCard: {
      backgroundColor: c.card, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: c.borderSoft,
    },
    progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    progressLbl: { fontSize: 13, color: '#5294ff', fontWeight: '700' },
    modoTxt: { fontSize: 10, color: c.textMuted, fontWeight: '600' },
    progressBar: { flexDirection: 'row', gap: 6 },
    progressDot: { flex: 1, height: 4, borderRadius: 4, backgroundColor: c.barTrack2 },
    progressDotOn: { backgroundColor: '#5294ff' },
    progressDotDone: { backgroundColor: '#25d07e' },
    tutorialContador: { fontSize: 10, color: c.textMuted, marginTop: 8, fontStyle: 'italic' },
    perguntaCard: {
      backgroundColor: c.card, borderRadius: 14, padding: 18,
      borderWidth: 1, borderColor: 'rgba(82,148,255,0.2)',
    },
    falandoLbl: { fontSize: 11, color: '#5294ff', fontWeight: '600', marginBottom: 6 },
    perguntaTxt: { fontSize: 16, color: c.text, fontWeight: '600', lineHeight: 24, marginBottom: 12 },
    coletado: { fontSize: 12, color: c.textMuted, marginTop: 4 },
    coletadoVal: { color: c.textSec, fontWeight: '600' },
    transcricaoCard: {
      backgroundColor: c.card, borderRadius: 14, padding: 16,
      borderWidth: 1, borderColor: 'rgba(82,148,255,0.3)', alignItems: 'center',
    },
    transcricaoLbl: { fontSize: 12, color: '#f25555', fontWeight: '600', marginBottom: 6 },
    transcricaoTxt: { fontSize: 16, color: c.text, textAlign: 'center', lineHeight: 24 },
    erroCard: {
      backgroundColor: 'rgba(242,85,85,0.1)', borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: 'rgba(242,85,85,0.3)', alignItems: 'center',
    },
    erroTxt: { fontSize: 13, color: '#f25555', textAlign: 'center', marginBottom: 8 },
    btnTentarNovamente: {
      backgroundColor: c.input, borderRadius: 10, padding: 10,
      borderWidth: 1, borderColor: c.border,
    },
    btnTentarNovamenteTxt: { fontSize: 13, color: c.textSec, fontWeight: '600' },
    confirmCard: {
      backgroundColor: c.card, borderRadius: 14, padding: 20,
      borderWidth: 1, borderColor: 'rgba(37,208,126,0.3)',
    },
    confirmTitle: { fontSize: 16, fontWeight: '700', color: '#25d07e', marginBottom: 16 },
    confirmRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.borderLight,
    },
    confirmLbl: { fontSize: 13, color: c.textMuted },
    confirmVal: { fontSize: 13, color: c.text, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
    confirmBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
    btnReiniciar: {
      flex: 1, padding: 13, backgroundColor: c.input, borderRadius: 11,
      alignItems: 'center', borderWidth: 1, borderColor: c.border,
    },
    btnReiniciarTxt: { fontSize: 13, color: c.textSec, fontWeight: '600' },
    btnSalvar: { flex: 1, padding: 13, backgroundColor: '#25d07e', borderRadius: 11, alignItems: 'center' },
    btnSalvarTxt: { fontSize: 13, color: '#fff', fontWeight: '700' },
    micBtn: {
      width: 120, height: 120, borderRadius: 60, backgroundColor: '#5294ff',
      alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center',
    },
    micBtnGravando: { backgroundColor: '#f25555' },
    micIco: { fontSize: 44 },
    micTxt: { fontSize: 11, color: '#fff', fontWeight: '600' },
    botoesNav: {
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
      gap: 12, marginTop: 16,
    },
    btnVoltar: {
      paddingVertical: 8, paddingHorizontal: 20,
      borderRadius: 20, borderWidth: 1, borderColor: c.border,
      backgroundColor: 'transparent',
    },
    btnVoltarTxt: { fontSize: 12, color: c.textSec, fontWeight: '500' },
    btnRecomecar: {
      paddingVertical: 8, paddingHorizontal: 20,
      borderRadius: 20, borderWidth: 1, borderColor: c.border,
      backgroundColor: 'transparent',
    },
    btnRecomecarTxt: { fontSize: 12, color: c.textMuted, fontWeight: '500' },
    falandoBtn: {
      width: 120, height: 120, borderRadius: 60, backgroundColor: c.input,
      alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
      borderWidth: 2, borderColor: '#5294ff',
    },
    falandoBtnTxt: { fontSize: 40 },
    // Painel de dicas
    dicasHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: c.card, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: c.borderSoft, marginTop: 4,
    },
    dicasHeaderTxt: { fontSize: 13, color: c.textSec, fontWeight: '600' },
    dicasChevron: { fontSize: 11, color: c.textMuted },
    dicasBody: {
      backgroundColor: c.card, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: c.borderSoft, gap: 12,
    },
    dicaItem: { gap: 2 },
    dicaTitulo: { fontSize: 12, color: '#5294ff', fontWeight: '700' },
    dicaTexto: { fontSize: 12, color: c.textMuted, lineHeight: 18 },
  });
}