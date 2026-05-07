import {
  normalizar,
  somarExtenso,
  interpretarValor,
  interpretarTipo,
  ehPix,
  interpretarFormaPag,
  interpretarFormaPagReceita,
  interpretarParcelas,
  detectarCategoria,
} from '../app/voz-utils';

// ─── normalizar ───────────────────────────────────────────────────────────────

describe('normalizar', () => {
  it('converte para minúsculas', () => {
    expect(normalizar('OLÁRIO MUNDO')).toBe('olario mundo');
  });
  it('remove acentos', () => {
    expect(normalizar('café açúcar')).toBe('cafe acucar');
  });
  it('remove espaços nas bordas', () => {
    expect(normalizar('  texto  ')).toBe('texto');
  });
  it('normaliza vogais acentuadas diversas', () => {
    expect(normalizar('ÁÉÍÓÚáéíóúâêô')).toBe('aeiouaeiouaeo');
  });
  it('string vazia retorna vazia', () => {
    expect(normalizar('')).toBe('');
  });
});

// ─── somarExtenso ─────────────────────────────────────────────────────────────

describe('somarExtenso', () => {
  it('tokens vazios retornam 0', () => {
    expect(somarExtenso([])).toBe(0);
  });
  it('palavra simples: quinze', () => {
    expect(somarExtenso(['quinze'])).toBe(15);
  });
  it('cem', () => {
    expect(somarExtenso(['cem'])).toBe(100);
  });
  it('dois mil', () => {
    expect(somarExtenso(['dois', 'mil'])).toBe(2000);
  });
  it('dígito como multiplicador: 10 mil', () => {
    expect(somarExtenso(['10', 'mil'])).toBe(10000);
  });
  it('5 mil', () => {
    expect(somarExtenso(['5', 'mil'])).toBe(5000);
  });
  it('dois mil trezentos', () => {
    expect(somarExtenso(['dois', 'mil', 'trezentos'])).toBe(2300);
  });
  it('2 mil 300 (misto dígito+extenso)', () => {
    expect(somarExtenso(['2', 'mil', '300'])).toBe(2300);
  });
  it('trezentos e cinquenta (conector "e" ignorado)', () => {
    expect(somarExtenso(['trezentos', 'e', 'cinquenta'])).toBe(350);
  });
  it('mil quinhentos', () => {
    expect(somarExtenso(['mil', 'quinhentos'])).toBe(1500);
  });
  it('um milhão', () => {
    expect(somarExtenso(['um', 'milhao'])).toBe(1_000_000);
  });
  it('dígito como base de milhão: 1 milhão', () => {
    expect(somarExtenso(['1', 'milhao'])).toBe(1_000_000);
  });
  it('sete mil e novecentos', () => {
    expect(somarExtenso(['sete', 'mil', 'e', 'novecentos'])).toBe(7900);
  });
});

// ─── interpretarValor ────────────────────────────────────────────────────────

describe('interpretarValor', () => {
  // ── Números diretos ────────────────────────────────────────────────────────
  it('inteiro simples: "50"', () => {
    expect(interpretarValor('50')).toBe('50');
  });
  it('decimal com vírgula: "150,30"', () => {
    expect(interpretarValor('150,30')).toBe('150.30');
  });
  it('com prefixo R$: "R$ 45"', () => {
    expect(interpretarValor('R$ 45')).toBe('45');
  });
  it('separador de milhar europeu: "1.200"', () => {
    expect(interpretarValor('1.200')).toBe('1200');
  });
  it('milhar europeu com centavos: "1.200,50"', () => {
    expect(interpretarValor('1.200,50')).toBe('1200.50');
  });
  it('dezena de milhar: "10.000"', () => {
    expect(interpretarValor('10.000')).toBe('10000');
  });
  it('decimal puro menor que 1: "0,90"', () => {
    expect(interpretarValor('0,90')).toBe('0.90');
  });

  // ── Separador de centavos spoken ───────────────────────────────────────────
  it('"258 com 52"', () => {
    expect(interpretarValor('258 com 52')).toBe('258.52');
  });
  it('"258 e 52"', () => {
    expect(interpretarValor('258 e 52')).toBe('258.52');
  });
  it('"100 virgula 99"', () => {
    expect(interpretarValor('100 virgula 99')).toBe('100.99');
  });

  // ── Por extenso puro ───────────────────────────────────────────────────────
  it('"cem"', () => {
    expect(interpretarValor('cem')).toBe('100');
  });
  it('"duzentos"', () => {
    expect(interpretarValor('duzentos')).toBe('200');
  });
  it('"novecentos"', () => {
    expect(interpretarValor('novecentos')).toBe('900');
  });
  it('"vinte e cinco"', () => {
    expect(interpretarValor('vinte e cinco')).toBe('25');
  });
  it('"trezentos e cinquenta"', () => {
    expect(interpretarValor('trezentos e cinquenta')).toBe('350');
  });
  it('"dez mil"', () => {
    expect(interpretarValor('dez mil')).toBe('10000');
  });
  it('"dois mil e trezentos"', () => {
    expect(interpretarValor('dois mil e trezentos')).toBe('2300');
  });
  it('"mil e quinhentos"', () => {
    expect(interpretarValor('mil e quinhentos')).toBe('1500');
  });
  it('"um milhão"', () => {
    expect(interpretarValor('um milhão')).toBe('1000000');
  });

  // ── Misto dígito + extenso ────────────────────────────────────────────────
  it('"10 mil"', () => {
    expect(interpretarValor('10 mil')).toBe('10000');
  });
  it('"5 mil"', () => {
    expect(interpretarValor('5 mil')).toBe('5000');
  });
  it('"2 mil e 300"', () => {
    expect(interpretarValor('2 mil e 300')).toBe('2300');
  });

  // ── Com centavos ──────────────────────────────────────────────────────────
  it('"cem reais e quinze centavos"', () => {
    expect(interpretarValor('cem reais e quinze centavos')).toBe('100.15');
  });
  it('"vinte reais e cinquenta centavos"', () => {
    expect(interpretarValor('vinte reais e cinquenta centavos')).toBe('20.5');
  });
  it('"dez mil e quinze centavos" (sem "reais")', () => {
    expect(interpretarValor('dez mil e quinze centavos')).toBe('10000.15');
  });
  it('"quinze centavos" (só centavos)', () => {
    expect(interpretarValor('quinze centavos')).toBe('0.15');
  });

  // ── Entradas inválidas ─────────────────────────────────────────────────────
  it('string vazia retorna ""', () => {
    expect(interpretarValor('')).toBe('');
  });
  it('palavra desconhecida retorna ""', () => {
    expect(interpretarValor('abcdef')).toBe('');
  });
  it('"zero" sozinho retorna "" (valor inválido para lançamento)', () => {
    expect(interpretarValor('zero')).toBe('');
  });
});

