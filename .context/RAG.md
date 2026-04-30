# RAG — Referência Técnica de Funções e Arquivos

## database.ts — Camada de dados SQLite

Arquivo: `app/database.ts`
Banco: `financaspro.db` (SQLite local via expo-sqlite)

| Função                         | Linha | O que faz                                                              |
|--------------------------------|-------|------------------------------------------------------------------------|
| `gerarId()`                    | 5     | Gera ID único: `${Date.now()}_${random}`. Usar sempre no lugar de UUID |
| `initDB()`                     | 9     | Cria tabelas, roda migrations de ALTER TABLE e migrarCategorias()      |
| `migrarCategorias()`           | 61    | Normaliza categorias legadas (ex: "Alimentacao" → "Supermercado")      |
| `inserirLancamento(item)`      | 89    | INSERT simples de 1 lançamento                                         |
| `inserirLancamentosParcelados` | 114   | Gera N parcelas com vencimentos calculados, mesmo grupoId              |
| `calcularVencimento()`         | 146   | Calcula data de vencimento por índice de parcela, fechamento e venc.   |
| `buscarLancamentos()`          | 157   | SELECT * ORDER BY createdAt DESC (todos os lançamentos)                |
| `buscarLancamentosPorMes()`    | 161   | Filtra por dataVencimento LIKE %/MM/YYYY (cai em data se nulo)         |
| `deletarLancamento(id)`        | 170   | DELETE por id                                                          |
| `deletarGrupoLancamentos()`    | 174   | DELETE por grupoId (apaga todas as parcelas de um grupo)               |
| `atualizarLancamento()`        | 178   | UPDATE básico: descricao, valor, categoria, status, dataPagamento      |
| `atualizarLancamentoCompleto()`| 185   | UPDATE completo com obs, data, dataVencimento, cartaoId                |
| `atualizarGrupoLancamentos()`  | 207   | UPDATE de categoria e valor em todas as parcelas de um grupo           |
| `pagarFaturaCartao()`          | 214   | Marca todas as parcelas do cartão no mês como 'pago'                   |
| `buscarFaturaCartao()`         | 224   | SELECT parcelas de um cartão por mês/ano                               |
| `buscarTotaisMes()`            | 232   | Retorna { totalGasto, totalReceita, saldo } do mês                     |
| `buscarTotalUsadoCartao()`     | 246   | Soma parcelas não pagas agrupando por grupoId (evita dupla contagem)   |
| `buscarLancamentosEmAtraso()`  | 274   | Retorna lançamentos com dataVencimento < hoje e status != 'pago'       |
| `buscarTodosLancamentos()`     | 288   | SELECT * ORDER BY dataVencimento ASC (para backup)                     |
| `zerarLancamentos()`           | 292   | DELETE FROM lancamentos (destrutivo)                                   |
| `restaurarLancamentos(arr)`    | 296   | Apaga tudo e faz INSERT OR REPLACE para cada item do array             |
| `buscarCartoes()`              | 309   | SELECT * FROM cartoes ORDER BY apelido ASC                             |
| `inserirCartao()`              | 313   | INSERT OR REPLACE                                                      |
| `atualizarCartao()`            | 324   | UPDATE cartão por id                                                   |
| `deletarCartao(id)`            | 334   | DELETE cartão por id                                                   |
| `restaurarCartoes(arr)`        | 338   | Apaga tudo e restaura do array de backup                               |

---

## voz.tsx — Entrada por voz

Arquivo: `app/voz.tsx`

### Tipos e constantes

