# CONTEXTO — Fala, Dinheiro!

Documento de continuidade entre sessões · Atualizado em 30/07/2026 (v6, substitui o v5 de 13/07)

**30/07/2026: PRIMEIRA CAMPANHA DE TRÁFEGO PAGO NO AR (Meta Ads).** 🎉

## 1. Identificação do projeto

- App: **Fala, Dinheiro!** — finanças pessoais com lançamento por voz (Android)
- Desenvolvedora: Glaci, TaTri Apps (Brusque, SC)
- Package: com.tatriapps.faladinheiro · Projeto: C:\Users\usuario\FinancasPRO
- Stack: React Native + Expo SDK 54 (expo-router), SQLite (financaspro.db) + AsyncStorage
- Keystore: faladinheiro-release.keystore, alias faladinheiro
- Monetização: compra única R$ 14,90 (financaspro_premium). Grátis: 150 lançamentos OU 30 dias, o que vier primeiro
- Meta: 1.000 downloads/mês · GitHub: tatriapps-jpg/FinancasPRO
- E-mails: login demeloglaci@gmail.com (Marco) · notificações Google marcoaldemelo@gmail.com · loja tatriapps@gmail.com
- Conta de anúncios Meta: act 418980259215725, Business Portfolio "Fala, Dinheiro!" (business_id 2236638787094891), Página do Facebook "Fala, Dinheiro" (ID 1285930021262051), Instagram @faladinheiroapp

## 2. Estado atual

- **v1.0.0** aprovada e publicada em 13/07/2026. **v1.0.1** foi enviada para revisão do Google em 13/07/2026 (ver v5 arquivado para o processo completo de teste de compra real).
- ⚠️ **Nota em aberto**: `app.json` está com `version: "1.0.3"` e o repositório local tem alterações não commitadas em praticamente todos os arquivos de `app/`, além de arquivos novos não versionados (`BUILD.md`, `marketing/`, `app/onboarding.tsx`). Isso não foi trabalho desta sessão (que tratou só de Meta Ads) — **confirmar com a Glaci o que mudou e se/quando commitar**, antes de assumir que é 1.0.1, 1.0.2 ou já outra versão.
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
- Ao editar arquivos grandes neste ambiente, o mount Linux (bash) às vezes fica com cópia desatualizada/truncada depois de uma edição — é só um cache do ambiente, o arquivo real (Windows, o que a Glaci builda) está sempre correto.
- **Ações que só a Glaci pode fazer** (regra de segurança do assistente): clicar em "Publicar" no Meta Ads Manager, na Meta for Developers ou no Play Console; aceitar Termos de Serviço/consentimentos; inserir senha ou dado de pagamento; qualquer ação irreversível de publicação.

## 4. Lógica de negócio — decisões vigentes

- **Dois conceitos de gasto**: orçamento/alertas/lançamentos medem POR VENCIMENTO (buscarLancamentosPorMes com CASE WHEN dataVencimento). Card DESPESAS do Resumo: "a pagar no mês" + linha "Comprado: R$X" (buscarTotalCompradoMes, por data da compra).
- **Cartão**: cada parcela é um lançamento (grupoId comum), vencimento via calcularVencimento. Pagar fatura marca pagas só as parcelas do mês. Limite usado = parcelas não pagas. Reeditar grupo preserva pagas via marcarParcelasPagas.
- **Contas**: AsyncStorage (@financaspro:contas), lançamentos no SQLite. Conta especial "especie_fixa" (Dinheiro em Espécie). Saldo afetado na criação, revertido na exclusão, recalculado na edição.
- **Receitas**: Pix, Transferência, Depósito, Dinheiro (Crédito removido 10/06).
- **Paywall**: verificação dupla (150 OU 30 dias) em novo-lancamento.tsx E voz.tsx.
- **Categorias**: conjunto padrão v4 em categorias.ts; migrarCategorias vazia — não recriar.
- **PIN**: 4 dígitos no primeiro uso, exigido a cada abertura. Esqueceu = reinstalar (sem nuvem). O app TEM backup manual (exportação) — usuário precisa lembrar de fazer.

## 5. Correções da 1.0.1 (histórico, ver v5 arquivado para lista completa)

Ver `CONTEXTO_Fala_Dinheiro_5.md` seção 5 para as 14 correções aplicadas em 13/07 (paywall react-native-iap v15, finishTransaction, botão Desbloquear Premium em Configurações, etc.).

## 6. Processo: como testar compra real (Play Billing)

Ver `CONTEXTO_Fala_Dinheiro_5.md` seção 6 — resumo: APK sideload não serve para testar compra (Play Billing só autoriza instalação pela própria Play Store); fluxo é AAB → Teste Interno → testador de licença → instalar via link da Play Store.

## 7. Achados menores NÃO corrigidos (avaliar conforme feedback real)

- Heurística do tipo por voz: fala curta contendo "d" vira despesa (ex.: "dúvida").
- debitarConta/creditarConta são read-modify-write no AsyncStorage sem lock (risco teórico de corrida).
- Comentário desatualizado em voz.tsx (menciona Crédito nas receitas).
- PALAVRAS_NEGACAO por substring; renomear categoria não atualiza lançamentos antigos; drift de centavos ao reeditar grupo (parcela × n); tela "Conferência final" morta em voz.tsx; despesa Transferência/Depósito pede conta na voz/edição mas não na tela manual; buscarTotalUsadoCartao ignora mes/ano; tabela "contas" do SQLite sem uso; recuperação de PIN mais amigável.

