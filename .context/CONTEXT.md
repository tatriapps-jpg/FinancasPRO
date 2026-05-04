# CONTEXT — Fala, Dinheiro!

## Identidade do projeto

| Campo         | Valor                              |
|---------------|------------------------------------|
| Nome exibido  | Fala, Dinheiro!                    |
| Slug Expo     | FinancasPRO                        |
| Package       | com.tatriapps.faladinheiro         |
| Versão        | 1.0.0                              |
| Empresa       | TaTri Apps                         |
| Contato       | tatriapps@gmail.com                |
| EAS Project   | 7926249f-8d0f-4eac-9715-c52e80d8dc0f |
| Scheme        | faladinheiro                       |

## Modelo de negócio

- **Freemium com compra única (one-time purchase)**
- Plano gratuito: até **150 lançamentos** (definido em `voz.tsx:16` como `LIMITE_GRATIS`)
- Paywall exibe "100 lançamentos" para o usuário (texto de marketing, `paywall.tsx:154`)
- Premium: pagamento único, sem assinatura recorrente
- SKU Android: `financaspro_premium` | SKU iOS: `financaspro_premium_ios`
- Chave AsyncStorage: `@faladinheiro:desbloqueado`
- Biblioteca de pagamento: `react-native-iap ^15.0.2`

## Stack técnica

| Camada        | Tecnologia                                  |
|---------------|---------------------------------------------|
| Framework     | Expo SDK ~54 / React Native 0.81.5          |
| Roteamento    | expo-router ~6.0.23 (file-based)            |
| Banco de dados| expo-sqlite ~16.0.10 (SQLite local)         |
| Persistência  | AsyncStorage 2.2.0 (configs e contas)       |
| Voz entrada   | expo-speech-recognition ^3.1.2              |
| Voz saída     | expo-speech ~14.0.8                         |
| Câmera/QR     | expo-camera ~17.0.10                        |
| Pagamentos    | react-native-iap ^15.0.2                    |
| Animações     | react-native-reanimated ~4.1.1              |
| Gráficos      | react-native-svg 15.12.1                    |
| Notificações  | expo-notifications ^55.0.19                 |
| Tema          | Context API próprio (theme.tsx)             |
| Arquitetura   | New Architecture habilitada                 |
| Language      | TypeScript ~5.9.2                           |
| React         | 19.1.0                                      |

## Estrutura de arquivos

```
FinancasPRO/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Tab navigator (5 abas)
│   │   ├── index.tsx            # Dashboard/Home
│   │   ├── lancamentos.tsx      # Lista de lançamentos
│   │   ├── relatorios.tsx       # Relatórios por mês
│   │   ├── orcamento.tsx        # Orçamento mensal
│   │   └── configuracoes.tsx    # Configurações gerais
│   ├── _layout.tsx              # Root layout (ThemeProvider, initDB, PIN check)
│   ├── database.ts              # Toda a camada SQLite (CRUD)
│   ├── theme.tsx                # ThemeProvider, cores dark/light
│   ├── voz.tsx                  # Entrada por voz (tela completa)
│   ├── novo-lancamento.tsx      # Formulário manual de lançamento
│   ├── editar-lancamento.tsx    # Edição de lançamento existente
│   ├── cartoes.tsx              # CRUD de cartões de crédito
│   ├── contas.tsx               # CRUD de contas bancárias
│   ├── categorias.tsx           # CRUD de categorias personalizadas
│   ├── paywall.tsx              # Tela de compra premium
│   ├── pin.tsx                  # Tela de PIN / desbloqueio
│   ├── notificacoes.ts          # Agendamento de notificações
│   ├── camera.tsx               # Escaneamento de recibos
│   ├── qrcode.tsx               # Leitura de QR Code
│   ├── modal.tsx                # Modal genérico
│   └── politica.tsx             # Política de privacidade
├── assets/images/               # Ícones e splash
├── android/                     # Projeto Android nativo
├── app.json                     # Configuração Expo
├── package.json
└── .context/                    # Esta pasta de documentação
```

## Banco de dados (SQLite)

Tabelas criadas em `database.ts → initDB()`:

- **lancamentos**: id, tipo, descricao, valor, categoria, formaPag, cartaoId, contaId, parcelas, parcelaAtual, totalParcelas, data, dataVencimento, dataPagamento, status, obs, grupoId, createdAt
- **cartoes**: id, apelido, bandeira, ultimos4, fechamento, vencimento, limite
- **contas**: id, nome, banco, tipo, saldo (gerenciada via AsyncStorage em contas.tsx, não via SQLite diretamente)

Datas são sempre strings no formato `DD/MM/YYYY`.

## AsyncStorage — chaves em uso

| Chave                                   | Conteúdo                         |
|-----------------------------------------|----------------------------------|
| `@faladinheiro:desbloqueado`            | 'true' se premium                |
| `@financaspro:tema`                     | 'dark' ou 'light'                |
| `@financaspro:nomeUsuario`              | nome do usuário                  |
| `@financaspro:orcamento`                | valor numérico como string       |
| `@financaspro:diasAlerta`               | dias antecipação vencimento      |
| `@financaspro:pin`                      | PIN de 4 dígitos                 |
| `@financaspro:contas`                   | JSON array de contas             |
| `@financaspro:categorias_despesa`       | JSON array de categorias         |
| `@financaspro:categorias_receita`       | JSON array de categorias         |
| `@financaspro:vozVelocidade`            | 1.0, 1.3 ou 1.6                  |
| `@financaspro:vozTutorial`              | número de usos do tutorial       |

## Status atual (2026-05-04)

### O que está funcionando
- APK release Android gerado com sucesso (`app-release.apk`) — builds ~3–4min
- New Architecture habilitada e funcionando
- Entrada por voz corrigida: extenso, Pix, categoria, voltar etapa, placeholder
- Placeholder de descrição em novo-lancamento.tsx adaptativo (receita/despesa)
- Todas as categorias normalizadas via migrarCategorias() no initDB
- Botão "?" de ajuda contextual em 8 telas: index, lancamentos, orcamento, relatorios, voz, novo-lancamento, contas, cartoes
- HelpModal.tsx centralizado com estilos exportados (helpBtnStyle, helpTxtStyle)
- Crash ao abrir "Novo Lançamento" corrigido (helpVisible não declarado)

### Bug em investigação ativa
- **Botão "Entendi" do HelpModal aparece como barra azul sem texto no Android**
  - Tentativa 1: removido `includeFontPadding: false`, adicionado `lineHeight: 20` — não resolveu
  - Tentativa 2: estilos inline + `View` dentro do `TouchableOpacity` — não resolveu
  - Tentativa 3: flex layout no `box` e `ScrollView` (maxHeight→flex:1) — não resolveu
  - Tentativa 4 (atual): substituído `TouchableOpacity` por `Pressable`, `height: 48` explícito, overlay também usa `Pressable`
  - Ainda não confirmado se resolveu — aguarda teste no dispositivo físico

### O que falta para publicar na Play Store
- ⚠️ Confirmar botão "Entendi" do HelpModal visível no dispositivo físico
- Testes end-to-end no dispositivo físico (especialmente fluxo de voz + parcelamento)
- Verificar compra IAP em ambiente de produção (track interno / alpha da Play Store)
- Screenshots e assets para a ficha da loja
- Política de privacidade hospedada em URL pública
- Configurar signing keystore definitivo para release
- Enviar AAB (não APK) via `gradlew bundleRelease` para a Play Store
