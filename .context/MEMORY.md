# MEMORY — Decisões, Problemas Resolvidos e O Que NÃO Fazer

## O que NÃO fazer

### NÃO usar `crypto.randomUUID()`
O ambiente React Native não suporta `crypto.randomUUID()` nativamente.
Use sempre `gerarId()` de `database.ts`, que usa `Date.now() + Math.random().toString(36)`.

### NÃO usar `parseBRValue` em `voz.tsx`
`parseBRValue` NÃO existe em `voz.tsx`. A função correta para interpretar valores falados em português é `interpretarValor()`, definida em `voz.tsx:180`.
`parseBRValue` existe apenas em `cartoes.tsx` e `contas.tsx` para converter input de texto de formulários.

### NÃO confundir limite de lançamentos
- Código interno: `LIMITE_GRATIS = 150` (`voz.tsx:16`)
- Texto de marketing no paywall: "100 lançamentos" (`paywall.tsx:154`)
- São intencionalmente diferentes. Não "corrigir" esse número.

### NÃO usar `import * as FileSystem from 'expo-file-system'`
Usar sempre o import legado: `import * as FileSystem from 'expo-file-system/legacy'`
(o módulo padrão tem API diferente nesta versão do Expo)

### NÃO usar New Architecture incompatível
O projeto usa `newArchEnabled: true`. Qualquer biblioteca nativa adicionada deve ser compatível com a New Architecture do React Native.

### NÃO usar `AsyncStorage` para lançamentos, cartões
Lançamentos e cartões vivem no SQLite via `database.ts`. Só use AsyncStorage para configurações, contas (array JSON), categorias e preferências.

### NÃO passar datas como objetos Date para o SQLite
Todas as datas são strings `DD/MM/YYYY`. O SQLite recebe e retorna strings neste formato. Converter com split('/') e parseInt.

### NÃO usar gradlew clean antes de assembleRelease sem limpar worklets
Se rodar `gradlew clean assembleRelease`, o `react-native-worklets` pode ficar com `prefabReleaseConfigurePackage` marcado como UP-TO-DATE incorretamente após o clean, causando falha em `react-native-reanimated:configureCMakeRelWithDebInfo`.
**Solução confirmada:** deletar `node_modules/react-native-worklets/android/build` manualmente antes, depois rodar apenas `assembleRelease` (sem clean).

### NÃO excluir nem editar saldo da conta `especie_fixa` diretamente via tela Contas
A conta `especie_fixa` é gerenciada exclusivamente via `dinheiro.tsx` e via `creditarConta`/`debitarConta` automáticos nos lançamentos com `formaPag === 'Dinheiro'`. A tela `contas.tsx` filtra `especie_fixa` da lista exibida e bloqueia exclusão/edição de saldo.

### NÃO chamar `garantirContaEspecie()` dentro de `initDB()`
`initDB()` é síncrona; `garantirContaEspecie()` é async. A chamada em `initDB()` não pode ser aguardada e foi removida. A função deve ser chamada com `await` em `_layout.tsx → inicializar()`.

### NÃO usar `require()` para imports dinâmicos em produção quando `import()` funciona
`require('@react-native-async-storage/async-storage')` dentro de funções async causou problemas. Usar `await import(...)` em vez de `require()` para imports dinâmicos.

### NÃO usar `echo` do PowerShell para escrever em arquivos com caminhos absolutos
`echo conteudo >> C:\caminho\arquivo` no PowerShell cria um arquivo com o nome literal `C:\caminho\arquivo` no diretório atual (com encoding ruim), em vez de redirecionar para o caminho. Usar ferramentas de edição de arquivo (Write/Edit) ou Bash.

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
Em `novo-lancamento.tsx`, o placeholder muda com base no tipo:
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

### Dinheiro em espécie: conta virtual `especie_fixa` (2026-05-22)
O dinheiro físico é rastreado via uma conta especial `{ id: 'especie_fixa', nome: 'Dinheiro em Espécie', banco: 'Espécie', tipo: 'Espécie' }` no array `@financaspro:contas` do AsyncStorage.
- Criada automaticamente por `garantirContaEspecie()` chamada com `await` em `_layout.tsx → inicializar()`
- Saldo atualizado via `creditarConta('especie_fixa', valor)` / `debitarConta('especie_fixa', valor)` em todos os pontos de criação/exclusão de lançamentos com `formaPag === 'Dinheiro'`: `novo-lancamento.tsx`, `voz.tsx`, `lancamentos.tsx`
- Gerenciada pela tela `dinheiro.tsx` (edição manual, histórico, extrato XLSX)
- Filtrada da lista em `contas.tsx → loadContas()` para não aparecer como conta bancária normal
- Exibida no painel Patrimônio Real da home separadamente das contas bancárias