| Símbolo              | Linha | Descrição                                                          |
|----------------------|-------|--------------------------------------------------------------------|
| `LIMITE_GRATIS`      | 16    | `150` — limite real de lançamentos no plano grátis                 |
| `VOZ_TUTORIAL_LIMITE`| 14    | `3` — número de sessões com tutorial completo                      |
| `Etapa` (type)       | 20    | Union: tipo\|descricao\|valor\|categoria\|formaPag\|cartao\|parcelas\|conta\|contaReceita\|obs\|confirmacao |
| `MAP_CATEGORIA`      | 56    | Dicionário palavra→categoria canônica para detecção automática     |
| `PALAVRAS_NUM`       | 115   | Dicionário extenso→número para somarExtenso()                      |
| `DICAS`              | 315   | Array de dicas de pronúncia exibidas na UI                         |

### Funções utilitárias

| Função                    | Linha | Descrição                                                                      |
|---------------------------|-------|--------------------------------------------------------------------------------|
| `normalizar(texto)`       | 96    | toLowerCase + remove acentos NFD + trim                                        |
| `capitalizarPalavras()`   | 100   | Capitaliza primeira letra de cada palavra                                      |
| `detectarCategoria(desc)` | 104   | Detecta categoria pela descrição usando MAP_CATEGORIA com `\bpalavra\b` regex  |
| `somarExtenso(tokens[])`  | 154   | Converte array de tokens (palavras ou dígitos) em número inteiro               |
| `interpretarValor(texto)` | 180   | **FUNÇÃO PRINCIPAL** — Converte texto falado em string numérica (ex: "258.52") |
| `interpretarTipo(texto)`  | 239   | Retorna 'despesa', 'receita' ou null                                           |
| `ehPix(t)`                | 247   | Detecta ~20 variações fonéticas de "Pix" que o STT pt-BR pode gerar           |
| `interpretarFormaPag()`   | 262   | Detecta forma de pagamento para despesas                                       |
| `interpretarFormaPagReceita()` | 276 | Detecta forma de recebimento para receitas (Pix, Depósito, Transferência, Dinheiro) |
| `interpretarParcelas()`   | 286   | Converte extenso ou número em string de parcelas ("1" a "20")                  |
| `hoje()`                  | 306   | Retorna data atual como `DD/MM/YYYY`                                           |

### Lógica de `interpretarValor` (detalhado)

```
1. Remove "R$", "reais", normaliza acentos; adiciona espaço antes de "centavos"
2. Tenta match "258 52" (dois números separados = reais.centavos)
3. Tenta número direto (ex: "150", "150.30", "150,30")
4. Tenta separador de milhar europeu (ex: "1.200" → 1200, "1.200,50" → 1200.50)
5. Tenta padrão decimal "X,YY"
6. Extenso — split reais/centavos em 3 tentativas:
   a) Duplo espaço criado ao remover "reais": "cem reais e X centavos" → "cem  e X centavos"
   b) Conector explícito sem "reais" (busca gananciosa = último conector):
      "dez mil e quinze centavos" → reais="dez mil", centavos="quinze"
   c) Sem reais: "quinze centavos" → reais="", centavos="quinze"
7. Chama somarExtenso() para reais e centavos separadamente
8. Retorna string sem zeros à direita desnecessários

Casos de teste confirmados:
  "dez mil"                          → "10000"
  "mil e duzentos"                   → "1200"
  "cem reais e quinze centavos"      → "100.15"
  "dez mil e quinze centavos"        → "10000.15"  ← fix (antes retornava "10015")
  "quinze centavos"                  → "0.15"
  "dez mil reais e cinquenta centavos" → "10000.5"
```

### Lógica de `somarExtenso` (detalhado)

```
Itera tokens. Para cada token:
- Busca em PALAVRAS_NUM (dicionário) OU tenta parseInt
- Se >= 1.000.000: total += (atual || 1) * n; atual = 0
- Se == 1.000: total += (atual || 1) * 1000; atual = 0
- Senão: atual += n
Retorna total + atual
Exemplos: ["10","mil"] → 10000, ["dois","mil","trezentos"] → 2300
```

### Fluxo de etapas (máquina de estados)

