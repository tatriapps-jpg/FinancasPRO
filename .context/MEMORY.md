# MEMORY — Decisões, Problemas Resolvidos e O Que NÃO Fazer

## O que NÃO fazer

### NÃO usar `crypto.randomUUID()`
O ambiente React Native não suporta `crypto.randomUUID()` nativamente.
Use sempre `gerarId()` de `database.ts`, que usa `Date.now() + Math.random().toString(36)`.

### NÃO usar `parseBRValue` em `voz.tsx`
`parseBRValue` NÃO existe em `voz.tsx`. A função correta para interpretar valores falados em português é `interpretarValor()`, definida em `voz.tsx:180`.
`parseBRValue` existe apenas em `cartoes.tsx:225` e `contas.tsx:129` para converter input de texto de formulários.

### NÃO confundir limite de lançamentos
- Código interno: `LIMITE_GRATIS = 150` (`voz.tsx:16`)
- Texto de marketing no paywall: "100 lançamentos" (`paywall.tsx:154`)
- São intencionalmente diferentes. Não "corrigir" esse número.

### NÃO usar `import * as FileSystem from 'expo-file-system'`
Usar sempre o import legado: `import * as FileSystem from 'expo-file-system/legacy'`
(conforme configuracoes.tsx:2 — o módulo padrão tem API diferente nesta versão do Expo)

### NÃO usar New Architecture incompatível
O projeto usa `newArchEnabled: true`. Qualquer biblioteca nativa adicionada deve ser compatível com a New Architecture do React Native.

### NÃO usar `AsyncStorage` para lançamentos, cartões
Lançamentos e cartões vivem no SQLite via `database.ts`. Só use AsyncStorage para configurações, contas (array JSON), categorias e preferências.

### NÃO passar datas como objetos Date para o SQLite
Todas as datas são strings `DD/MM/YYYY`. O SQLite recebe e retorna strings neste formato. Converter com split('/') e parseInt.

### NÃO usar gradlew clean antes de assembleRelease sem limpar worklets
Se rodar `gradlew clean assembleRelease`, o `react-native-worklets` pode ficar com `prefabReleaseConfigurePackage` marcado como UP-TO-DATE incorretamente após o clean, causando falha em `react-native-reanimated:configureCMakeRelWithDebInfo`.
**Solução confirmada:** deletar `node_modules/react-native-worklets/android/build` manualmente antes, depois rodar apenas `assembleRelease` (sem clean).

---

## Decisões já tomadas

### Modelo de monetização: compra única
Decidido usar one-time purchase em vez de assinatura recorrente. Sem mudança.
SKU: `financaspro_premium` (Android), `financaspro_premium_ios` (iOS).

### Package name definitivo
`com.tatriapps.faladinheiro` — já publicado, não pode mudar.

### Nome do app definitivo
"Fala, Dinheiro!" — slug Expo é "FinancasPRO" por razões históricas, mas o nome exibido é "Fala, Dinheiro!".

### Velocidade de voz padrão: 1.3
Três opções: Lenta (1.0), Normal (1.3), Rápida (1.6). Salvo em AsyncStorage chave `@financaspro:vozVelocidade`.

### Tutorial de voz: 3 usos
O tutorial completo (perguntas longas) aparece nas primeiras 3 sessões de voz (`VOZ_TUTORIAL_LIMITE = 3`). Depois usa perguntas curtas. Usuário pode forçar tutorial pela UI.

### Placeholder de descrição adaptativo
Em `novo-lancamento.tsx:398`, o placeholder muda com base no tipo:
- Receita: "Ex: Empresa X, Apartamento, Venda de Carro..."
- Despesa: "Ex: Supermercado, Farmácia, Eletricista..."

### Cor primária verde: `#1a5c3a`
Usado no splash, adaptiveIcon background e elementos de marca.

### Cor de acento: `#5294ff`
Azul usado em botões primários, links, elementos ativos.

### Tela inicial é sempre o PIN
`_layout.tsx` verifica PIN ao iniciar. Sem PIN cadastrado, redireciona para `/pin`.

### Backup em JSON (não SQL)
Backup exporta JSON com lancamentos, cartoes, contas, orcamento, diasAlerta, categorias. Arquivo nomeado `FalaDinheiro_backup_YYYY-MM-DD.json`.

---

## Bugs conhecidos e resolvidos

### Crash ao abrir "Novo Lançamento" — `helpVisible` não declarado (2026-04-29)
`NovoLancamentoScreen` usava `helpVisible` e `setHelpVisible` (botão `?` e `<HelpModal>`) sem declarar o state.
O `useState(false)` existia no componente `Dropdown` (linha 38), escopo diferente — não acessível em `NovoLancamentoScreen`.
**Solução:** adicionado `const [helpVisible, setHelpVisible] = useState(false)` em `NovoLancamentoScreen` (linha 148).
Os outros 7 arquivos com `HelpModal` (index, lancamentos, orcamento, relatorios, voz, contas, cartoes) já tinham a declaração correta.