### Reparcelamento ao editar lançamento de crédito (2026-05-20/21)
Em `editar-lancamento.tsx`, quando `formaPag === 'Credito' && tipo === 'despesa'`:
1. Deleta o grupo existente (`deletarGrupoLancamentos`) ou o lançamento único (`deletarLancamento`)
2. Recria as parcelas do zero via `inserirLancamentosParcelados`
3. Retorna imediatamente sem executar `atualizarLancamentoCompleto`
Quando a forma muda de Crédito para outra: deleta o grupo, reconstrói o valor total (`valorParcela × totalParcelas`), cria um novo lançamento único via `inserirLancamento`.

---

## Bugs conhecidos e resolvidos

### Crash ao abrir "Novo Lançamento" — `helpVisible` não declarado (2026-04-29)
`NovoLancamentoScreen` usava `helpVisible` e `setHelpVisible` sem declarar o state.
**Solução:** adicionado `const [helpVisible, setHelpVisible] = useState(false)` em `NovoLancamentoScreen`.

### Botão "Entendi" no `HelpModal` aparece como barra azul sem texto (Android) — em investigação
Bug persistente: o texto "Entendi" não aparece no botão de fechar do HelpModal no Android, só a barra azul.
Histórico de tentativas:
1. Removido `includeFontPadding: false`, adicionado `lineHeight: 20` — não resolveu
2. Estilos inline + `View` dentro do `TouchableOpacity`, sem `StyleSheet` — não resolveu
3. `box` com `flex: 1`, `ScrollView` com `flex: 1` (era `maxHeight: 340`) — não resolveu
4. **(atual, 2026-05-04)** Substituído `TouchableOpacity` por `Pressable`, `height: 48` explícito, overlay com `Pressable` — aguarda confirmação
**NÃO usar** `includeFontPadding: false` em texto de botões — causa corte no Android.

### Pix não reconhecido por variações fonéticas
**Solução:** função `ehPix()` em `voz.tsx` com ~20 variações cobertas por regex e includes.

### `somarExtenso` não aceitava dígitos como multiplicadores
"10 mil" era interpretado como 1010 em vez de 10000.
**Solução:** lógica atualizada em `somarExtenso()` que trata `parseInt(tok)` além de `PALAVRAS_NUM[tok]`.

### Categorias com nomes errados no banco
**Solução:** `migrarCategorias()` em `database.ts` chamada no `initDB()`.

### `ir` detectava falsos positivos em `detectarCategoria`
**Solução:** usar `\bIR\b` (word boundary) no regex, não includes simples.

### Build Android falhava com prefab do worklets
**Solução documentada acima em "O que NÃO fazer".**

### Botão "Recomeçar" em voz.tsx não limpava histórico
**Solução:** `historicoEtapas.current = []` ao recomeçar.

### `matchDireto` em interpretarValor capturava separador de milhar como decimal
**Solução:** `/^(\d+(?:\.\d{1,2})?)$/` — restringe a 0–2 casas decimais.

### getPergunta('categoria') sempre usava exemplos de despesa
**Solução:** adicionado bloco `if (e === 'categoria')` em `getPergunta` com exemplos por tipo.

### Split reais/centavos falhava sem "reais" explícito
**Solução:** 3 camadas de split: duplo espaço, último conector, só centavos.

### Categorias por tipo não carregavam corretamente em voz.tsx
**Solução:** `carregarCategorias('despesa')` e `carregarCategorias('receita')` separados em refs distintas.

### `garantirContaEspecie` não funcionava por ser chamada sem await em `initDB()` (2026-05-22)
A conta `especie_fixa` não aparecia porque `initDB()` é síncrona e não pode awaitar funções async.
**Solução:** removida a chamada de `initDB()`; adicionada com `await` em `_layout.tsx → inicializar()`.

---

## Comportamentos não óbvios

- `buscarLancamentosPorMes` usa `dataVencimento` como critério principal; só cai em `data` se `dataVencimento` for nulo/vazio.
- `buscarTotalUsadoCartao` agrupa parcelamentos por `grupoId` para não contar cada parcela individualmente no limite do cartão.
- O campo `contaId` foi adicionado via `ALTER TABLE` (migration), por isso pode ser vazio em registros antigos.
- `inserirLancamentosParcelados` não recebe `contaId` — parcelamentos no crédito não debitam conta diretamente.
- `agendarNotificacoesVencimento` é chamado após salvar lançamento em voz.tsx.
- O campo `status` pode ser: `'pago'`, `'pendente'`, `'parcelado'`.
- `contas.tsx → loadContas()` filtra `especie_fixa` para não exibir na lista de contas bancárias.
- O painel Patrimônio Real da home (`index.tsx`) separa `saldoBancos` (contas reais) de `saldoEspecie` (especie_fixa) para exibição e cálculo do total disponível.
- `formaPag` é armazenado sem acento no banco (`'Debito'`, não `'Débito'`); `novo-lancamento.tsx` aceita ambas as grafias na condição de débito para garantir compatibilidade.
- Ao excluir lançamento/grupo em `lancamentos.tsx`, `restaurarSaldoAoExcluir` reverte o saldo da conta ou da especie_fixa antes de deletar.
