# CONTEXTO — Fala, Dinheiro!
Documento de continuidade entre sessões · Atualizado em 13/07/2026 (v4, substitui o v3 de 05/07)

> **13/07/2026: APP APROVADO PELO GOOGLE E PUBLICADO NA PLAY STORE.** 🎉

## 1. Identificação do projeto
- App: **Fala, Dinheiro!** — finanças pessoais com lançamento por voz (Android)
- Desenvolvedora: Glaci, TaTri Apps (Brusque, SC)
- Package: com.tatriapps.faladinheiro · Projeto: C:\Users\usuario\FinancasPRO
- Stack: React Native + Expo SDK 54 (expo-router), SQLite (financaspro.db) + AsyncStorage
- Keystore: faladinheiro-release.keystore, alias faladinheiro
- Monetização: compra única R$ 14,90 (financaspro_premium). Grátis: 150 lançamentos OU 30 dias, o que vier primeiro
- Meta: 1.000 downloads/mês · GitHub: tatriapps-jpg/FinancasPRO
- E-mails: login demeloglaci@gmail.com (Marco) · notificações Google marcoaldemelo@gmail.com · loja tatriapps@gmail.com

## 2. Estado atual — PUBLICADO NA PLAY STORE
- **v1.0.0 APROVADA em 13/07/2026** (submetida 05/07). App no ar na Play Store.
- Somente Brasil (expansão para outros países possível depois, se desejado).
- Pendências não bloqueantes: Verificação de Desenvolvedor Android (prazo Brasil: 30/09/2026); testes em dispositivos parceiros do Google a partir de 25/07/2026 (informativo).

## 3. Regras de trabalho com a Glaci (OBRIGATÓRIAS)
- Respostas em português, diretas e concisas, sem preâmbulos nem perguntas automáticas no final.
- Comandos para o Claude Code SEMPRE curtos e rotulados (A1, B1...). Comandos longos chegam truncados.
- Builds SEMPRE locais via CMD (nunca EAS cloud), em C:\Users\usuario\FinancasPRO\android:
  - APK teste: `gradlew.bat assembleRelease -Dorg.gradle.jvmargs="-Xmx4g"`
  - AAB: `gradlew.bat bundleRelease -Dorg.gradle.jvmargs="-Xmx4g"`
  - Falha "Gradle build daemon disappeared" = memória: `gradlew.bat --stop`, fechar programas, tentar -Xmx3g.
- NUNCA crypto.randomUUID() — sempre gerarId() de database.ts.
- SEMPRE expo-file-system/legacy para gravação de arquivos.
- Arquivos de código sempre completos, nunca parciais.
- Colar: CMD = botão direito; Claude Code = Ctrl+V.
- "Usage credits are required for long context requests" no Code: parar e abrir conversa nova.
- Decisões: opções claras com recomendação antes de implementar.
- Checkpoint git antes de cada lote; nas correções da 1.0.1 adotamos **um commit isolado por correção**.
- Nunca afirmar algo incerto como fato; dúvida deve ser explicitada.

## 4. Lógica de negócio — decisões vigentes
- **Dois conceitos de gasto**: orçamento/alertas/lançamentos medem POR VENCIMENTO (buscarLancamentosPorMes com CASE WHEN dataVencimento). Card DESPESAS do Resumo: "a pagar no mês" + linha "Comprado: R$X" (buscarTotalCompradoMes, por data da compra).
- **Cartão**: cada parcela é um lançamento (grupoId comum), vencimento via calcularVencimento. Pagar fatura marca pagas só as parcelas do mês. Limite usado = parcelas não pagas. Reeditar grupo preserva pagas via marcarParcelasPagas.
- **Contas**: AsyncStorage (@financaspro:contas), lançamentos no SQLite. Conta especial "especie_fixa" (Dinheiro em Espécie). Saldo afetado na criação, revertido na exclusão, recalculado na edição.
- **Receitas**: Pix, Transferência, Depósito, Dinheiro (Crédito removido 10/06).
- **Paywall**: verificação dupla (150 OU 30 dias) em novo-lancamento.tsx E voz.tsx. DECISÃO 13/07: manter 150/30 no lançamento — o teto real para a maioria é 30 dias (o contador inicia no 1º lançamento); os 150 só afetam quem faz >5/dia. Ficha "Detalhes do login" no Play Console descreve 150/30 — não mudar antes da aprovação. Reavaliar com dados na 1.0.1 (ajuste fino seria nos dias, não nos 150).
- **Categorias**: conjunto padrão v4 em categorias.ts; migrarCategorias vazia — não recriar.
- **PIN**: 4 dígitos no primeiro uso, exigido a cada abertura. Esqueceu = reinstalar (sem nuvem). O app TEM backup manual (exportação) — usuário precisa lembrar de fazer.

## 5. Correções 1.0.1 — APLICADAS em 13/07/2026 (commits isolados)
Auditoria de código feita pelo assistente em 13/07 confirmou que o app estava fiel ao documentado; 4 pontos novos foram corrigidos:
1. **Paywall conta compras, não parcelas** (novo-lancamento.tsx + voz.tsx): limite de 150 agora conta lançamentos sem grupoId + grupos distintos (compra 12x = 1). Commit "paywall conta compras nao parcelas".
2. **Sem sufixo (1/1)** (database.ts, inserirLancamentosParcelados): sufixo (i/n) só quando n > 1. Commit "sem sufixo 1/1 em parcela unica".
3. **Receita em Dinheiro por voz** (voz.tsx): pula a etapa contaReceita e vai direto a obs/confirmação com conta vazia (antes perguntava e descartava a resposta — crédito sempre em especie_fixa). Commit "voz pula conta em receita dinheiro".
4. **Boleto por voz** (voz.tsx, salvarDireto): status 'pendente' (antes salvava como 'pago' com vencimento = hoje). Vencimento continua = hoje; usuário ajusta na edição. Decisão: NÃO adicionar etapa de data ao fluxo de voz (boleto em declínio, não justifica o risco). Commit "boleto por voz salva pendente".

