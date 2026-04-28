# DOCS — Documentação do Usuário e Fluxos do App

## Telas principais (abas)

### 1. Dashboard / Home (`index.tsx`)

Exibe o resumo financeiro do mês atual:

- **Saudação**: toca no nome para editar. Nome salvo em `@financaspro:nomeUsuario`.
- **Alerta de vencimentos**: mostra despesas não pagas com vencimento nos próximos N dias (padrão 3). Toca no banner verde para configurar o prazo.
- **Cards de resumo**: Receitas do mês, Despesas do mês, Saldo Real (receitas − despesas).
- **Barra de orçamento**: mostra % consumido do orçamento mensal. Verde < 70%, Amarelo 70–90%, Vermelho > 90%.
- **Gastos por categoria**: barra empilhada + ranking com % e valor de cada categoria do mês.

### 2. Lançamentos (`lancamentos.tsx`)

Lista todos os lançamentos com filtro por mês.

- Toque em `+` para novo lançamento (manual ou por voz).
- Toque no lançamento para **editar**.
- Pressione e segure para **excluir** (pergunta confirmação).
- Lançamentos parcelados: excluir pergunta se quer apagar só aquela parcela ou o grupo inteiro.

### 3. Relatórios (`relatorios.tsx`)

Análise mensal com navegação por setas (mês anterior / próximo).

- Totais de receita e despesa do mês.
- Gráfico de barras por categoria.
- Exportação para Excel (XLSX) via biblioteca `xlsx`.

### 4. Orçamento (`orcamento.tsx`)

Define o limite mensal de gastos.

- Só despesas são descontadas do orçamento — receitas não interferem.
- Toque no valor para editar o limite.
- Salvo em `@financaspro:orcamento`.

### 5. Configurações (`configuracoes.tsx`)

Seções:
- **Aparência**: toggle tema escuro/claro, velocidade de voz (Lenta 1.0 / Normal 1.3 / Rápida 1.6)
- **Conta e Segurança**: editar nome, alterar PIN, bloquear app
- **Cartões e Contas**: navega para telas de CRUD
- **Categorias**: personalizar listas de categorias por tipo
- **Dados**: Fazer Backup (JSON), Restaurar Backup, Zerar Lançamentos
- **Sobre**: Ajuda rápida, Contato (tatriapps@gmail.com), Política de Privacidade, versão

---

## Tela de Voz (`voz.tsx`)

### Fluxo passo a passo

O app conduz o usuário por etapas, falando a pergunta e aguardando a resposta.
Após falar a resposta, o app processa automaticamente (timeout de 2s sem fala).

```
ETAPA 1 — TIPO
  Pergunta: "Este lançamento é uma despesa ou uma receita?"
  Diga: "despesa" / "receita" / "gasto" / "entrada" / "ganho"

ETAPA 2 — DESCRIÇÃO
  Pergunta varia por tipo:
    Despesa: "Qual é a descrição? Ex: Super X, Farmácia Y ou Juca Eletricista."
    Receita: "Qual é a descrição? Ex: Salário, Freelance, Aluguel Recebido."
  → Após a descrição, o app tenta detectar a categoria automaticamente.
    Se detectar, pula a etapa de categoria.

ETAPA 3 — VALOR
  Pergunta: "Qual é o valor?"
  Diga: "cinquenta reais" / "dois mil e trezentos" / "258 com 52" / "1500"
  ⚠️ Diga o valor por extenso para melhor reconhecimento.

ETAPA 4 — CATEGORIA (pode ser pulada se detectada automaticamente)
  Pergunta: "Qual é a categoria? Diga automático para detectar."
  Diga: o nome da categoria ou "automático"

ETAPA 5 — FORMA DE PAGAMENTO
  Despesa: Crédito, Débito, Pix, Dinheiro, Boleto, Transferência, Depósito
  Receita: Pix, Depósito, Transferência, Dinheiro

ETAPA 6 — CARTÃO (só se Crédito)
  Pergunta: "Qual cartão? Você tem: [lista de apelidos]"
  Diga o apelido do cartão.

ETAPA 7 — PARCELAS (só se Crédito)
  Pergunta: "Quantas parcelas? Um para pagamento único."
  Diga: "um" / "três" / "doze" / "à vista"

ETAPA 8 — CONTA (despesa débito/pix/transferência)
  Pergunta: "De qual conta será debitado? Você tem: [lista]"

ETAPA 9 — CONTA RECEITA (só receitas)
  Pergunta: "Em qual conta foi recebido? Você tem: [lista]"

ETAPA 10 — OBSERVAÇÃO
  Pergunta: "Alguma observação? Diga não para pular."
  Diga qualquer texto ou "não" / "nada" / "pular"

ETAPA 11 — CONFIRMAÇÃO
  Exibe resumo do lançamento.
  Botões: Confirmar / Recomeçar / Voltar etapa
```

