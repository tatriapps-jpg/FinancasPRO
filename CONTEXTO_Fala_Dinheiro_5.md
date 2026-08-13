# CONTEXTO — Fala, Dinheiro!

Documento de continuidade entre sessões · Atualizado em 13/07/2026 (v5, substitui o v4 de 13/07)

**13/07/2026: 1.0.1 ENVIADA PARA REVISÃO DO GOOGLE (versionCode 3). Compra real do Premium testada e funcionando.** 🎉

## 1. Identificação do projeto

- App: **Fala, Dinheiro!** — finanças pessoais com lançamento por voz (Android)
- Desenvolvedora: Glaci, TaTri Apps (Brusque, SC)
- Package: com.tatriapps.faladinheiro · Projeto: C:\Users\usuario\FinancasPRO
- Stack: React Native + Expo SDK 54 (expo-router), SQLite (financaspro.db) + AsyncStorage
- Keystore: faladinheiro-release.keystore, alias faladinheiro
- Monetização: compra única R$ 14,90 (financaspro_premium). Grátis: 150 lançamentos OU 30 dias, o que vier primeiro
- Meta: 1.000 downloads/mês · GitHub: tatriapps-jpg/FinancasPRO
- E-mails: login demeloglaci@gmail.com (Marco) · notificações Google marcoaldemelo@gmail.com · loja tatriapps@gmail.com

## 2. Estado atual — 1.0.1 EM REVISÃO NA PLAY STORE

- **v1.0.0** aprovada e publicada em 13/07/2026.
- **v1.0.1 (versionCode 3, versionName "1.0.1")** testada via Teste Interno com compra real funcionando, promovida para Produção e **enviada para revisão do Google em 13/07/2026** (status: em análise no momento desta atualização).
- Nota sobre numeração: o versionCode pulou de 1 (produção) direto pro 3 porque a primeira tentativa de Teste Interno com versionCode 2 teve que ser descartada (Play recusa reaproveitar um versionCode já usado — precisa ser sempre maior que qualquer um já publicado, mesmo em outra trilha).
- No Play Console, o release ficou com o rótulo "1.0.2" no campo "Nome da versão" (campo cosmético, só pra identificação interna, não aparece pro usuário e não é o versionName real — que continua "1.0.1"). Não mexer nisso, não afeta nada.
- Somente Brasil (expansão para outros países possível depois, se desejado).
- Pendências não bloqueantes: Verificação de Desenvolvedor Android (prazo Brasil: 30/09/2026); testes em dispositivos parceiros do Google a partir de 25/07/2026.

## 3. Regras de trabalho com a Glaci (OBRIGATÓRIAS)

- Respostas em português, diretas e concisas, sem preâmbulos nem perguntas automáticas no final.
- Comandos para o Claude Code SEMPRE curtos e rotulados (A1, B1...). Comandos longos chegam truncados.
- Builds SEMPRE locais via CMD (nunca EAS cloud), em C:\Users\usuario\FinancasPRO\android:
  - APK teste: `gradlew.bat assembleRelease -Dorg.gradle.jvmargs="-Xmx4g"`
  - AAB: `gradlew.bat bundleRelease -Dorg.gradle.jvmargs="-Xmx4g"`
- Falha "Gradle build daemon disappeared" = memória: `gradlew.bat --stop`, fechar programas, tentar -Xmx3g.
- **Toda vez que subir um novo AAB/APK ao Play Console (mesmo pra Teste Interno), bumpar `versionCode` em android\app\build.gradle** — Play recusa se o versionCode já foi usado antes em qualquer trilha.
- NUNCA crypto.randomUUID() — sempre gerarId() de database.ts.
- SEMPRE expo-file-system/legacy para gravação de arquivos.
- Arquivos de código sempre completos, nunca parciais.
- Colar: CMD = botão direito; Claude Code = Ctrl+V.
- "Usage credits are required for long context requests" no Code: parar e abrir conversa nova.
- Decisões: opções claras com recomendação antes de implementar.
- Checkpoint git antes de cada lote; commit isolado por correção.
- Nunca afirmar algo incerto como fato; dúvida deve ser explicitada.
- Ao editar arquivos grandes neste ambiente, o mount Linux (bash) às vezes fica com cópia desatualizada/truncada depois de uma edição — é só um cache do ambiente, o arquivo real (Windows, o que a Glaci builda) está sempre correto. Se o `tsc` acusar erro de sintaxe estranho logo após uma edição, conferir o arquivo real antes de assumir que quebrou algo.

## 4. Lógica de negócio — decisões vigentes

