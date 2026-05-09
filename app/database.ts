import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('financaspro.db');

export function gerarId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function initDB() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS lancamentos (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      valor REAL NOT NULL,
      categoria TEXT,
      formaPag TEXT,
      cartaoId TEXT,
      parcelas INTEGER DEFAULT 1,
      parcelaAtual INTEGER DEFAULT 1,
      totalParcelas INTEGER DEFAULT 1,
      data TEXT,
      dataVencimento TEXT,
      dataPagamento TEXT,
      status TEXT DEFAULT 'pago',
      obs TEXT,
      grupoId TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cartoes (
      id TEXT PRIMARY KEY,
      apelido TEXT,
      bandeira TEXT,
      ultimos4 TEXT,
      fechamento TEXT,
      vencimento TEXT,
      limite TEXT
    );

    CREATE TABLE IF NOT EXISTS contas (
      id TEXT PRIMARY KEY,
      nome TEXT,
      banco TEXT,
      tipo TEXT,
      saldo REAL DEFAULT 0
    );
  `);

  try {
    db.execSync(`ALTER TABLE lancamentos ADD COLUMN dataPagamento TEXT`);
  } catch (e) {}

  try {
    db.execSync(`ALTER TABLE lancamentos ADD COLUMN contaId TEXT DEFAULT ''`);
  } catch (e) {}

  migrarCategorias();
}

function migrarCategorias() {
  try {
    const correcoes = [
      ['Alimentacao', 'Supermercado'],
      ['Alimentação', 'Supermercado'],
      ['Mercado', 'Supermercado'],
      ['Lazer', 'Lazer e Entretenimento'],
      ['Entretenimento', 'Lazer e Entretenimento'],
      ['Combustivel', 'Combustível'],
      ['Educacao', 'Educação'],
      ['Farmacia', 'Farmácia'],
      ['Manutencao', 'Manutenção'],
      ['Reformas', 'Manutenção'],
      ['Saude', 'Saúde'],
      ['Vestuario', 'Vestuário'],
      ['Salario', 'Salário'],
      ['Pro-labore', 'Pró-labore'],
    ];

    for (const [de, para] of correcoes) {
      db.runSync(
        `UPDATE lancamentos SET categoria = ? WHERE categoria = ? COLLATE NOCASE`,
        [para, de]
      );
    }
  } catch (e) {}
}

export function inserirLancamento(item: {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  categoria: string;
  formaPag: string;
  cartaoId: string;
  contaId?: string;
  parcelas: number;
  parcelaAtual: number;
  totalParcelas: number;
  data: string;
  dataVencimento: string;
  status: string;
  obs: string;
  grupoId: string;
}) {
  db.runSync(
    `INSERT INTO lancamentos (id, tipo, descricao, valor, categoria, formaPag, cartaoId, contaId, parcelas, parcelaAtual, totalParcelas, data, dataVencimento, status, obs, grupoId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [item.id, item.tipo, item.descricao, item.valor, item.categoria, item.formaPag, item.cartaoId, item.contaId || '', item.parcelas, item.parcelaAtual, item.totalParcelas, item.data, item.dataVencimento, item.status, item.obs, item.grupoId]
  );
}

