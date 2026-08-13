# Build e publicação — Fala, Dinheiro!

## Processo correto (sempre local, nunca `eas build`)

O app é assinado com uma keystore local. O `eas build` usa uma keystore diferente,
gerenciada pelos servidores da Expo, e o Google Play rejeita o `.aab` gerado por
ela porque a assinatura não bate com a chave original do app
(erro: "Seu Android App Bundle foi assinado com uma chave incorreta").

**Por isso: todo build de produção deve ser feito localmente pelo Gradle, nunca via `eas build`.**

### 1. Testar no celular (APK, via WhatsApp)

```
cd C:\Users\usuario\FinancasPRO\android
gradlew.bat assembleRelease -Dorg.gradle.jvmargs="-Xmx4g"
```

Saída: `android\app\build\outputs\apk\release\app-release.apk`
→ arrastar esse arquivo pro WhatsApp e instalar no celular pra testar.

### 2. Gerar o pacote para a Play Store (AAB)

```
cd C:\Users\usuario\FinancasPRO\android
gradlew.bat bundleRelease -Dorg.gradle.jvmargs="-Xmx4g"
```

Saída: `android\app\build\outputs\bundle\release\app-release.aab`
→ esse é o arquivo a subir no Play Console.

### 3. Antes de subir: conferir o versionCode

O `versionCode` em `android/app/build.gradle` é fixo (não incrementa sozinho no
build local). Antes de gerar o AAB pra produção, aumentar esse número e o
`versionName` (e também o `"version"` em `app.json`, pra manter os dois em sync),
senão o Play Console recusa com "O código de versão já foi usado".

### 4. Publicar

Play Console → Fala, Dinheiro! → Produção → Criar nova versão → Enviar →
selecionar o `.aab` acima → escrever notas da versão → Revisar → **Publicar**
(a Glaci sempre faz esse último clique, nunca o Claude).

#### Formato das notas da versão

O campo "Notas da versão" exige que o texto fique dentro de tags de idioma com
colchetes angulares (não colchetes retos):

```
<pt-BR>
Texto da novidade aqui.
</pt-BR>
```

Sem nada fora das tags, senão dá erro "há texto fora das tags de idioma".

## Não usar

```
eas build --platform android --profile production
```

Gera `.aab` assinado com a keystore errada (gerenciada pela Expo) — resulta em
erro de assinatura no upload do Play Console. Se um dia quiser voltar a usar o
EAS, primeiro é preciso configurar a keystore correta em `eas credentials`.

## Sobre o app

- Package: `com.tatriapps.faladinheiro`
- eas.json tem profiles `development`, `preview`, `production` — mas `production`
  não deve ser usado pra build (ver acima). `preview` também usa keystore da EAS,
  então também sofre do mesmo problema se algum dia for usado pra gerar algo que
  vá para a Play Store (tudo bem pra teste interno via link/QR da Expo, mas não
  pra WhatsApp/instalação direta assinada com a chave certa — para isso, usar
  sempre o Gradle local).