```
tipo → descricao → valor →
  se despesa crédito:  → categoria? → formaPag → cartao → parcelas → obs → confirmacao
  se despesa débito/pix: → categoria? → formaPag → conta → obs → confirmacao
  se receita:          → categoria? → formaPag → contaReceita → obs → confirmacao
```

Etapas são puladas se o dado já foi coletado (ex: categoria detectada automaticamente).
Histórico de etapas salvo em `historicoEtapas.current` para permitir "voltar".

### Refs importantes

| Ref                  | Propósito                                                      |
|----------------------|----------------------------------------------------------------|
| `lancamentoRef`      | Versão síncrona do state `lancamento` (acessível em callbacks) |
| `etapaRef`           | Etapa atual síncrona                                           |
| `cartoesRef`         | Lista de cartões síncrona                                      |
| `contasRef`          | Lista de contas síncrona                                       |
| `categoriasDispRef`  | Categorias de despesa                                          |
| `categoriasRecRef`   | Categorias de receita                                          |
| `vozVelocidadeRef`   | Velocidade atual de TTS                                        |
| `historicoEtapas`    | Pilha de etapas para "voltar"                                  |
| `gravacaoAtiva`      | Mutex para evitar dupla gravação                               |
| `jaProcessou`        | Mutex para evitar processar resultado duas vezes               |

---

## theme.tsx — Sistema de temas

Arquivo: `app/theme.tsx`

| Símbolo           | Descrição                                                    |
|-------------------|--------------------------------------------------------------|
| `Colors` (type)   | bg, card, input, border, borderSoft, borderLight, text, textSec, textMuted, barTrack, barTrack2 |
| `dark`            | Paleta escura: bg `#12151e`, card `#1c2133`, text `#f0f3ff` |
| `light`           | Paleta clara: bg `#f4f6fb`, card `#ffffff`, text `#1a2035`  |
| `ThemeProvider`   | Context provider — envolve o app em `_layout.tsx`           |
| `useTheme()`      | Hook que retorna `{ isDark, colors, toggleTheme }`          |

Todas as telas chamam `makeStyles(colors)` passando o objeto de cores como parâmetro.

---

## paywall.tsx — Compra premium

Arquivo: `app/paywall.tsx`

| Símbolo            | Descrição                                                   |
|--------------------|-------------------------------------------------------------|
| `SKU_PREMIUM`      | `financaspro_premium` (Android) / `financaspro_premium_ios` |
| `DESBLOQUEADO_KEY` | `@faladinheiro:desbloqueado`                                |
| `comprar()`        | Chama `requestPurchase({ skus: [SKU_PREMIUM] })`            |
| `restaurar()`      | Chama `getPurchaseHistory()`, verifica productId, salva key |
| `purchaseUpdatedListener` | Listener que salva 'true' na chave e redireciona    |

---

## contas.tsx — Contas bancárias

Arquivo: `app/contas.tsx`

Contas vivem no **AsyncStorage** (chave `@financaspro:contas`), não no SQLite.

| Função              | Descrição                                              |
|---------------------|--------------------------------------------------------|
| `buscarContas()`    | Lê AsyncStorage, retorna array de Conta                |
| `debitarConta()`    | Subtrai valor do saldo de uma conta                    |
| `creditarConta()`   | Adiciona valor ao saldo de uma conta                   |
| `parseBRValue(val)` | Linha 129 — converte input BR (ex: "1.200,50") para "1200.50" |

---

## cartoes.tsx — Cartões de crédito

Arquivo: `app/cartoes.tsx`

| Função              | Descrição                                                   |
|---------------------|-------------------------------------------------------------|
| `parseBRValue(val)` | Linha 225 — converte input BR para string numérica decimal  |

Cartões vivem no **SQLite** (tabela `cartoes`). CRUD via `database.ts`.

---

## categorias.tsx — Categorias customizáveis

Arquivo: `app/categorias.tsx`

Categorias vivem no AsyncStorage:
- Despesas: `@financaspro:categorias_despesa`
- Receitas: `@financaspro:categorias_receita`

