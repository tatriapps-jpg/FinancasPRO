import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { carregarCategorias } from './categorias';
import { buscarContas, creditarConta, debitarConta } from './contas';
import { buscarCartoes, buscarLancamentos, gerarId, inserirLancamento, inserirLancamentosParcelados } from './database';
import { agendarNotificacoesVencimento } from './notificacoes';
import { Colors, useTheme } from './theme';

const VOZ_TUTORIAL_KEY = '@financaspro:vozTutorial';
const VOZ_TUTORIAL_LIMITE = 3;
const DESBLOQUEADO_KEY = '@faladinheiro:desbloqueado';
const LIMITE_GRATIS = 150;

type Cartao = { id: string; apelido: string; bandeira: string; ultimos4: string; fechamento: string; vencimento: string; limite: string; };
type Conta = { id: string; nome: string; banco: string; tipo: string; saldo: string; };
type Etapa = 'tipo' | 'descricao' | 'valor' | 'categoria' | 'formaPag' | 'cartao' | 'parcelas' | 'conta' | 'contaReceita' | 'obs' | 'confirmacao';
type Lancamento = {
  tipo: 'despesa' | 'receita';
  descricao: string; valor: string; categoria: string;
  formaPag: string; cartaoId: string; cartaoNome: string;
  parcelas: string; contaId: string; contaNome: string; obs: string;
};