export function inserirLancamentosParcelados(dados: {
  descricao: string;
  valorTotal: number;
  categoria: string;
  formaPag: string;
  cartaoId: string;
  totalParcelas: number;
  dataCompra: string;
  diaVencimento: number;
  diaFechamento: number;
  status: string;
  obs: string;
  tipo: string;
}) {
  const grupoId = gerarId();
  const valorParcela = dados.valorTotal / dados.totalParcelas;
  const [dia, mes, ano] = dados.dataCompra.split('/').map(Number);
  const dataCompraObj = new Date(ano, mes - 1, dia);

  for (let i = 0; i < dados.totalParcelas; i++) {
    const dataVenc = calcularVencimento(dataCompraObj, i, dados.diaFechamento, dados.diaVencimento);
    const id = `${grupoId}_${i+1}`;
    db.runSync(
      `INSERT INTO lancamentos (id, tipo, descricao, valor, categoria, formaPag, cartaoId, parcelas, parcelaAtual, totalParcelas, data, dataVencimento, status, obs, grupoId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, dados.tipo, `${dados.descricao} (${i+1}/${dados.totalParcelas})`, valorParcela,
       dados.categoria, dados.formaPag, dados.cartaoId, dados.totalParcelas, i + 1, dados.totalParcelas,
       dados.dataCompra, dataVenc, 'parcelado', dados.obs, grupoId]
    );
  }
}

function calcularVencimento(dataCompra: Date, indiceParcela: number, diaFechamento: number, diaVencimento: number): string {
  const mesCompra = dataCompra.getMonth(); // 0-based
  const anoCompra = dataCompra.getFullYear();
  let mesBase = mesCompra + 1 + indiceParcela;
  let anoBase = anoCompra;
  while (mesBase > 11) { mesBase -= 12; anoBase += 1; }
  const dia = String(diaVencimento).padStart(2, '0');
  const mes = String(mesBase + 1).padStart(2, '0');
  return `${dia}/${mes}/${anoBase}`;
}

export function buscarLancamentos(): any[] {
  return db.getAllSync(`SELECT * FROM lancamentos ORDER BY createdAt DESC`);
}

export function buscarLancamentosPorMes(mes: number, ano: number): any[] {
  const padded = String(mes).padStart(2, '0');
  return db.getAllSync(
    `SELECT * FROM lancamentos
     WHERE dataVencimento LIKE ? OR data LIKE ?
     ORDER BY createdAt DESC`,
    [`%/${padded}/${ano}`, `%/${padded}/${ano}`]
  );
}

export function deletarLancamento(id: string) {
  db.runSync('DELETE FROM lancamentos WHERE id = ?', [id]);
}

export function deletarGrupoLancamentos(grupoId: string) {
  db.runSync('DELETE FROM lancamentos WHERE grupoId = ?', [grupoId]);
}

export function atualizarLancamento(id: string, descricao: string, valor: number, categoria: string, status: string, dataPagamento: string) {
  db.runSync(
    'UPDATE lancamentos SET descricao = ?, valor = ?, categoria = ?, status = ?, dataPagamento = ? WHERE id = ?',
    [descricao, valor, categoria, status, dataPagamento, id]
  );
}

export function atualizarLancamentoCompleto(id: string, fields: {
  descricao: string;
  valor: number;
  categoria: string;
  status: string;
  dataPagamento: string;
  obs: string;
  data: string;
  dataVencimento: string;
  cartaoId: string;
}) {
  db.runSync(
    `UPDATE lancamentos
     SET descricao = ?, valor = ?, categoria = ?, status = ?, dataPagamento = ?,
         obs = ?, data = ?, dataVencimento = ?, cartaoId = ?
     WHERE id = ?`,
    [fields.descricao, fields.valor, fields.categoria, fields.status,
     fields.dataPagamento, fields.obs, fields.data, fields.dataVencimento,
     fields.cartaoId, id]
  );
}

export function atualizarGrupoLancamentos(grupoId: string, categoria: string, valorParcela: number) {
  db.runSync(
    'UPDATE lancamentos SET categoria = ?, valor = ? WHERE grupoId = ?',
    [categoria, valorParcela, grupoId]
  );
}

export function pagarFaturaCartao(cartaoId: string, mes: number, ano: number, dataPagamento: string): number {
  const mesStr = String(mes).padStart(2, '0');
  const result = db.runSync(
    `UPDATE lancamentos SET status = 'pago', dataPagamento = ?
     WHERE cartaoId = ? AND dataVencimento LIKE ? AND status != 'pago'`,
    [dataPagamento, cartaoId, `%/${mesStr}/${ano}`]
  );
  return result.changes;
}

export function buscarFaturaCartao(cartaoId: string, mes: number, ano: number): any[] {
  const mesStr = String(mes).padStart(2, '0');
  return db.getAllSync(
    `SELECT * FROM lancamentos WHERE cartaoId = ? AND dataVencimento LIKE ? ORDER BY parcelaAtual ASC`,
    [cartaoId, `%/${mesStr}/${ano}`]
  );
}

export function buscarTotaisMes(mes: number, ano: number) {
  const lancamentos = buscarLancamentosPorMes(mes, ano);
  const totalGasto = lancamentos.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0);
  const totalReceita = lancamentos.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0);
  return { totalGasto, totalReceita, saldo: totalReceita - totalGasto };
}

export function buscarLancamentosPorCartao(cartaoId: string): any[] {
  return db.getAllSync(
    'SELECT * FROM lancamentos WHERE cartaoId = ? ORDER BY dataVencimento ASC',
    [cartaoId]
  );
}

export function buscarTotalUsadoCartao(cartaoId: string, mes: number, ano: number): number {
  const itens = db.getAllSync(
    `SELECT * FROM lancamentos WHERE cartaoId = ? AND (status = 'parcelado' OR status = 'pendente')`,
    [cartaoId]
  ) as any[];

  // Para grupos parcelados, conta apenas as parcelas não pagas.
  // Para lançamentos sem grupoId, inclui diretamente.
  const gruposContados = new Set<string>();
  let total = 0;

  for (const l of itens) {
    if (l.grupoId) {
      if (!gruposContados.has(l.grupoId)) {
        gruposContados.add(l.grupoId);
        const parcelasNaoPagas = itens.filter(
          (p: any) => p.grupoId === l.grupoId && (p.status === 'parcelado' || p.status === 'pendente')
        );
        total += parcelasNaoPagas.reduce((s: number, p: any) => s + p.valor, 0);
      }
    } else {
      total += l.valor;
    }
  }

  return total;
}

export function buscarLancamentosEmAtraso(): any[] {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const pendentes = db.getAllSync(
    `SELECT * FROM lancamentos WHERE status != 'pago' AND dataVencimento IS NOT NULL AND dataVencimento != ''`
  ) as any[];
  return pendentes.filter(l => {
    const parts = l.dataVencimento.split('/');
    if (parts.length !== 3) return false;
    const [dia, mes, ano] = parts.map(Number);
    return new Date(ano, mes - 1, dia) < hoje;
  });
}

export function buscarTodosLancamentos(): any[] {
  return db.getAllSync('SELECT * FROM lancamentos ORDER BY dataVencimento ASC');
}

export function zerarLancamentos() {
  db.runSync('DELETE FROM lancamentos');
}

export function restaurarLancamentos(lancamentos: any[]) {
  db.runSync('DELETE FROM lancamentos');
  for (const l of lancamentos) {
    db.runSync(
      `INSERT OR REPLACE INTO lancamentos (id, tipo, descricao, valor, categoria, formaPag, cartaoId, parcelas, parcelaAtual, totalParcelas, data, dataVencimento, dataPagamento, status, obs, grupoId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [l.id, l.tipo, l.descricao, l.valor, l.categoria, l.formaPag, l.cartaoId, l.parcelas, l.parcelaAtual, l.totalParcelas, l.data, l.dataVencimento, l.dataPagamento || '', l.status, l.obs, l.grupoId, l.createdAt]
    );
  }
}

// ===== CARTÕES =====

export function buscarCartoes(): any[] {
  return db.getAllSync(`SELECT * FROM cartoes ORDER BY apelido ASC`);
}

export function inserirCartao(cartao: {
  id: string; apelido: string; bandeira: string; ultimos4: string;
  fechamento: string; vencimento: string; limite: string;
}) {
  db.runSync(
    `INSERT OR REPLACE INTO cartoes (id, apelido, bandeira, ultimos4, fechamento, vencimento, limite)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [cartao.id, cartao.apelido, cartao.bandeira, cartao.ultimos4, cartao.fechamento, cartao.vencimento, cartao.limite]
  );
}

export function atualizarCartao(id: string, dados: {
  apelido: string; bandeira: string; ultimos4: string;
  fechamento: string; vencimento: string; limite: string;
}) {
  db.runSync(
    `UPDATE cartoes SET apelido = ?, bandeira = ?, ultimos4 = ?, fechamento = ?, vencimento = ?, limite = ? WHERE id = ?`,
    [dados.apelido, dados.bandeira, dados.ultimos4, dados.fechamento, dados.vencimento, dados.limite, id]
  );
}

export function deletarCartao(id: string) {
  db.runSync('DELETE FROM cartoes WHERE id = ?', [id]);
}

export function restaurarCartoes(cartoes: any[]) {
  db.runSync('DELETE FROM cartoes');
  for (const c of cartoes) {
    db.runSync(
      `INSERT OR REPLACE INTO cartoes (id, apelido, bandeira, ultimos4, fechamento, vencimento, limite)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.apelido || '', c.bandeira || '', c.ultimos4 || '', c.fechamento || '', c.vencimento || '', c.limite || '']
    );
  }
}