// ─── interpretarTipo ─────────────────────────────────────────────────────────

describe('interpretarTipo', () => {
  it('"despesa"', () => {
    expect(interpretarTipo('despesa')).toBe('despesa');
  });
  it('"é uma despesa hoje"', () => {
    expect(interpretarTipo('é uma despesa hoje')).toBe('despesa');
  });
  it('"gasto" → despesa', () => {
    expect(interpretarTipo('gasto')).toBe('despesa');
  });
  it('"pagamento" → despesa', () => {
    expect(interpretarTipo('pagamento')).toBe('despesa');
  });
  it('"despeza" (typo fonético) → despesa', () => {
    expect(interpretarTipo('despeza')).toBe('despesa');
  });
  it('"receita"', () => {
    expect(interpretarTipo('receita')).toBe('receita');
  });
  it('"entrada de dinheiro" → receita', () => {
    expect(interpretarTipo('entrada de dinheiro')).toBe('receita');
  });
  it('"ganho" → receita', () => {
    expect(interpretarTipo('ganho')).toBe('receita');
  });
  it('"renda" → receita', () => {
    expect(interpretarTipo('renda')).toBe('receita');
  });
  it('"receite" (typo fonético) → receita', () => {
    expect(interpretarTipo('receite')).toBe('receita');
  });
  it('"recebimento" → receita (prefixo "receb")', () => {
    expect(interpretarTipo('recebimento')).toBe('receita');
  });
  it('palavra desconhecida → null', () => {
    expect(interpretarTipo('xpto')).toBeNull();
  });
  it('string vazia → null', () => {
    expect(interpretarTipo('')).toBeNull();
  });
});

// ─── ehPix ───────────────────────────────────────────────────────────────────

describe('ehPix', () => {
  it('"pix"', () => expect(ehPix('pix')).toBe(true));
  it('"pics" (variação fonética)', () => expect(ehPix('pics')).toBe(true));
  it('"pi" (reconhecimento parcial)', () => expect(ehPix('pi')).toBe(true));
  it('"pique" (variação fonética)', () => expect(ehPix('pique')).toBe(true));
  it('"pick"', () => expect(ehPix('pick')).toBe(true));
  it('"bix"', () => expect(ehPix('bix')).toBe(true));
  it('"fix"', () => expect(ehPix('fix')).toBe(true));
  it('"phix"', () => expect(ehPix('phix')).toBe(true));
  it('"debito" → false', () => expect(ehPix('debito')).toBe(false));
  it('"boleto" → false', () => expect(ehPix('boleto')).toBe(false));
  it('"dinheiro" → false', () => expect(ehPix('dinheiro')).toBe(false));
});

// ─── interpretarFormaPag ─────────────────────────────────────────────────────