### Controles na tela de voz

- **Botão central (microfone)**: toca para gravar manualmente / parar gravação.
- **Bip de início**: aguarde o bip antes de falar.
- **Tutorial / Resumido**: toggle que alterna entre perguntas longas e curtas.
- **Dicas**: seção expansível com 7 dicas de pronúncia.
- **Voltar etapa**: desfaz a última etapa respondida.
- **Recomeçar**: zera tudo e volta à etapa "tipo".

### Dicas de pronúncia

- **Valores**: diga por extenso — "cinquenta reais", "dois mil e trezentos"
- **Pix**: diga "pix", o app reconhece ~20 variações fonéticas
- **Cartões/contas**: use o apelido cadastrado (ex: "Nubank", "Itaú")
- **Categorias**: diga "automático" para detecção pela descrição
- **Parcelas**: "três", "doze", "à vista" (só funciona com crédito)
- **Observação**: diga "não" para pular

---

## Modelo híbrido: limite de lançamentos

| Situação       | Comportamento                                                    |
|----------------|------------------------------------------------------------------|
| < 150 lançamentos | App funciona normalmente (gratuito)                         |
| ≥ 150 lançamentos | Tela de voz redireciona para o Paywall                      |
| Premium ativo  | Ilimitado — verifica `@faladinheiro:desbloqueado === 'true'`   |

O limite é verificado em `voz.tsx` antes de iniciar cada sessão de voz.

---

## Como o Paywall funciona

1. Usuário atinge 150 lançamentos e tenta usar a tela de voz.
2. App redireciona para `/paywall`.
3. Paywall exibe benefícios e preço localizado (buscado da loja).
4. Toque em "Desbloquear agora" → `requestPurchase({ skus: ['financaspro_premium'] })`
5. `purchaseUpdatedListener` recebe confirmação → salva `@faladinheiro:desbloqueado = 'true'`
6. Alert de sucesso → redireciona para `/(tabs)`.
7. Botão "Restaurar compra anterior" → `getPurchaseHistory()` → verifica productId.

---

## Cartões de crédito — como funciona o parcelamento

1. Usuário cadastra cartão com: apelido, bandeira, últimos 4 dígitos, dia de fechamento, dia de vencimento, limite.
2. Ao lançar no crédito, informa número de parcelas.
3. `inserirLancamentosParcelados()` cria N registros com:
   - Descrição: `"Nome da compra (1/N)"`, `"Nome da compra (2/N)"`, etc.
   - Valor: `valorTotal / N`
   - `grupoId` igual para todas as parcelas
   - `dataVencimento` calculada com base no dia de vencimento e fechamento
4. Tela de cartões exibe fatura agrupada por mês.
5. "Pagar fatura" marca todas as parcelas do mês como 'pago'.

---

## Contas bancárias — como funciona o débito automático

- Ao lançar despesa com Débito, Pix ou Transferência, o app debita automaticamente a conta selecionada.
- Ao lançar receita, credita a conta selecionada.
- Saldo da conta é atualizado em tempo real no AsyncStorage.
- Contas não têm histórico de transações separado — o saldo reflete as operações feitas via app.

---

## Backup e restauração

### Fazer backup
Configurações → Dados → Fazer Backup
- Gera JSON com: lancamentos, cartoes, contas, orcamento, diasAlerta, categorias
- Arquivo: `FalaDinheiro_backup_YYYY-MM-DD.json`
- Compartilha via sistema do Android/iOS (salvar no Drive, WhatsApp, etc.)

### Restaurar backup
Configurações → Dados → Restaurar Backup
- Busca o backup mais recente no diretório de documentos do app
- Exibe preview (data, quantidade de lançamentos, cartões, contas)
- Confirmação substitui TODOS os dados atuais

---

## PIN de segurança

- Solicitado ao abrir o app (`_layout.tsx` verifica na inicialização).
- 4 dígitos numéricos.
- Alterar PIN: Configurações → Conta e Segurança → Alterar PIN → redireciona para `/pin` para recadastrar.
- Bloquear app: Configurações → Bloquear App → volta para tela de PIN imediatamente.
- Chave: `@financaspro:pin`

---

## Categorias personalizáveis

- Despesas e receitas têm listas separadas.
- Categorias padrão são carregadas na primeira instalação.
- Usuário pode adicionar, editar e excluir categorias.
- Na tela de voz, `detectarCategoria(descricao)` tenta mapear automaticamente usando `MAP_CATEGORIA` (palavra-chave → categoria canônica).
- Categorias customizadas não entram no mapeamento automático de voz — só as do dicionário interno.

---

## Notificações

- Agendadas após cada lançamento com `dataVencimento` futura e status != 'pago'.
- Ícone de notificação: `assets/notification-icon.png`
- Cor: `#1a5c3a`
- Requerem permissão `android.permission.POST_NOTIFICATIONS`.