const PERGUNTAS_COMPLETAS: Record<Etapa, string> = {
  tipo: 'Este lançamento é uma despesa ou uma receita?',
  descricao: '',
  valor: 'Qual é o valor?',
  categoria: 'Qual é a categoria? Por exemplo: Supermercado, Saúde, Transporte. Ou diga automático.',
  formaPag: 'Qual a forma de pagamento? Crédito, Débito, Pix, Dinheiro, Boleto ou Outro.',
  cartao: 'Qual cartão deseja usar?',
  parcelas: 'Quantas parcelas? Diga o número. Um para pagamento único.',
  conta: 'De qual conta será debitado?',
  contaReceita: 'Em qual conta foi recebido?',
  obs: 'Alguma observação? Diga o que quiser ou diga não.',
  confirmacao: '',
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
  mercado: 'Supermercado', supermercado: 'Supermercado', padaria: 'Supermercado',
  restaurante: 'Supermercado', lanche: 'Supermercado', comida: 'Supermercado',
  ifood: 'Supermercado', delivery: 'Supermercado', alimentacao: 'Supermercado',
  alimentação: 'Supermercado',
  gasolina: 'Combustível', combustivel: 'Combustível', combustível: 'Combustível',
  posto: 'Combustível', etanol: 'Combustível', diesel: 'Combustível',
  uber: 'Transporte', onibus: 'Transporte', ônibus: 'Transporte',
  metro: 'Transporte', metrô: 'Transporte', taxi: 'Transporte', táxi: 'Transporte',
  estacionamento: 'Transporte', pedagio: 'Transporte', pedágio: 'Transporte',
  farmacia: 'Farmácia', farmácia: 'Farmácia', medico: 'Saúde', médico: 'Saúde',
  consulta: 'Saúde', remedio: 'Saúde', remédio: 'Saúde', hospital: 'Saúde',
  netflix: 'Assinaturas Digitais', spotify: 'Assinaturas Digitais', assinatura: 'Assinaturas Digitais',
  cinema: 'Lazer e Entretenimento', show: 'Lazer e Entretenimento',
  viagem: 'Viagens', passagem: 'Viagens', hotel: 'Viagens',
  luz: 'Energia', energia: 'Energia',
  agua: 'Moradia', água: 'Moradia', aluguel: 'Moradia',
  internet: 'Internet', condominio: 'Moradia', condomínio: 'Moradia',
  salario: 'Salário', salário: 'Salário', freelance: 'Freelance',
  oficina: 'Manutenção', mecanico: 'Manutenção', mecânico: 'Manutenção',
  reparo: 'Manutenção', encanador: 'Manutenção', eletricista: 'Manutenção',
  manutencao: 'Manutenção', manutenção: 'Manutenção',
  escola: 'Educação', faculdade: 'Educação', curso: 'Educação',
  educacao: 'Educação', educação: 'Educação',
  juros: 'Custos Financeiros', multa: 'Custos Financeiros',
  roupa: 'Vestuário', calcado: 'Vestuário', calçado: 'Vestuário',
  vestuario: 'Vestuário', vestuário: 'Vestuário',
  eletronico: 'Eletrônicos', eletrônico: 'Eletrônicos', celular: 'Eletrônicos',
  computador: 'Eletrônicos', notebook: 'Eletrônicos',
  investimento: 'Investimentos', poupanca: 'Investimentos', poupança: 'Investimentos',
  emprestimo: 'Empréstimos', empréstimo: 'Empréstimos', financiamento: 'Empréstimos',
  imposto: 'Impostos', ir: 'Impostos', iptu: 'Impostos', ipva: 'Impostos',
  tributo: 'Impostos', darf: 'Impostos', taxa: 'Impostos',
  doacao: 'Doações', doação: 'Doações',
  esporte: 'Esportes', academia: 'Esportes', ginastica: 'Esportes',
  advogado: 'Serviços Profissionais', contador: 'Serviços Profissionais',
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

  // Tenta número direto (aceita ponto ou vírgula como decimal)
  // Remove espaços antes de tentar parse
  const semEspaco = t.replace(/\s/g, '').replace(',', '.');
  const matchDireto = semEspaco.match(/^(\d+\.?\d*)$/);
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
  if (t.includes('credito') || t.includes('cartao')) return 'Crédito';
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
  { titulo: '🔔 Aguarde o bip', texto: 'Só fale após ouvir o bip de início. O app precisa de um instante para ativar o microfone — falar antes pode fazer o áudio ser cortado.' },
  { titulo: '💰 Valores por extenso', texto: 'Diga o valor por extenso: "cinquenta reais", "cento e vinte reais e cinquenta centavos", "dois mil e trezentos". Evite falar apenas números isolados.' },
  { titulo: '💳 Formas de pagamento', texto: 'Diga: "pix", "crédito", "débito", "dinheiro", "boleto", "transferência" ou "depósito". O app reconhece variações como "cartão", "cartão de crédito", "à vista".' },
  { titulo: '🏷️ Cartões e contas', texto: 'Use apelidos simples como "Nubank" ou "Itaú" — não é necessário informar número, bandeira ou dados reais. O app busca pelo nome que você cadastrou.' },
  { titulo: '📂 Categorias', texto: 'Diga o nome da categoria ou diga "automático" para o app detectar pela descrição. Ex: dizer "mercado" na descrição já sugere Supermercado automaticamente.' },
  { titulo: '🔢 Parcelas', texto: 'Diga o número de parcelas por extenso: "três", "seis", "doze". Para pagamento único diga "um" ou "à vista". Parcelamento só funciona com cartão de crédito.' },
  { titulo: '✅ Observações', texto: 'Na etapa de observações, diga qualquer anotação que queira registrar. Diga "não" para pular esta etapa e ir direto para a confirmação.' },
];

// ─── componente principal ───────────────────────────────────────────────────

