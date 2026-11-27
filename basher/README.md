# basher.

App de encontros gay para iPhone: grade por distância, mapa com hotspots, modo **Agora**, feed, stories, álbuns privados com prazo, grupos e plano Pro com pagamento pela Apple.

React + Vite (empacotado para iOS com Capacitor) · Supabase · Render · domínio no registro.br.

---

## O que vem pronto

| Área | Recursos |
| --- | --- |
| Login | Apple e Google (Supabase Auth). Foto do Google/Apple **não** é importada (discrição). |
| Cadastro | 6 passos: nome + nascimento, vibe (posição, o que procura, onde), foto, interesses e tribos, localização, consentimentos LGPD + verificação de idade 18+. |
| Perto | Grade 3 colunas por distância, idade, posição, online, **% de vibe** (compatibilidade), stories no topo, filtros (Pro para avançados), Explorar cidades (Pro), puxar para atualizar, rolagem infinita. |
| Mapa | Setinhas por pessoa; quem está no mesmo lugar vira um grupo de setinhas com contador (ex.: 5 numa balada) e **hotspot** pulsante a partir de 3. Toque abre a lista. |
| Agora | Posts que somem em 60 min, com contagem regressiva, só para quem está a até 50 km. |
| Feed | Posts com foto, curtida (duplo toque), comentários. |
| Stories | 24 h, barra de progresso, responder vai para o chat. |
| Conversas | Mensagens em tempo real, "digitando…", fotos, localização aproximada, apagar para todos, respostas rápidas. Abas **Faíscas** e **Pedidos de álbum**. |
| Grupos | Sem limite de pessoas, código de convite, admins. Cada grupo custa **R$ 1,99** (grátis no Pro — configurável). |
| Álbuns privados | Pedido só por quem já conversou ou está a até 10 km. Envio com prazo (1 h, 24 h, 7 dias, sem prazo), revogação, **marca d'água com o nome de quem vê**. **20 envios/mês grátis**, **+10 por R$ 2,99**, ilimitado no Pro. |
| Pro | Perfis ilimitados, filtros avançados, explorar cidades, modo invisível, quem me viu, álbuns ilimitados, grupos grátis, brilho no card. |
| Segurança | Bloquear/denunciar (suspensão automática), **Encontro seguro** (cronômetro + mensagem pronta para contato de confiança), **PIN de bloqueio**, **modo discreto** (fotos desfocadas), localização nunca exata, EXIF removido das fotos. |
| Tela travada | Sem zoom, sem arrastar para os lados; só rolagem vertical e troca de aba. |
| Persistência | Sessão, perfil, filtros, rascunhos, última aba, caches da grade e das conversas no `localStorage`. |

## Estrutura

```
basher/
├── app/                 # React + Vite + Capacitor (iOS) — também roda como site/PWA
│   ├── src/api/         # supabaseApi.js (real) e mockApi.js (demo) com a mesma interface
│   ├── src/pages/       # telas
│   ├── src/components/  # UI
│   ├── src/services/    # compras Apple, idade, localização, notificações
│   ├── src/config/      # preços, IDs dos produtos, opções do perfil
│   └── public/legal/    # Termos e Privacidade (modelos)
├── server/              # Node/Express no Render: valida compras, webhooks da Apple, exclusão de conta
├── supabase/
│   ├── migrations/      # schema completo (tabelas, RLS, funções, storage, realtime)
│   └── tests/           # teste automático das regras (roda num Postgres local)
└── render.yaml          # Blueprint do Render (API + site)
```

---

## 1. Rodar no seu computador

```bash
cd app
npm install
npm run dev            # sem .env → modo demonstração com dados simulados
```

Abra `http://localhost:5173`. No modo demo tudo funciona sem backend (compras simuladas, respostas automáticas no chat).

Para usar o Supabase de verdade: copie `app/.env.example` para `app/.env` e preencha.

## 2. Supabase

1. Crie o projeto na região **South America (São Paulo)**.
2. **SQL Editor** → cole e rode `supabase/migrations/20261125000000_basher_schema.sql` inteiro.
3. **Database → Extensions**: ative `pg_cron` (limpeza diária). Se ativar depois, rode:
   `select cron.schedule('basher-cleanup', '17 4 * * *', 'select public.cleanup_expired()');`
4. **Authentication → URL Configuration**
   - Site URL: `https://basher.com.br`
   - Redirect URLs: `https://basher.com.br/auth/callback`, `basher://auth/callback`, `http://localhost:5173/auth/callback`
5. **Authentication → Providers**
   - **Google**: crie um OAuth Client (Web) no Google Cloud com o redirect `https://SEU-PROJETO.supabase.co/auth/v1/callback`; cole Client ID e Secret.
   - **Apple**: no Apple Developer crie um *Services ID* (ex.: `br.com.basher.web`), habilite *Sign in with Apple*, use o domínio do Supabase e o mesmo redirect acima; gere uma *Key* de Sign in with Apple e cole Team ID, Key ID, Services ID e a chave no Supabase.
6. **Project Settings → API**: copie `URL` e `anon key` para o app, e a `service_role` **só** para o servidor.