Status em 13/07: correções verificadas no código pelo assistente (implementação cirúrgica, nada além do combinado). **Build do APK de teste em andamento; teste de regressão pendente**: despesa voz Pix, crédito 3x voz, receita dinheiro voz (não deve perguntar conta), boleto voz (pendente), crédito 1x manual (sem "(1/1)"), conferência de saldos.

IMPORTANTE: nada foi enviado ao Play Console — a 1.0.1 (versionCode 2) só sobe APÓS a aprovação/publicação da 1.0.0.

### Housekeeping do repositório (13/07)
- Push feito; branch master sincronizado com origin.
- Arquivo-lixo "C:UsersusuarioFinancasPRO.gitignore" (nome literal com caminho, continha só "*.bak") deletado. O .gitignore verdadeiro está intacto — CUIDADO: o Code uma vez confundiu os dois; nunca deletar o .gitignore real.
- Diferenças CRLF/LF podem aparecer como arquivos "modificados" em ambiente Linux; no Windows a árvore está limpa. Ignorar.

## 6. Achados menores NÃO corrigidos (avaliar na 1.0.1+)
- Heurística do tipo por voz: fala curta contendo "d" vira despesa (ex.: "dúvida").
- debitarConta/creditarConta são read-modify-write no AsyncStorage sem lock (risco teórico de corrida).
- Comentário desatualizado em voz.tsx (menciona Crédito nas receitas).
- Backlog original da seção 6 do contexto v3 permanece válido: PALAVRAS_NEGACAO por substring; renomear categoria não atualiza lançamentos antigos; drift de centavos ao reeditar grupo (parcela × n); tela "Conferência final" morta em voz.tsx; despesa Transferência/Depósito pede conta na voz/edição mas não na tela manual (e a tela manual não debita conta nesses casos); buscarTotalUsadoCartao ignora mes/ano; tabela "contas" do SQLite sem uso; recuperação de PIN mais amigável.

## 7. Mercado e posicionamento (pesquisa 13/07/2026)
- Líderes: Mobills (10M+ usuários, Premium R$ 199,90/ano) e Organizze (R$ 199,90–599,90/ano, trial 7 dias).
- Onda 2025/26: assistentes financeiros por IA no WhatsApp (Poupa.ai, Fala Zuki, ZapGastos, MePoupaAi ~R$ 29,99/mês, PoQT). O próprio Mobills PRO lançou IA por áudio no WhatsApp. A tese "registrar gasto falando" está validada pelo mercado.
- Diferencial do Fala, Dinheiro! (combinação que ninguém replica): R$ 14,90 único vs assinatura · 100% local/privado vs nuvem/WhatsApp · voz nativa · sem cadastro.
- Veredito de viabilidade: produto coerente e nicho validado; o gargalo é DISTRIBUIÇÃO, não engenharia.

## 8. Marketing — estratégia definida (13/07)
Documento completo em **marketing/ESTRATEGIA_DIVULGACAO.md** (públicos, roteiros, calendário). Resumo:
- Públicos prioritários: (1) desistentes de apps de finanças — digitar cansa; (2) cansados de assinatura; (3) público 45+ (forte no Facebook). Secundários: privacidade, parceladores, MEI/autônomos.
- Posicionamento: "O único app de finanças que você usa falando — e paga uma vez só."
- Mesmo vídeo vertical (15–40s, legendado) em TikTok/Reels/Shorts/Facebook. Mix: 50% demo real de tela (conteúdo que mais converte — não precisa de IA), 25% avatar IA dor+solução, 15% comparativo de preço, 10% prova social.
- Cadência: 3 vídeos + 1 carrossel + 1 post/semana.
- Stack IA: HeyGen (melhor pt-BR para avatar; começar no plano grátis), CapCut (edição/legendas, grátis), Canva (carrosséis), ElevenLabs opcional. Começar com custo ~zero.
- YouTube: Shorts + 2 vídeos-base (tutorial completo e história da criadora); títulos com "app de finanças por voz".

## 9. Próximos passos (pós-aprovação, 13/07)
1. **Validação em produção**: instalar o app DA LOJA num celular real e testar o fluxo completo, principalmente a COMPRA REAL do financaspro_premium (R$ 14,90) — primeira vez que o billing roda em produção. Guardar o link da loja para o marketing.
2. Terminar build local e rodar o teste de regressão das 4 correções da 1.0.1.
3. Gerar AAB 1.0.1 (versionCode 2) e subir ao Play Console quando o teste passar.
4. **Iniciar marketing imediatamente** (link da loja já existe): gravar primeiras demos reais de tela; bio dos perfis com o link.
5. Acompanhar Play Console diariamente na 1ª semana: instalações, crashes (Android Vitals), avaliações — responder todas.
6. Verificação de Desenvolvedor Android antes de 30/09/2026.
7. Testes em dispositivos parceiros do Google a partir de 25/07 (informativo).
8. Backlog 1.0.1+ (seção 6) conforme feedback dos usuários.
9. Próximo app: Fala, Bichinho! (com.tatriapps.falabichinho) — Fases 1–7.5 concluídas, Phase 8 (publicação) pendente.