## 8. Mercado e posicionamento

- Líderes: Mobills (10M+ usuários, Premium R$ 199,90/ano) e Organizze (R$ 199,90–599,90/ano, trial 7 dias).
- Onda 2025/26: assistentes financeiros por IA no WhatsApp. A tese "registrar gasto falando" está validada pelo mercado.
- Diferencial do Fala, Dinheiro!: R$ 14,90 único vs assinatura · 100% local/privado vs nuvem/WhatsApp · voz nativa · sem cadastro.
- Veredito de viabilidade: produto coerente e nicho validado; o gargalo é DISTRIBUIÇÃO, não engenharia.

## 9. Marketing — estratégia orgânica

Documento completo: `marketing/ESTRATEGIA_DIVULGACAO.md`. Resumo:

- Públicos prioritários: (1) desistentes de apps de finanças; (2) cansados de assinatura; (3) público 45+ (forte no Facebook). Secundários: privacidade, parceladores, MEI/autônomos.
- Posicionamento: "O único app de finanças que você usa falando — e paga uma vez só."
- Mesmo vídeo vertical (15–40s, legendado) em TikTok/Reels/Shorts/Facebook. Mix: 50% demo real de tela, 25% avatar IA dor+solução, 15% comparativo de preço, 10% prova social.
- Cadência: 3 vídeos + 1 carrossel + 1 post/semana.
- Stack IA: HeyGen, CapCut, Canva, ElevenLabs opcional.
- YouTube: Shorts + 2 vídeos-base.
- Assets prontos em `marketing/`: capa do Facebook, carrossel e stories do Instagram, screenshots brutos e versão "store" (com moldura) das 7 telas principais (Configurações, Lançamento por voz Farmácia 3X, Lançamentos, Orçamento, PIN, Relatórios, Resumo), posts "chegamos" e "comparativo".

## 10. Tráfego pago — Meta Ads (execução, 29–30/07/2026)

### Estrutura de campanhas na conta (act 418980259215725)

| Campanha | Status em 30/07 | Destino | Orçamento |
|---|---|---|---|
| **Fala, Dinheiro! - Trafego Play Store 3** (anúncio "Anuncio Trafego App 3") | **Publicada, em análise** — sem erros | App → Play Store | R$ 40/dia, 30/07 a 04/08 (~5 dias) |
| Fala, Dinheiro! - Trafego Play Store 2 | Ativa | App → Play Store | R$ 10/dia (orçamento compartilhado) |
| Fala, Dinheiro! - Trafego Play Store | Sem anúncio ativo | — | R$ 10/dia (orçamento compartilhado) |
| ~~Fala, Dinheiro! - Trafego Play Store 4~~ | **Excluída em 30/07** (era rascunho backup, não publicada) | Site → Play Store | R$ 40/dia |

### Bug crítico encontrado e corrigido: erro #1443121 "Página do Facebook ausente"

- O seletor "Página do Facebook" nos anúncios ficava travado (sem dropdown funcional), bloqueando a publicação com o erro genérico #1443121, em qualquer anúncio/campanha/destino testado.
- **Causa real** (diagnosticada pelo assistente de IA de Suporte da Meta, após reportarmos o bug): a Glaci tinha acesso total de admin no Business Portfolio, mas **faltava a permissão específica "Anúncios" no nível da Página** do Facebook "Fala, Dinheiro" — algo que não aparece de forma clara em nenhuma mensagem de erro.
- **Correção**: Business Settings → Páginas → Fala, Dinheiro → Atribuir pessoas → Glaci Melo → habilitar "Anúncios" (habilita "Insights" junto). Resolvido e confirmado — o seletor de Página passou a funcionar normalmente.
- Registrar para o futuro: se esse erro voltar a aparecer (nesta conta ou em outra Página/BM), checar primeiro as permissões de Página em Business Settings → Páginas → [Página] → Pessoas com acesso, antes de suspeitar de bug de plataforma.

### Próximo passo combinado
Acompanhar a entrega/desempenho da "Trafego Play Store 3" nos próximos dias; quando confirmado que está entregando bem, suspender a "Trafego Play Store 2" (R$10/dia) para não haver sobreposição de verba.

## 11. Próximos passos

1. Acompanhar entrega da campanha Meta Ads "Trafego Play Store 3" (publicada 30/07) e decidir sobre suspender a "Trafego Play Store 2".
2. Esclarecer com a Glaci o estado real do código (`app.json` em 1.0.3, mudanças não commitadas — ver seção 2) antes de qualquer novo build/checkpoint.
3. Retomar acompanhamento da revisão da 1.0.1 no Play Console (status na última atualização: em análise desde 13/07).
4. Iniciar/continuar divulgação orgânica seguindo `marketing/ESTRATEGIA_DIVULGACAO.md` — assets de screenshots e posts já prontos em `marketing/`.
5. Considerar Google Ads App Campaigns como complemento pago, mais adiante.
6. Verificação de Desenvolvedor Android antes de 30/09/2026.
7. Backlog técnico (seção 7) conforme feedback real dos usuários.
8. Próximo app: Fala, Bichinho! (com.tatriapps.falabichinho) — Fases 1–7.5 concluídas, Phase 8 (publicação) pendente.
