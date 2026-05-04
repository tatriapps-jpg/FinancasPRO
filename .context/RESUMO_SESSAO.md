# RESUMO DA SESSÃO — Fala, Dinheiro! (2026-04-29 a 2026-05-04)

## 1. O que está funcionando

- **APK release Android** gerado com sucesso (`assembleRelease` ~3–4min, 1054 tasks)
- **New Architecture** habilitada e estável
- **Entrada por voz** completa: extenso, Pix (~20 variações), categoria por tipo, voltar etapa, placeholder adaptativo
- **Botão "?" de ajuda** em 8 telas (index, lancamentos, orcamento, relatorios, voz, novo-lancamento, contas, cartoes)
- **HelpModal.tsx** centralizado: exporta `helpBtnStyle`, `helpTxtStyle`, `HelpModal` default
- **Crash "Novo Lançamento"** corrigido: `helpVisible` não estava declarado em `NovoLancamentoScreen`
- **Notificações** com 4 funções ativas: vencimento, alerta orçamento, lembrete motivacional, configurar canal
- **Categorias** normalizadas via `migrarCategorias()` no initDB
- **Backup/restauração** JSON funcionando

---

## 2. O que está pendente / com bug

### Bug ativo — Botão "Entendi" invisível no Android
O texto do botão de fechar do `HelpModal` não aparece — só a barra azul.

| # | Tentativa | Resultado |
|---|-----------|-----------|
| 1 | Remover `includeFontPadding: false`, adicionar `lineHeight: 20` | Não resolveu |
| 2 | Estilos inline + `View` dentro de `TouchableOpacity` | Não resolveu |
| 3 | `flex: 1` no box e no ScrollView (era `maxHeight: 340`) | Não resolveu |
| 4 | **`Pressable` + `height: 48` explícito** (implementação atual) | Aguarda teste |

**Estado atual do botão:**
```tsx
<Pressable
  onPress={onClose}
  style={{ marginTop: 20, backgroundColor: '#5294ff', borderRadius: 8,
           height: 48, width: '100%', justifyContent: 'center', alignItems: 'center' }}
>
  <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>Entendi</Text>
</Pressable>
```

**Hipóteses ainda em aberto:**
- `ScrollView flex:1` dentro de `box flex:1` pode ainda comprimir o botão
- `Pressable` aninhado dentro de `Pressable` (overlay) pode absorver o toque
- Possível solução alternativa: substituir o `Modal` inteiro por um `View` absoluto posicionado manualmente

### Pendente para publicação na Play Store
- [ ] Confirmar botão "Entendi" visível no dispositivo físico
- [ ] Testes end-to-end: fluxo voz completo + parcelamento + IAP
- [ ] Compra IAP em ambiente de produção (track interno / alpha)
- [ ] Screenshots e assets para ficha da loja
- [ ] Política de privacidade em URL pública
- [ ] Keystore definitivo configurado para release
- [ ] Gerar AAB (`gradlew bundleRelease`) — Play Store exige AAB, não APK

---

## 3. Próximos passos em ordem de prioridade

1. **Testar APK atual no dispositivo físico** — confirmar se o `Pressable` com `height: 48` resolveu o botão "Entendi"
2. **Se ainda invisível:** substituir o `Modal` do HelpModal por um `View` com `position: 'absolute'` cobrindo a tela inteira (elimina variáveis do sistema de Modal do Android)
3. **Testar fluxo de voz completo** no dispositivo: tipo → descrição → valor → categoria → forma → confirmar
4. **Testar parcelamento no crédito** (lançar, verificar N parcelas no banco, pagar fatura)
5. **Testar IAP** — subir APK no track interno da Play Console e comprar o premium
6. **Preparar ficha da loja**: título, descrição curta, descrição longa, screenshots (mín. 2), ícone 512px
7. **Hospedar política de privacidade** — pode ser GitHub Pages ou qualquer URL pública
8. **Gerar AAB** (`./gradlew bundleRelease`) e fazer upload na Play Console

---

## 4. Decisões tomadas (não reverter)

| Decisão | Detalhe |
|---------|---------|
| **Package name** | `com.tatriapps.faladinheiro` — imutável após publicação |
| **Nome do app** | "Fala, Dinheiro!" (slug Expo "FinancasPRO" por razão histórica) |
| **Monetização** | Compra única (one-time purchase), sem assinatura. SKU: `financaspro_premium` |
| **Limite gratuito** | 150 lançamentos no código; paywall exibe "100" (marketing) — diferença intencional |
| **Arquitetura de dados** | Lançamentos/cartões → SQLite; contas/categorias/configs → AsyncStorage |
| **Datas** | Sempre strings `DD/MM/YYYY` — nunca objetos `Date` no banco |
| **IDs** | Sempre `gerarId()` de `database.ts` — nunca `crypto.randomUUID()` |
| **Velocidade de voz padrão** | 1.3 (Normal). Opções: 1.0 / 1.3 / 1.6 |
| **Tutorial de voz** | Completo nas 3 primeiras sessões (`VOZ_TUTORIAL_LIMITE = 3`), depois resumido |
| **HelpModal** | Centralizado em `app/HelpModal.tsx`; botão usa `Pressable`; overlay usa `Pressable` |
| **Cor primária** | Verde `#1a5c3a` (marca/splash); Azul `#5294ff` (ações/UI) |
| **Build** | `assembleRelease` direto — nunca `gradlew clean assembleRelease` sem limpar worklets |
| **FileSystem** | `expo-file-system/legacy` (não o módulo padrão) |