| Função                          | Descrição                                               |
|---------------------------------|---------------------------------------------------------|
| `carregarCategorias(tipo)`      | Lê AsyncStorage, retorna array de strings               |

---

## HelpModal.tsx — Modal de ajuda contextual

Arquivo: `app/HelpModal.tsx`

Componente reutilizado em 8 telas. Exporta o componente padrão e dois estilos para o botão "?".

| Exportação        | Tipo      | Descrição                                                        |
|-------------------|-----------|------------------------------------------------------------------|
| `default HelpModal` | Component | Modal com título, lista de dicas e botão "Entendi"             |
| `helpBtnStyle`    | objeto    | Estilo do botão `?` no header (32×32, circular, borda azul)      |
| `helpTxtStyle`    | objeto    | Estilo do texto `?` (fontSize 15, bold, azul `#5294ff`)          |

Props do `HelpModal`:

| Prop      | Tipo       | Descrição                        |
|-----------|------------|----------------------------------|
| `visible` | boolean    | Controla visibilidade do modal   |
| `onClose` | () => void | Callback ao fechar               |
| `title`   | string     | Título exibido no topo           |
| `tips`    | string[]   | Array de dicas (uma por bullet)  |

Padrão de uso (igual em todas as 8 telas):
```tsx
import HelpModal, { helpBtnStyle, helpTxtStyle } from './HelpModal'; // ou '../HelpModal' em (tabs)/
const [helpVisible, setHelpVisible] = useState(false); // OBRIGATÓRIO declarar no componente raiz
// No header:
<TouchableOpacity onPress={() => setHelpVisible(true)} style={helpBtnStyle}>
  <Text style={helpTxtStyle}>?</Text>
</TouchableOpacity>
// No JSX raiz:
<HelpModal visible={helpVisible} onClose={() => setHelpVisible(false)} title="..." tips={[...]} />
```

⚠️ **Armadilha:** `helpVisible` deve ser declarado no componente da tela, nunca em um subcomponente — causa crash por variável fora de escopo.

---

## notificacoes.ts

Arquivo: `app/notificacoes.ts`

| Função                               | Linha | Descrição                                                        |
|--------------------------------------|-------|------------------------------------------------------------------|
| `agendarNotificacoesVencimento()`    | 65    | Agenda push notifications para lançamentos pendentes             |
| `verificarAlertaOrcamento()`         | 131   | Notifica se gasto do mês ultrapassou % do orçamento              |
| `resetarLembreteMotivacional()`      | 245   | Reinicia ciclo do lembrete motivacional após novo lançamento     |
| `configurarNotificacoes()`           | 277   | Solicita permissão e configura canal Android                     |

Chamadas após salvar lançamento (em `voz.tsx` e `novo-lancamento.tsx`):
```ts
await agendarNotificacoesVencimento();
verificarAlertaOrcamento().catch(() => {});
resetarLembreteMotivacional().catch(() => {});
```

---

## novo-lancamento.tsx

Arquivo: `app/novo-lancamento.tsx`

Formulário manual (sem voz). Campos: tipo, descricao, valor, categoria, formaPag, cartão, parcelas, conta, data, obs.

- **Linha 398**: placeholder de `descricao` é adaptativo — muda conforme `tipo` (receita/despesa)
- Chama `inserirLancamento()` ou `inserirLancamentosParcelados()` de database.ts
- Após salvar, chama `agendarNotificacoesVencimento()`

---

## Cores constantes da UI

| Cor      | Hex       | Uso principal                          |
|----------|-----------|----------------------------------------|
| Verde    | `#25d07e` | Receitas, sucesso, check               |
| Vermelho | `#f25555` | Despesas, erros, alerta crítico        |
| Azul     | `#5294ff` | Botões primários, links, ativo         |
| Amarelo  | `#f7b731` | Alertas de vencimento, warning         |
| Verde marca | `#1a5c3a` | Splash, adaptiveIcon background     |
