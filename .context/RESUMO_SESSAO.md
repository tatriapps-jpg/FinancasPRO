# RESUMO DA SESSÃO — Fala, Dinheiro! (atualizado 12/05/2026)

---

## 1. STATUS ATUAL — O que está funcionando

### Core do app
- **APK release gerado** com sucesso em 2026-05-12 via `gradlew assembleRelease` (~3–4min)
- **New Architecture** habilitada e estável
- **SQLite + AsyncStorage** funcionando corretamente
- **Temas** claro/escuro via Context API
- **Ordem das abas** correta: Resumo | Lançamentos | Orçamento | Relatórios | Config

### Entrada de dados
- **Formulário manual** (`novo-lancamento.tsx`): despesas, receitas, parcelamento crédito e boleto
- **Receita no formulário manual** funcionando corretamente
- **Entrada por voz** (`voz.tsx`): fluxo completo com auto-save após observação (sem tela de confirmação)
  - Interpretes robustos para valores por extenso, Pix (~20 variações), formas de pagamento
  - Modo Guiado (3 primeiras sessões) e Rápido
  - Botão Voltar para desfazer etapa anterior
  - FAB 🎤 centralizado sobre a tab bar, tooltip na 1ª abertura
- **Arredondamento de parcelas** preciso: 1ª parcela recebe centavo residual, demais usam floor

### Visualização e relatórios
- **Lançamentos tab**: filtro por mês, busca, exibe cartão/conta/formaPag na linha; despesas de crédito aparecem no mês de compra E no mês de fatura
- **Parcelas de crédito** exibem nome do cartão vinculado na lista de lançamentos
- **Resumo (Dashboard)**: cards de receitas, despesas, saldo, orçamento do mês atual
- **Orçamento**: gráfico donut multicor, projeção, alertas 80%/100%
- **Relatórios**: comparativo mês-a-mês, exportação XLSX (mês/trimestre/ano)
- **Extrato por conta**: botão "📄 Extrato" disponível na tela Contas (bug de vínculo — ver seção 2)

### Configurações e segurança
- **PIN** de 4 dígitos na abertura
- **Backup/restauração** JSON (lançamentos, cartões, contas, categorias, orçamento)
- **Categorias customizáveis** por tipo (despesa/receita)
- **Notificações**: vencimentos (3d/1d/0d), alerta orçamento 80%/100%, motivacional (3 dias sem lançar), diário 20h, semanal domingo 10h
- **HelpModals em todas as telas corrigidos** — layout funcional em todas as telas principais
- **Botão "Entendi" visível** — substituído por seta (←) na tela de Ajuda rápida de Configurações; Pressable com layout corrigido nas demais telas

### Paywall / Monetização
- Limite gratuito: 150 lançamentos OU 30 dias (unificado, usa contagem real do SQLite)
- Botão "Desbloquear" na tela Lançamentos redireciona para `paywall.tsx` com IAP real
- SKU: `financaspro_premium` (Android) / `financaspro_premium_ios`

---

## 2. BUGS CONHECIDOS — O que ainda precisa corrigir

### Bug ativo — Extrato de conta vazio
O botão "📄 Extrato" em Contas gera o arquivo mas não encontra lançamentos vinculados.

**Causa provável:** o campo `contaId` não está sendo salvo corretamente ao inserir lançamentos (tanto no formulário manual quanto na voz). A função `gerarExtrato` filtra por `l.contaId === conta.id`, mas o contaId pode estar chegando vazio ao banco.

**Para investigar:**
- Verificar se `inserirLancamento` recebe e persiste `contaId` corretamente
- Verificar se `inserirLancamentosParcelados` inclui `contaId` na query SQL (atualmente não inclui — coluna ausente no INSERT)
- Confirmar que `debitarConta`/`creditarConta` são chamadas mas o `contaId` não é salvo no lançamento

---

## 3. IMPLEMENTADO MAS NÃO TESTADO no dispositivo físico

| Funcionalidade | Arquivo | O que fazer |
|---|---|---|
| Salvar automático por voz após observação | `voz.tsx` | Testar fluxo completo: tipo→desc→valor→cat→forma→obs→salvo |
| FAB de voz centralizado na tab bar | `(tabs)/_layout.tsx` | Verificar posição, tooltip na 1ª abertura, overlap com aba Orçamento |
| Arredondamento de parcelas | `database.ts` | Testar R$152,30 ÷ 3 → confirmar 50,78 + 50,76 + 50,76 |
| Forma de pagamento na lista de lançamentos | `lancamentos.tsx` | Confirmar exibição de "Pix", "Dinheiro", cartão ou conta no subtitle |

---

## 4. PRÓXIMOS PASSOS — Em ordem de prioridade

