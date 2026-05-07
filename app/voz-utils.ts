// Funções puras de interpretação de voz — sem dependências React Native

export function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

export function capitalizarPalavras(texto: string): string {
  return texto.toLowerCase().split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

export const MAP_CATEGORIA: Record<string, string> = {
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

export function detectarCategoria(descricao: string): string {
  const t = normalizar(descricao);
  for (const [palavra, cat] of Object.entries(MAP_CATEGORIA)) {
    const p = normalizar(palavra);
    if (new RegExp(`\\b${p}\\b`).test(t)) return cat;
  }
  return '';
}

export const PALAVRAS_NUM: Record<string, number> = {
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

export function somarExtenso(tokens: string[]): number {
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

export function interpretarValor(texto: string): string {
  let t = texto.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/r\$/g, '')
    .replace(/reais?/g, '')
    .replace(/centavos?/g, ' centavos')
    .trim();

  const matchSepCents = t.match(/^(\d+)\s+(?:(?:com|e|virgula|ponto)\s+)?(\d{1,2})$/);
  if (matchSepCents) return `${matchSepCents[1]}.${matchSepCents[2].padEnd(2, '0')}`;

  const semEspaco = t.replace(/\s/g, '').replace(',', '.');
  const matchDireto = semEspaco.match(/^(\d+(?:\.\d{1,2})?)$/);
  if (matchDireto) return matchDireto[1];

  const matchMilhar = t.match(/^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/);
  if (matchMilhar) {
    const inteiro = matchMilhar[1].replace(/\./g, '');
    const cents = matchMilhar[2] ? matchMilhar[2].padEnd(2, '0') : '';
    return cents ? `${inteiro}.${cents}` : inteiro;
  }

  const matchDecimal = t.match(/(\d+)[,.](\d{1,2})(?!\d)/);
  if (matchDecimal) return `${matchDecimal[1]}.${matchDecimal[2].padEnd(2, '0')}`;

  const temCentavos = t.includes('centavos');
  let parteReais = t;
  let parteCentavos = '';

  if (temCentavos) {
    const sepDouble = t.match(/^(.*?)\s{2,}(?:(?:e|com|virgula|ponto)\s+)?(.*?)\s*centavos/);
    if (sepDouble && sepDouble[2]) {
      parteReais    = sepDouble[1].trim();
      parteCentavos = sepDouble[2].trim();
    } else {
      const sepConn = t.match(/^(.*)\s+(?:e|com|virgula|ponto)\s+(.*?)\s*centavos/);
      if (sepConn) {
        parteReais    = sepConn[1].trim();
        parteCentavos = sepConn[2].trim();
      } else {
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

export function interpretarTipo(texto: string): 'despesa' | 'receita' | null {
  const t = normalizar(texto);
  if (t.includes('despesa') || t.includes('gasto') || t.includes('pagamento') || t.includes('despeza')) return 'despesa';
  if (t.includes('receita') || t.includes('receb') || t.includes('entrada') || t.includes('ganho') || t.includes('renda') || t.includes('receite')) return 'receita';
  let tipo: 'despesa' | 'receita' | null = null;
  if (!tipo && t.length < 8) {
    if (t.includes('d') || t.includes('desp')) tipo = 'despesa';
    else if (t.includes('r') || t.includes('rec')) tipo = 'receita';
  }
  return tipo;
}

export function ehPix(t: string): boolean {
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

export function interpretarFormaPag(texto: string): string {
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

export function interpretarFormaPagReceita(texto: string): string {
  const t = normalizar(texto);
  if (ehPix(t)) return 'Pix';
  if (t.includes('deposito') || t.includes('depositar') || t.includes('depósito')) return 'Depósito';
  if (t.includes('transferencia') || t.includes('transferência') || t.includes('ted') || t.includes('doc')) return 'Transferência';
  if (t.includes('dinheiro') || t.includes('especie') || t.includes('cash')) return 'Dinheiro';
  if (t.includes('credito') || t.includes('cartao')) return 'Crédito';
  return '';
}

export function interpretarParcelas(texto: string): string {
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