- **Dois conceitos de gasto**: orçamento/alertas/lançamentos medem POR VENCIMENTO (buscarLancamentosPorMes com CASE WHEN dataVencimento). Card DESPESAS do Resumo: "a pagar no mês" + linha "Comprado: R$X" (buscarTotalCompradoMes, por data da compra).
- **Cartão**: cada parcela é um lançamento (grupoId comum), vencimento via calcularVencimento. Pagar fatura marca pagas só as parcelas do mês. Limite usado = parcelas não pagas. Reeditar grupo preserva pagas via marcarParcelasPagas.
- **Contas**: AsyncStorage (@financaspro:contas), lançamentos no SQLite. Conta especial "especie_fixa" (Dinheiro em Espécie). Saldo afetado na criação, revertido na exclusão, recalculado na edição.
- **Receitas**: Pix, Transferência, Depósito, Dinheiro (Crédito removido 10/06).
- **Paywall**: verificação dupla (150 OU 30 dias) em novo-lancamento.tsx E voz.tsx. Mantido 150/30 no lançamento.
- **Categorias**: conjunto padrão v4 em categorias.ts; migrarCategorias vazia — não recriar.
- **PIN**: 4 dígitos no primeiro uso, exigido a cada abertura. Esqueceu = reinstalar (sem nuvem). O app TEM backup manual (exportação) — usuário precisa lembrar de fazer.

## 5. Correções da 1.0.1 (versionCode 2→3) — APLICADAS em 13/07/2026

Herdadas do v4 (já em produção antes desta rodada):
1. Paywall conta compras, não parcelas.
2. Sem sufixo (1/1) em parcela única.
3. Receita em Dinheiro por voz pula pergunta de conta.
4. Boleto por voz salva como 'pendente' (antes salvava como 'pago').

**Novas nesta rodada (13/07, auditoria + teste real de compra):**

5. **Botão "Desbloquear Premium" em Configurações** (`app/(tabs)/configuracoes.tsx`) — antes só existia paywall automático ao bater o limite gratuito; agora tem entrada manual, mostra "Premium ativo 👑" quando já comprado (via `useFocusEffect` lendo `@faladinheiro:desbloqueado`).
6. **`paywall.tsx` reescrito para `react-native-iap` v15.0.2** — o código usava a API antiga (v12-style: `getProducts`, `requestPurchase({skus})`, `getPurchaseHistory`), incompatível com a versão instalada (API Nitro-based, totalmente diferente). **Isso teria bloqueado 100% das compras reais na 1.0.0 publicada** — só foi descoberto porque rodamos `tsc --noEmit` no projeto. Trocado para `fetchProducts`, `requestPurchase({request:{google,apple},type})`, `restorePurchases`/`getAvailablePurchases`.
7. **`finishTransaction` adicionado** — obrigatório reconhecer a compra junto à Google em até 3 dias no Android, senão ela é reembolsada automaticamente. Não existia no código original.
8. **`purchaseUpdatedListener` simplificado** — a versão inicial da correção checava se `purchase.productId`/`ids` batia com o SKU antes de desbloquear; na prática isso deu falso negativo (compra concluída na Google, app não desbloqueou). Como o app só vende um produto, removida a checagem — qualquer evento de compra é aceito.
9. **`restaurar()` agora também chama `finishTransaction`** nas compras encontradas — antes só marcava desbloqueado localmente, sem reconhecer junto à Google.
10. Texto "atingiu o limite de 100 lançamentos" no paywall corrigido pra genérico (estava dessincronizado do limite real de 150/30 dias).
11. `editar-lancamento.tsx`: tipo de `cartoes` estava restrito demais (`{id,apelido}[]`), causava erro de tipo ao acessar `.fechamento`/`.vencimento` — ampliado pra `any[]`.
12. `DateTimePicker`: removido `locale="pt-BR"` em 3 lugares (editar-lancamento.tsx ×2, novo-lancamento.tsx) — essa prop não existe no modo `display="calendar"` do Android, era um no-op que só gerava erro de tipo.
13. `voz.tsx`: `onDone: () => setTimeout(...)` sem chaves retornava o número do timer em vez de void — só limpeza de tipo, zero efeito prático.
14. Versão exibida em Configurações ("Sobre") e Política de Privacidade estava fixa em texto ("Versão 1.0.0") — trocada por `Constants.expoConfig?.version` (lê dinamicamente do app.json, não precisa lembrar de atualizar a cada release).

**Confirmado**: nenhuma dessas correções (5–14) foi causada por alterações feitas com o Fable — checado via git blame/pickaxe, os bugs de tipagem antigos (11–13) já existiam desde abril/maio.

## 6. Processo descoberto: como testar compra real (Play Billing)

- **APK sideload NÃO funciona para testar compras** — dá erro "Esta versão do app não está configurada para faturamento pelo Google Play". A Play Billing só autoriza apps instalados **pela própria Play Store**.
- Fluxo correto:
  1. Gerar AAB (`bundleRelease`), bumpar versionCode antes.
  2. Play Console → Teste → Teste Interno → Criar nova versão → subir o AAB → publicar (fica pronto em minutos, sem revisão longa).
  3. Aba "Testadores" → adicionar o e-mail que vai testar numa lista.
  4. Play Console → Configurações → **Teste de licença** (usar a busca do Play Console pra achar, não é óbvio no menu lateral) → marcar a mesma lista de e-mails → Salvar. Sem isso, a compra de teste pode cobrar de verdade.
  5. No celular: desinstalar qualquer APK sideload → abrir o link de opt-in do Teste Interno (aba Testadores → "Copiar link") → aceitar → instalar pelo botão que abre a Play Store (não pelo APK).
  6. Testar a compra normalmente.