1. **Corrigir bug do extrato de conta** — garantir que `contaId` é persistido no banco em todos os fluxos de inserção
2. **Testar APK no dispositivo físico**:
   - FAB de voz posicionado e funcional
   - Auto-save após observação na voz
   - Parcelamento crédito: arredondamento e exibição corretos
   - Forma de pagamento visível na lista
3. **Testar IAP** — subir APK no track interno da Play Console e executar compra real
4. **Preparar ficha da Play Store**:
   - Título: "Fala, Dinheiro! — Controle Financeiro"
   - Descrição curta (80 chars)
   - Descrição longa
   - Screenshots (mín. 2, ideais 4–8)
   - Ícone 512×512px (fundo `#1a5c3a`)
5. **Hospedar Política de Privacidade** — GitHub Pages ou similar (URL pública obrigatória)
6. **Keystore definitivo** — configurar assinatura de produção no `android/app/build.gradle`
7. **Gerar AAB** (`gradlew bundleRelease`) — Play Store exige AAB, não APK
8. **Upload na Play Console** — track interno → alpha → produção

---

## 5. DECISÕES TOMADAS — Funcionamentos, preços, estratégias

| Decisão | Detalhe |
|---------|---------|
| **Package name** | `com.tatriapps.faladinheiro` — imutável após publicação |
| **Nome do app** | "Fala, Dinheiro!" (slug Expo "FinancasPRO" por razão histórica) |
| **Monetização** | Compra única vitalícia (one-time purchase), sem assinatura |
| **SKU** | `financaspro_premium` (Android) / `financaspro_premium_ios` |
| **Preço de lançamento** | R$ 14,90 — promoção inicial |
| **Preço definitivo** | R$ 19,90 — após período de lançamento |
| **Limite gratuito** | 150 lançamentos no código; paywall exibe "100" (marketing) — diferença intencional |
| **Limite de dias** | 30 dias de período gratuito a partir do 1º lançamento |
| **Arquitetura de dados** | Lançamentos/cartões → SQLite; contas/categorias/configs → AsyncStorage |
| **Datas** | Sempre strings `DD/MM/YYYY` — nunca objetos `Date` no banco |
| **IDs** | Sempre `gerarId()` de `database.ts` — nunca `crypto.randomUUID()` |
| **Velocidade de voz padrão** | 1.3 (Normal). Opções: 1.0 / 1.3 / 1.6 |
| **Tutorial de voz** | Completo nas 3 primeiras sessões, depois resumido |
| **Voz: sem tela de confirmação** | Auto-save após etapa de observação — fluxo mais ágil |
| **HelpModal** | Centralizado em `app/HelpModal.tsx`; `Pressable` no botão; `maxHeight: '82%'` no box |
| **Cor primária** | Verde `#1a5c3a` (marca/splash); Azul `#5294ff` (ações/UI) |
| **Build** | `assembleRelease` direto — nunca `gradlew clean assembleRelease` sem necessidade |
| **FileSystem** | `expo-file-system/legacy` — decisão de compatibilidade |
| **Parcelamento: crédito aparece no mês da compra** | `buscarLancamentosPorMes` usa `data OR dataVencimento` |
| **Arredondamento de parcelas** | 1ª parcela recebe centavo residual; demais usam floor |
| **FAB de voz** | Overlay sobre tab bar (`position: 'absolute'`, `zIndex: 999`), sem nova aba/rota |

---

## 6. V1.1 — Funcionalidades planejadas para após o lançamento

| Funcionalidade | Descrição |
|----------------|-----------|
| **Saldo remanescente entre meses** | Carregar saldo do mês anterior automaticamente no novo mês |
| **Números maiores na tela Resumo** | Aumentar fonte dos valores nos cards do Dashboard |
| **Transações recorrentes** | Registrar contas fixas mensais e lançá-las automaticamente |
| **FAQ / Tutorial de voz** | Seção de perguntas frequentes e tutorial passo a passo da entrada por voz |
| **Tour do app** | Walkthrough na 1ª abertura mostrando as principais funcionalidades |
| **Vídeos explicativos** | Vídeos curtos embutidos no app ensinando a usar cada recurso |
| **Metas financeiras** | Definir metas de poupança e acompanhar progresso |
| **Relatório anual** | Gráfico de barras com total por mês ao longo do ano |
| **Exportação PDF** | Alternativa ao XLSX para compartilhamento de relatórios |
| **Widget Android** | Resumo de saldo e última despesa na tela inicial |
| **Foto de comprovante** | Vincular foto/imagem ao lançamento (câmera/galeria) |
| **Sincronização nuvem** | Backup automático para Google Drive ou similar |
| **Compartilhar extrato** | Enviar resumo do mês por WhatsApp/e-mail como texto formatado |