export default function VozScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [etapa, setEtapa] = useState<Etapa>('tipo');
  const [gravando, setGravando] = useState(false);
  const [transcricao, setTranscricao] = useState('');
  const [erro, setErro] = useState('');
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [categoriasDisp, setCategoriasDisp] = useState<string[]>([]);
  const [categoriasRec, setCategoriasRec] = useState<string[]>([]);
  const [falando, setFalando] = useState(false);
  const [usarTutorial, setUsarTutorial] = useState(true);
  const [usosTutorial, setUsosTutorial] = useState(0);
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
  const usarTutorialRef = useRef(true);
  const etapaRef = useRef<Etapa>('tipo');
  const cartoesRef = useRef<Cartao[]>([]);
  const contasRef = useRef<Conta[]>([]);
  const categoriasDispRef = useRef<string[]>([]);
  const categoriasRecRef  = useRef<string[]>([]);
  const vozVelocidadeRef = useRef(1.3);
  const gravacaoAtiva = useRef(false);
  const historicoEtapas = useRef<Etapa[]>([]);

  useEffect(() => { lancamentoRef.current = lancamento; }, [lancamento]);
  useEffect(() => { usarTutorialRef.current = usarTutorial; }, [usarTutorial]);
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
    carregarConfigTutorial();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      Speech.stop();
    };
  }, []);

  async function carregarConfigTutorial() {
    const saved = await AsyncStorage.getItem(VOZ_TUTORIAL_KEY);
    const usos = saved ? parseInt(saved) : 0;
    setUsosTutorial(usos);
    const tutorial = usos < VOZ_TUTORIAL_LIMITE;
    setUsarTutorial(tutorial);
    usarTutorialRef.current = tutorial;
    await AsyncStorage.setItem(VOZ_TUTORIAL_KEY, String(usos + 1));
    setTimeout(() => falar(tutorial ? PERGUNTAS_COMPLETAS['tipo'] : PERGUNTAS_CURTAS['tipo']), 200);
  }

  async function toggleTutorial() {
    const novoValor = !usarTutorial;
    setUsarTutorial(novoValor);
    usarTutorialRef.current = novoValor;
    if (novoValor) {
      await AsyncStorage.setItem(VOZ_TUTORIAL_KEY, '0');
      setUsosTutorial(0);
    } else {
      await AsyncStorage.setItem(VOZ_TUTORIAL_KEY, String(VOZ_TUTORIAL_LIMITE));
      setUsosTutorial(VOZ_TUTORIAL_LIMITE);
    }
  }

  function getPerguntaDescricao(tipo: 'despesa' | 'receita'): string {
    if (!usarTutorialRef.current) return 'Descrição?';
    if (tipo === 'receita') return 'Qual é a descrição? Por exemplo: Salário, Freelance, Aluguel Recebido ou Venda.';
    return 'Qual é a descrição? Por exemplo: Super X, Farmácia Y ou Juca Eletricista.';
  }

  function getPerguntaContaReceita(): string {
    if (contasRef.current.length === 0) return '';
    const nomes = contasRef.current.map(c => c.nome).join(', ');
    return usarTutorialRef.current
      ? `Em qual conta foi recebido? Você tem: ${nomes}.`
      : `Conta recebedora? ${nomes}.`;
  }

  function getPergunta(e: Etapa): string {
    if (e === 'descricao') return getPerguntaDescricao(lancamentoRef.current.tipo);
    if (e === 'contaReceita') return getPerguntaContaReceita();
    if (e === 'formaPag' && lancamentoRef.current.tipo === 'receita') {
      return usarTutorialRef.current
        ? 'Qual a forma de recebimento? Pix, Depósito, Transferência ou Dinheiro.'
        : 'Forma de recebimento?';
    }
    if (e === 'conta') {
      const nomes = contasRef.current.map(c => c.nome).join(', ');
      return usarTutorialRef.current
        ? `De qual conta será debitado? Você tem: ${nomes}.`
        : `Qual conta? ${nomes}.`;
    }
    if (e === 'cartao') {
      const nomes = cartoesRef.current.map(c => c.apelido).join(', ');
      return usarTutorialRef.current
        ? `Qual cartão? Você tem: ${nomes}.`
        : `Qual cartão? ${nomes}.`;
    }
    return usarTutorialRef.current ? PERGUNTAS_COMPLETAS[e] : PERGUNTAS_CURTAS[e];
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
      setEtapa('confirmacao');
      etapaRef.current = 'confirmacao';
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
        if (!tipo) { falar('Despesa ou receita?'); return; }
        avancarEtapa('descricao', { tipo });
        break;
      }

      case 'descricao': {
        if (!t) { falar(getPerguntaDescricao(l.tipo)); return; }
        const descricao = capitalizarPalavras(texto);
        const catAuto = detectarCategoria(texto);
        avancarEtapa('valor', { descricao, categoria: catAuto });
        break;
      }

      case 'valor': {
        const valor = interpretarValor(texto);
        if (!valor || valor === '0') { falar('Não entendi. Qual o valor?'); return; }

        if (l.tipo === 'receita') {
          // Receita: após valor → forma de pagamento (Pix/Depósito/Transferência/Dinheiro)
          if (l.categoria) avancarEtapa('formaPag', { valor });
          else avancarEtapa('categoria', { valor });
        } else {
          // Despesa: fluxo normal
          if (l.categoria) avancarEtapa('formaPag', { valor });
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
        avancarEtapa('formaPag', { categoria });
        break;
      }

      case 'formaPag': {
        let formaPag = '';

        if (l.tipo === 'receita') {
          // Receita: aceita Pix, Depósito, Transferência, Dinheiro, Crédito
          formaPag = interpretarFormaPagReceita(t);
          if (!formaPag) { falar('Forma de recebimento? Pix, Depósito, Transferência ou Dinheiro.'); return; }

          // Após forma de pagamento na receita → pergunta conta onde foi recebido
          if (contasRef.current.length > 0) {
            avancarEtapa('contaReceita', { formaPag, cartaoId: '', cartaoNome: '', parcelas: '1' });
          } else {
            avancarEtapa('obs', { formaPag, cartaoId: '', cartaoNome: '', parcelas: '1', contaId: '', contaNome: '' });
          }
          return;
        }

        // Despesa: fluxo original
        formaPag = interpretarFormaPag(t);
        if (!formaPag) { falar(getPergunta('formaPag')); return; }

        if (formaPag === 'Credito') {
          if (cartoesRef.current.length > 0) avancarEtapa('cartao', { formaPag });
          else avancarEtapa('obs', { formaPag, cartaoId: '', cartaoNome: '', parcelas: '1' });
          return;
        }
        if ((formaPag === 'Debito' || formaPag === 'Pix' || formaPag === 'Transferência') && contasRef.current.length > 0) {
          avancarEtapa('conta', { formaPag, cartaoId: '', cartaoNome: '', parcelas: '1' });
          return;
        }
        avancarEtapa('obs', { formaPag, cartaoId: '', cartaoNome: '', parcelas: '1', contaId: '', contaNome: '' });
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
        avancarEtapa('obs', { parcelas });
        break;
      }

      case 'conta': {
        // Conta para débito em despesas
        if (PALAVRAS_NEGACAO.some(p => t.includes(normalizar(p)))) {
          avancarEtapa('obs', { contaId: '', contaNome: '' });
          return;
        }
        const conta = contasRef.current.find(c =>
          t.includes(normalizar(c.nome)) ||
          t.includes(normalizar(c.banco)) ||
          normalizar(c.nome).split(' ').some(palavra => palavra.length > 3 && t.includes(palavra))
        ) || null;
        if (conta) {
          avancarEtapa('obs', { contaId: conta.id, contaNome: conta.nome });
        } else if (contasRef.current.length === 1) {
          avancarEtapa('obs', { contaId: contasRef.current[0].id, contaNome: contasRef.current[0].nome });
        } else {
          falar('Não identifiquei. Tente novamente ou diga não.');
        }
        break;
      }

      case 'contaReceita': {
        // Conta onde a receita foi recebida
        if (PALAVRAS_NEGACAO.some(p => t.includes(normalizar(p)))) {
          avancarEtapa('obs', { contaId: '', contaNome: '' });
          return;
        }
        const contaRec = contasRef.current.find(c =>
          t.includes(normalizar(c.nome)) ||
          t.includes(normalizar(c.banco)) ||
          normalizar(c.nome).split(' ').some(palavra => palavra.length > 3 && t.includes(palavra))
        ) || null;
        if (contaRec) {
          avancarEtapa('obs', { contaId: contaRec.id, contaNome: contaRec.nome });
        } else if (contasRef.current.length === 1) {
          avancarEtapa('obs', { contaId: contasRef.current[0].id, contaNome: contasRef.current[0].nome });
        } else {
          falar('Não identifiquei. Tente novamente ou diga não.');
        }
        break;
      }

      case 'obs': {
        const primeiraPalavra = t.split(' ')[0];
        const eNegacao = PALAVRAS_NEGACAO.some(p => t.includes(normalizar(p))) || PALAVRAS_NEGACAO.includes(primeiraPalavra) || t.trim().length < 5;
        const obs = eNegacao ? '' : capitalizarPalavras(texto);
        avancarEtapa('confirmacao', { obs });
        break;
      }
    }
  }

  async function salvarDireto() {
    const desbloqueado = await AsyncStorage.getItem(DESBLOQUEADO_KEY);
    if (desbloqueado !== 'true') {
      const total = buscarLancamentos().length;
      if (total >= LIMITE_GRATIS) {
        Alert.alert('Limite atingido', 'Você atingiu o limite de 100 lançamentos gratuitos. Acesse a tela de Lançamentos para desbloquear.');
        return;
      }
    }

    const l = lancamentoRef.current;
    const valorNum = parseFloat(l.valor.replace(',', '.'));
    const totalParcelas = parseInt(l.parcelas) || 1;

    if (l.formaPag === 'Credito' && l.cartaoId && totalParcelas > 1) {
      const cartao = cartoesRef.current.find(c => c.id === l.cartaoId);
      inserirLancamentosParcelados({
        descricao: l.descricao, valorTotal: valorNum,
        categoria: l.categoria, formaPag: l.formaPag,
        cartaoId: l.cartaoId, totalParcelas, dataCompra: hoje(),
        diaVencimento: parseInt(cartao?.vencimento || '20'),
        diaFechamento: parseInt(cartao?.fechamento || '10'),
        status: 'parcelado', obs: l.obs, tipo: l.tipo,
      });
    } else {
      inserirLancamento({
        id: gerarId(), tipo: l.tipo,
        descricao: l.descricao, valor: valorNum,
        categoria: l.categoria, formaPag: l.formaPag,
        cartaoId: l.cartaoId, parcelas: totalParcelas,
        parcelaAtual: 1, totalParcelas, data: hoje(), dataVencimento: hoje(),
        status: 'pago',
        obs: l.obs, grupoId: '',
      });
    }

    if (l.contaId) {
      if (l.tipo === 'despesa' && (l.formaPag === 'Debito' || l.formaPag === 'Pix' || l.formaPag === 'Transferência')) {
        await debitarConta(l.contaId, valorNum);
      } else if (l.tipo === 'receita') {
        await creditarConta(l.contaId, valorNum);
      }
    }

    await agendarNotificacoesVencimento();
    Speech.speak('Salvo!', { language: 'pt-BR', rate: vozVelocidadeRef.current });
    router.replace('/(tabs)/lancamentos');
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
    return isNaN(n) ? v : 'R$ ' + n.toFixed(2).replace('.', ',');
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
          <Text style={s.backTxt}>Voltar</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Lançamento por Voz</Text>
        <TouchableOpacity onPress={toggleTutorial} style={s.tutorialBtn}>
          <Text style={s.tutorialBtnTxt}>{usarTutorial ? '🔊' : '⚡'}</Text>
          <Text style={s.tutorialBtnLbl}>{usarTutorial ? 'Guiado' : 'Rápido'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.body}>

        {/* Barra de progresso */}
        {etapa !== 'confirmacao' && (
          <View style={s.progressCard}>
            <View style={s.progressTop}>
              <Text style={s.progressLbl}>{ETAPA_LABEL[etapa]}</Text>
              <Text style={s.modoTxt}>{usarTutorial ? '🔊 Guiado' : '⚡ Rápido'}</Text>
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
            {usosTutorial < VOZ_TUTORIAL_LIMITE && usarTutorial && (
              <Text style={s.tutorialContador}>Modo guiado ativo por mais {VOZ_TUTORIAL_LIMITE - usosTutorial} uso(s)</Text>
            )}
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
                <Text style={s.btnVoltarTxt}>◀ Voltar</Text>
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
    backBtn: { padding: 4, width: 60 },
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