- Compras de teste via testador de licença aparecem no histórico de Pedidos da Play Store como **"Reembolsado"** — isso é NORMAL e esperado (a Google processa a compra e estorna automaticamente depois, pra ninguém ser cobrado de verdade durante testes). Não é bug.
- Promover a versão testada do Teste Interno pra Produção: aba "Versões" → botão "Promover versão" → Produção. Reaproveita a mesma AAB já testada, não precisa subir de novo.
- Produção não publica direto ao salvar — fica em "Visão geral da publicação" como rascunho até clicar em "Enviar mudança para revisão".

## 7. Achados menores NÃO corrigidos (avaliar na 1.0.1+ conforme feedback real)

- Heurística do tipo por voz: fala curta contendo "d" vira despesa (ex.: "dúvida").
- debitarConta/creditarConta são read-modify-write no AsyncStorage sem lock (risco teórico de corrida).
- Comentário desatualizado em voz.tsx (menciona Crédito nas receitas).
- PALAVRAS_NEGACAO por substring; renomear categoria não atualiza lançamentos antigos; drift de centavos ao reeditar grupo (parcela × n); tela "Conferência final" morta em voz.tsx; despesa Transferência/Depósito pede conta na voz/edição mas não na tela manual (e a tela manual não debita conta nesses casos); buscarTotalUsadoCartao ignora mes/ano; tabela "contas" do SQLite sem uso; recuperação de PIN mais amigável.

## 8. Mercado e posicionamento (pesquisa 13/07/2026)

- Líderes: Mobills (10M+ usuários, Premium R$ 199,90/ano) e Organizze (R$ 199,90–599,90/ano, trial 7 dias).
- Onda 2025/26: assistentes financeiros por IA no WhatsApp (Poupa.ai, Fala Zuki, ZapGastos, MePoupaAi ~R$ 29,99/mês, PoQT). O próprio Mobills PRO lançou IA por áudio no WhatsApp. A tese "registrar gasto falando" está validada pelo mercado.
- Diferencial do Fala, Dinheiro!: R$ 14,90 único vs assinatura · 100% local/privado vs nuvem/WhatsApp · voz nativa · sem cadastro.
- Veredito de viabilidade: produto coerente e nicho validado; o gargalo é DISTRIBUIÇÃO, não engenharia.

## 9. Marketing — estratégia definida

Documento completo: `ESTRATEGIA_DIVULGACAO.md`. Resumo:

- Públicos prioritários: (1) desistentes de apps de finanças; (2) cansados de assinatura; (3) público 45+ (forte no Facebook). Secundários: privacidade, parceladores, MEI/autônomos.
- Posicionamento: "O único app de finanças que você usa falando — e paga uma vez só."
- Mesmo vídeo vertical (15–40s, legendado) em TikTok/Reels/Shorts/Facebook. Mix: 50% demo real de tela, 25% avatar IA dor+solução, 15% comparativo de preço, 10% prova social.
- Cadência: 3 vídeos + 1 carrossel + 1 post/semana.
- Stack IA: HeyGen, CapCut, Canva, ElevenLabs opcional. Começar com custo ~zero.
- YouTube: Shorts + 2 vídeos-base (tutorial completo e história da criadora).
- **Opção paga complementar (nova, 13/07)**: Google Ads App Campaigns (ACi) — anúncio automático que aparece na busca da Play Store, Google Search, YouTube, Discover e Rede. Você fornece texto/imagens/vídeo da ficha do app, define orçamento e lance por instalação; o Google testa e otimiza sozinho. Custo real (diferente do resto da estratégia, que é gratuita). Considerar só depois que a divulgação orgânica já estiver rodando e houver uma noção de quanto uma instalação vale (com venda de R$14,90, dá pra calcular um teto de CPA que compensa).

## 10. Próximos passos

1. **Aguardar aprovação da 1.0.1** (enviada para revisão em 13/07/2026, produção).
2. Iniciar divulgação orgânica assim que a 1.0.1 estiver aprovada: gravar demos reais de tela, atualizar bio dos perfis com o link, seguir a cadência da ESTRATEGIA_DIVULGACAO.md.
3. Acompanhar Play Console diariamente na 1ª semana pós-aprovação: instalações, crashes (Android Vitals), avaliações — responder todas.
4. Considerar Google Ads App Campaigns como complemento pago, mais adiante.
5. Verificação de Desenvolvedor Android antes de 30/09/2026.
6. Testes em dispositivos parceiros do Google a partir de 25/07/2026 (informativo).
7. Backlog 1.0.1+ (seção 7) conforme feedback real dos usuários.
8. Próximo app: Fala, Bichinho! (com.tatriapps.falabichinho) — Fases 1–7.5 concluídas, Phase 8 (publicação) pendente.