Limites e preços ficam na tabela `app_config` (ex.: `album_free_monthly`, `pro_includes_groups`, `free_grid_limit`). Mude por SQL, sem publicar app novo.

### Testar as regras do banco (opcional)

Com um Postgres 16 + PostGIS local:

```bash
psql -d teste -f supabase/tests/00_supabase_shim.sql
psql -d teste -f supabase/migrations/20261125000000_basher_schema.sql
psql -d teste -f supabase/tests/01_smoke_test.sql   # termina com "TODOS OS TESTES PASSARAM" e "GRANTS OK"
```

## 3. Render

1. Suba a pasta `basher/` para um repositório no GitHub.
2. Render → **New → Blueprint** → escolha o repositório. Ele cria:
   - `basher-api` (Node, plano Starter — o grátis "dorme" e atrasa os avisos da Apple)
   - `basher-web` (site estático com o mesmo app)
3. Preencha as variáveis marcadas como `sync: false`:
   - API: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APPLE_APP_ID` (número do app no App Store Connect)
   - Web: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
4. Em cada serviço → **Settings → Custom Domains**: `basher.com.br` e `www.basher.com.br` no web; `api.basher.com.br` na API.

## 4. registro.br (DNS)

No painel do domínio → **DNS → Editar zona** (usando os servidores DNS do próprio registro.br):

| Tipo | Nome | Valor |
| --- | --- | --- |
| A | (vazio / @) | `216.24.57.1` |
| CNAME | www | `basher-web.onrender.com` |
| CNAME | api | `basher-api.onrender.com` |

(Use os endereços `.onrender.com` exatos que o Render mostrar em cada serviço.) Apague registros AAAA antigos. Depois clique em **Verify** no Render; o certificado HTTPS sai sozinho.

## 5. iPhone (Capacitor)

Precisa de um Mac com Xcode.

```bash
cd app
cp .env.example .env          # preencha com os dados de produção
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

No Xcode, alvo **App**:

1. **Signing & Capabilities** → adicione **Sign in with Apple**, **In-App Purchase** e **Declared Age Range** (iOS 26.2+). Habilite as mesmas no App ID do Apple Developer.
2. **Info.plist** — adicione:
   - `NSLocationWhenInUseUsageDescription`: "Mostramos quem está perto. Sua posição exata nunca é salva."
   - `NSPhotoLibraryUsageDescription`: "Para escolher fotos do perfil, posts e álbuns."
   - `NSCameraUsageDescription`: "Para tirar fotos do perfil e dos posts."
   - **URL Types** → URL Schemes: `basher` (volta do login).
3. Ícone e splash: gere com `npx @capacitor/assets generate` a partir de `public/icon.svg`.

### Compras na App Store Connect

Crie os produtos com estes IDs (estão em `app/src/config/plans.js` e `server/src/config.js`):

| ID | Tipo | Preço sugerido |
| --- | --- | --- |
| `br.com.basher.app.pro.monthly` | Assinatura auto-renovável (grupo "Pro") | R$ 29,90/mês |
| `br.com.basher.app.pro.yearly` | Assinatura auto-renovável (grupo "Pro") | R$ 199,90/ano |
| `br.com.basher.app.albums10` | Consumível | R$ 2,99 |
| `br.com.basher.app.group` | Consumível | R$ 1,99 |

Em **App Information → App Store Server Notifications**, use a **versão 2** e a URL
`https://api.basher.com.br/iap/apple/notifications` (produção e sandbox).

Como funciona: o app compra pelo StoreKit 2 enviando o ID do usuário como `appAccountToken` → o servidor confere a assinatura da Apple no JWS → libera no Supabase → o app finaliza a transação. Renovações, expirações e reembolsos chegam pelo webhook. O mesmo `transactionId` nunca libera crédito duas vezes.

## 6. Pontos legais e da App Store

- **Idade (ECA Digital, Lei 15.211/2025, em vigor desde 17/03/2026)**: autodeclaração não vale. O app usa o sinal de faixa etária da Apple; classifique o app como **18+** na App Store (no Brasil a Apple confirma a maioridade no download). Em iPhones sem o recurso, o app aceita a classificação 18+ da loja como confirmação; para exigir mais, defina `VITE_AGE_STORE_FALLBACK=false` e conecte um provedor de verificação (selfie/documento) ao webhook `POST /age/webhook` do servidor (assinatura HMAC com `AGE_WEBHOOK_SECRET`). A ANPD define os métodos aceitos; acompanhe.
- **LGPD**: orientação sexual e saúde são dados sensíveis; o cadastro coleta consentimento específico. Exclusão de conta no app apaga tudo (exigência também da Apple).
- **App Store**: fotos públicas sem nudez (moderação + denúncia), bloquear/denunciar em todo perfil e conversa, compras digitais só pela Apple, Sign in with Apple junto com Google, link de Termos e Privacidade na tela do Pro.
- Os textos em `app/public/legal/` são **modelos**: revise com um advogado e complete razão social, CNPJ e encarregado (DPO).

## 7. Próximos passos sugeridos

- Notificações push (APNs) para mensagens e faíscas.
- Painel de moderação (tabela `reports` já existe) e filtro automático de nudez nas fotos públicas.
- Ícone alternativo discreto no iPhone.