### Botão "Entendi" no `HelpModal` aparece como barra azul sem texto (Android) — em investigação
Bug persistente: o texto "Entendi" não aparece no botão de fechar do HelpModal no Android, só a barra azul.
Histórico de tentativas:
1. Removido `includeFontPadding: false`, adicionado `lineHeight: 20` — não resolveu
2. Estilos inline + `View` dentro do `TouchableOpacity`, sem `StyleSheet` — não resolveu
3. `box` com `flex: 1`, `ScrollView` com `flex: 1` (era `maxHeight: 340`) — não resolveu
4. **(atual, 2026-05-04)** Substituído `TouchableOpacity` por `Pressable`, `height: 48` explícito, overlay com `Pressable` — aguarda confirmação
**Hipóteses não descartadas:** `ScrollView` com `flex:1` ainda pode estar comprimindo o botão; `Pressable` dentro de `TouchableOpacity` aninhado pode ter comportamento inesperado; tema escuro pode ter `colors.card` sobrescrevendo cor do texto.
**NÃO usar** `includeFontPadding: false` em texto de botões — causa corte no Android.

### Pix não reconhecido por variações fonéticas
O reconhecimento de voz pt-BR transcreve "Pix" de formas variadas: "pics", "pis", "pik", "pixe", "piche", etc.
**Solução:** função `ehPix()` em `voz.tsx:247` com ~20 variações cobertas por regex e includes.

### `somarExtenso` não aceitava dígitos como multiplicadores
"10 mil" era interpretado como 10 + 1000 = 1010 em vez de 10000.
**Solução:** lógica atualizada em `somarExtenso()` que trata `parseInt(tok)` além de `PALAVRAS_NUM[tok]`.

### Categorias com nomes errados no banco
Migração legada: "Alimentacao", "Alimentação", "Mercado" → "Supermercado", "Lazer" → "Lazer e Entretenimento", etc.
**Solução:** `migrarCategorias()` em `database.ts:61` chamada no `initDB()`.

### `ir` detectava falsos positivos em `detectarCategoria`
Palavra "ir" aparecia em "farmácia", "recebir", etc. e categorizava como "Impostos".
**Solução:** usar `\bIR\b` (word boundary) no regex, não includes simples.

### Build Android falhava com prefab do worklets
`react-native-reanimated:configureCMakeRelWithDebInfo` falhava porque o diretório prefab do worklets não existia após clean.
**Solução documentada acima em "O que NÃO fazer".**

### Botão "Recomeçar" em voz.tsx
Historicamente havia bug onde recomeçar não limpava o histórico de etapas.
**Solução:** `historicoEtapas.current = []` ao recomeçar, junto com reset do lancamento state.

### `matchDireto` em interpretarValor capturava separador de milhar como decimal
STT Android pt-BR transcreve "dez mil" como "10.000" e "mil e duzentos" como "1.200".
O regex `/^(\d+\.?\d*)$/` com `\d*` aceita qualquer quantidade de dígitos após o ponto — "10.000" batia e retornava "10.000" = R$10, antes do `matchMilhar` (que trata corretamente separador europeu) ter chance de rodar.
**Solução:** `/^(\d+(?:\.\d{1,2})?)$/` — restringe a 0–2 casas decimais. "10.000" cai no matchMilhar e retorna "10000".

### getPergunta('categoria') sempre usava exemplos de despesa
`getPergunta` não tinha tratamento especial para 'categoria'. Caía no `return` final com `PERGUNTAS_COMPLETAS['categoria']` = "Supermercado, Saúde, Transporte." mesmo quando tipo era receita.
**Solução:** adicionado bloco `if (e === 'categoria')` em `getPergunta` que retorna exemplos de receita ("Salário, Freelance, Aluguel Recebido") quando `lancamentoRef.current.tipo === 'receita'`.

### Split reais/centavos falhava sem "reais" explícito
"dez mil e quinze centavos" retornava "10015" em vez de "10000.15".
O regex de duplo espaço (`\s{2,}`) só funciona quando o usuário diz "reais" (o remove deixa duplo espaço). Sem "reais", o group2 ficava vazio e "quinze" era tratado como reais.
**Solução:** 3 camadas de split: (a) duplo espaço com group2 preenchido, (b) último conector com regex gananciosa, (c) só centavos sem reais.

### Categorias por tipo não carregavam corretamente em voz.tsx
`detectarCategoria` usava lista genérica em vez das categorias do tipo correto.
**Solução:** `carregarCategorias('despesa')` e `carregarCategorias('receita')` separados, armazenados em refs distintas (`categoriasDispRef`, `categoriasRecRef`).

---

## Comportamentos não óbvios

- `buscarLancamentosPorMes` usa `dataVencimento` como critério principal; só cai em `data` se `dataVencimento` for nulo/vazio.
- `buscarTotalUsadoCartao` agrupa parcelamentos por `grupoId` para não contar cada parcela individualmente no limite do cartão.
- O campo `contaId` foi adicionado via `ALTER TABLE` (migration), por isso pode ser vazio em registros antigos.
- `inserirLancamentosParcelados` não recebe `contaId` — parcelamentos no crédito não debitam conta diretamente.
- `agendarNotificacoesVencimento` é chamado após salvar lançamento em voz.tsx.
- O campo `status` pode ser: `'pago'`, `'pendente'`, `'parcelado'`.
