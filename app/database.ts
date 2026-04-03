import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('financaspro.db');

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
  } catch (e) {
    // Coluna ja existe, ignorar
  }
}

export function inserirLancamento(item: {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  categoria: string;
  formaPag: string;
  cartaoId: string;
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
    `INSERT INTO lancamentos (id, tipo, descricao, valor, categoria, formaPag, cartaoId, parcelas, parcelaAtual, totalParcelas, data, dataVencimento, status, obs, grupoId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [item.id, item.tipo, item.descricao, item.valor, item.categoria, item.formaPag, item.cartaoId, item.parcelas, item.parcelaAtual, item.totalParcelas, item.data, item.dataVencimento, item.status, item.obs, item.grupoId]
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
  const grupoId = Date.now().toString();
  const valorParcela = dados.valorTotal / dados.totalParcelas;

  const [dia, mes, ano] = dados.dataCompra.split('/').map(Number);
  const dataCompraObj = new Date(ano, mes - 1, dia);

  for (let i = 0; i < dados.totalParcelas; i++) {
    const dataVenc = calcularVencimento(dataCompraObj, i, dados.diaFechamento, dados.diaVencimento);
    const id = `${grupoId}_${i+1}`;

    db.runSync(
      `INSERT INTO lancamentos (id, tipo, descricao, valor, categoria, formaPag, cartaoId, parcelas, parcelaAtual, totalParcelas, data, dataVencimento, status, obs, grupoId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, dados.tipo,
        `${dados.descricao} (${i+1}/${dados.totalParcelas})`,
        valorParcela,
        dados.categoria, dados.formaPag, dados.cartaoId,
        dados.totalParcelas, i + 1, dados.totalParcelas,
        dados.dataCompra,
        dataVenc,
        'parcelado',
        dados.obs, grupoId
      ]
    );
  }
}

function calcularVencimento(dataCompra: Date, indiceParcela: number, diaFechamento: number, diaVencimento: number): string {
  const diaCompra = dataCompra.getDate();
  const mesCompra = dataCompra.getMonth();
  const anoCompra = dataCompra.getFullYear();

  let mesBase = mesCompra;
  let anoBase = anoCompra;

  if (diaCompra > diaFechamento) {
    mesBase += 1;
  }

  mesBase += indiceParcela;

  while (mesBase > 11) {
    mesBase -= 12;
    anoBase += 1;
  }

  const dia = String(diaVencimento).padStart(2, '0');
  const mes = String(mesBase + 1).padStart(2, '0');
  return `${dia}/${mes}/${anoBase}`;
}

export function buscarLancamentos(): any[] {
  return db.getAllSync('SELECT * FROM lancamentos ORDER BY createdAt DESC');
}

export function buscarLancamentosPorMes(mes: number, ano: number): any[] {
  return db.getAllSync(
    `SELECT * FROM lancamentos WHERE dataVencimento LIKE ? OR (dataVencimento = '' AND data LIKE ?) ORDER BY createdAt DESC`,
    [`%/${String(mes).padStart(2,'0')}/${ano}`, `%/${String(mes).padStart(2,'0')}/${ano}`]
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
    `SELECT * FROM lancamentos WHERE cartaoId = ? AND dataVencimento LIKE ?`,
    [cartaoId, `%/${String(mes).padStart(2,'0')}/${ano}`]
  );
  return itens.reduce((s: number, l: any) => s + l.valor, 0);
}

export function buscarTodosLancamentos(): any[] {
  return db.getAllSync('SELECT * FROM lancamentos');
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