describe('interpretarFormaPag', () => {
  it('"crédito"', () => expect(interpretarFormaPag('crédito')).toBe('Credito'));
  it('"cartão de crédito"', () => expect(interpretarFormaPag('cartão de crédito')).toBe('Credito'));
  it('"débito"', () => expect(interpretarFormaPag('débito')).toBe('Debito'));
  it('"debto" (typo fonético) → Debito', () => expect(interpretarFormaPag('debto')).toBe('Debito'));
  it('"pix"', () => expect(interpretarFormaPag('pix')).toBe('Pix'));
  it('"pics" → Pix (variação)', () => expect(interpretarFormaPag('pics')).toBe('Pix'));
  it('"dinheiro"', () => expect(interpretarFormaPag('dinheiro')).toBe('Dinheiro'));
  it('"espécie"', () => expect(interpretarFormaPag('espécie')).toBe('Dinheiro'));
  it('"boleto"', () => expect(interpretarFormaPag('boleto')).toBe('Boleto'));
  it('"transferência"', () => expect(interpretarFormaPag('transferência')).toBe('Transferência'));
  it('"TED"', () => expect(interpretarFormaPag('TED')).toBe('Transferência'));
  it('"depósito"', () => expect(interpretarFormaPag('depósito')).toBe('Depósito'));
  it('"outro"', () => expect(interpretarFormaPag('outro')).toBe('Outro'));
  it('"cheque" (não suportado) → ""', () => expect(interpretarFormaPag('cheque')).toBe(''));
});

// ─── interpretarFormaPagReceita ──────────────────────────────────────────────

describe('interpretarFormaPagReceita', () => {
  it('"pix"', () => expect(interpretarFormaPagReceita('pix')).toBe('Pix'));
  it('"depósito"', () => expect(interpretarFormaPagReceita('depósito')).toBe('Depósito'));
  it('"transferência"', () => expect(interpretarFormaPagReceita('transferência')).toBe('Transferência'));
  it('"TED"', () => expect(interpretarFormaPagReceita('TED')).toBe('Transferência'));
  it('"dinheiro"', () => expect(interpretarFormaPagReceita('dinheiro')).toBe('Dinheiro'));
  it('"crédito" → Crédito (receita via cartão)', () => expect(interpretarFormaPagReceita('crédito')).toBe('Crédito'));
  it('"boleto" (não suportado para receita) → ""', () => expect(interpretarFormaPagReceita('boleto')).toBe(''));
});

// ─── interpretarParcelas ─────────────────────────────────────────────────────

describe('interpretarParcelas', () => {
  it('"à vista" → 1', () => expect(interpretarParcelas('à vista')).toBe('1'));
  it('"uma vez" → 1', () => expect(interpretarParcelas('uma vez')).toBe('1'));
  it('"um" → 1', () => expect(interpretarParcelas('um')).toBe('1'));
  it('"1" → 1', () => expect(interpretarParcelas('1')).toBe('1'));
  it('"único" → 1', () => expect(interpretarParcelas('único')).toBe('1'));
  it('"duas" → 2', () => expect(interpretarParcelas('duas')).toBe('2'));
  it('"três" → 3', () => expect(interpretarParcelas('três')).toBe('3'));
  it('"seis" → 6', () => expect(interpretarParcelas('seis')).toBe('6'));
  it('"doze" → 12', () => expect(interpretarParcelas('doze')).toBe('12'));
  it('"6" (dígito direto) → 6', () => expect(interpretarParcelas('6')).toBe('6'));
  it('"vinte" → 20', () => expect(interpretarParcelas('vinte')).toBe('20'));
  it('sem correspondência → fallback "1"', () => expect(interpretarParcelas('abcxyz')).toBe('1'));
});

// ─── detectarCategoria ───────────────────────────────────────────────────────

describe('detectarCategoria', () => {
  it('"Fui ao mercado" → Supermercado', () => {
    expect(detectarCategoria('Fui ao mercado')).toBe('Supermercado');
  });
  it('"Farmácia" → Farmácia', () => {
    expect(detectarCategoria('Farmácia')).toBe('Farmácia');
  });
  it('"Médico pediatra" → Saúde', () => {
    expect(detectarCategoria('Médico pediatra')).toBe('Saúde');
  });
  it('"Uber" → Transporte', () => {
    expect(detectarCategoria('Uber')).toBe('Transporte');
  });
  it('"Netflix mensal" → Assinaturas Digitais', () => {
    expect(detectarCategoria('Netflix mensal')).toBe('Assinaturas Digitais');
  });
  it('"Academia de musculação" → Esportes', () => {
    expect(detectarCategoria('Academia de musculação')).toBe('Esportes');
  });
  it('"Salário de maio" → Salário', () => {
    expect(detectarCategoria('Salário de maio')).toBe('Salário');
  });
  it('"Escola particular" → Educação', () => {
    expect(detectarCategoria('Escola particular')).toBe('Educação');
  });
  it('"Compra desconhecida xyz" → "" (sem categoria)', () => {
    expect(detectarCategoria('Compra desconhecida xyz')).toBe('');
  });
});
