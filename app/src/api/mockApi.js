// Modo demonstração: mesma interface do supabaseApi, com dados simulados no localStorage.
// Regras iguais às do banco: 18+, cota de 20 álbuns/mês, grupos pagos, filtros Pro, bloqueios.
import { AppError } from '../lib/errors';
import { DEFAULT_COORDS } from '../lib/env';
import { compressImage, blobToDataUrl, uid } from '../lib/image';
import { portrait, scene } from './demoArt';
import { LIMITS, PRODUCTS } from '../config/plans';

const KEY = 'basher-demo-v1';
const ME = 'me';
const GRID = 0.002;
const wait = (ms = 160) => new Promise((r) => setTimeout(r, ms + Math.random() * 120));
const now = () => new Date().toISOString();
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const ahead = (min) => new Date(Date.now() + min * 60000).toISOString();
const snap = (v) => Math.round(v / GRID) * GRID;

function haversine(a, b) {
  if (!a || !b) return null;
  const R = 6371000;
  const toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round((2 * R * Math.asin(Math.sqrt(x))) / 10) * 10;
}
const ageOf = (bd) => {
  if (!bd) return null;
  const b = new Date(bd);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
};

// ------------------------------------------------------------------ seed
const NAMES = ['Caio', 'Theo', 'Rafa', 'Davi', 'Enzo', 'Lucas', 'Gui', 'Pedro', 'Matheus', 'Bruno', 'Igor', 'Léo',
  'Thiago', 'Vini', 'Dudu', 'João', 'Arthur', 'Felipe', 'Gabriel', 'Henrique', 'Kauã', 'Luan', 'Murilo', 'Nico',
  'Otávio', 'Paulo', 'Renan', 'Samuel', 'Tomás', 'Victor', 'Yuri', 'Breno', 'Diego', 'Fábio', 'Hugo', 'Ícaro',
  'Júlio', 'Ramon'];
const STATUS = ['Na Augusta até tarde 🌙', 'Só papo por enquanto', 'Tenho local, chama', 'Bora um café?', 'Viajando, conheço SP',
  'Pós-academia, sem paciência pra enrolação', '', 'Acabei de chegar no rolê', 'Procurando amizade e quem sabe mais', '',
  'Sem foto não respondo', 'Fim de semana livre ✨', ''];
const BIOS = ['Designer de dia, DJ amador de noite. Gosto de gente direta e bem-humorada.',
  'Paulistano, ama praia mais que tudo. Conversa boa ganha meu coração.',
  'Nerd assumido, viciado em café e em séries. Me chama pra maratona.',
  'Corro de manhã, danço de noite. Sem drama, por favor.',
  'Recém-chegado em SP, conhecendo a cidade e as pessoas.',
  'Fotógrafo, viajante, cozinho um risoto ótimo.',
  'Discreto, educado, curto conhecer com calma.',
  'Advogado de terno, arteiro de camiseta. 🎨'];
const POS = ['top', 'vers_top', 'versatile', 'vers_bottom', 'bottom', 'side'];
const LOOK = ['now', 'chat', 'date', 'friends', 'relationship', 'party', 'networking'];
const TRIBES = ['Urso', 'Lontra', 'Barbie', 'Twink', 'Daddy', 'Atleta', 'Rato de academia', 'Geek', 'Discreto', 'Maduro', 'Alternativo'];
const INTS = ['Academia', 'Praia', 'Eletrônica', 'Pop', 'Funk', 'Drag Race', 'Séries', 'Cinema', 'Games', 'Viagem', 'Café',
  'Vinho', 'Cerveja', 'Cozinhar', 'Pets', 'Arte', 'Moda', 'Livros', 'Corrida', 'Balada', 'Karaokê', 'Fotografia', 'Tecnologia'];
const BODY = ['Magro', 'Atlético', 'Médio', 'Musculoso', 'Forte', 'Gordinho'];

function seeded(i) {
  let s = i * 7919 + 13;
  return () => ((s = (s * 48271) % 2147483647) / 2147483647);
}
const some = (r, arr, n) => [...arr].sort(() => r() - 0.5).slice(0, n);

function seed() {
  const users = {};
  // aglomerados: 5 numa balada na Augusta, 3 num bar na Vila Madalena
  const spots = [
    { lat: -23.5520, lng: -46.6540, n: 5 },
    { lat: -23.5560, lng: -46.6900, n: 3 },
    { lat: -23.5612, lng: -46.6560, n: 2 },
  ];
  let k = 0;
  NAMES.forEach((name, i) => {
    const r = seeded(i + 1);
    let loc;
    const spot = spots.find((s) => s.n > 0);
    if (spot && i % 3 === 0) {
      spot.n--;
      loc = { lat: spot.lat, lng: spot.lng };
    } else {
      const ang = r() * Math.PI * 2;
      const dist = 0.002 + r() * 0.045;
      loc = { lat: DEFAULT_COORDS.lat + Math.sin(ang) * dist, lng: DEFAULT_COORDS.lng + Math.cos(ang) * dist * 1.1 };
    }
    const id = 'u' + (i + 1);
    const age = 19 + Math.floor(r() * 30);
    const y = new Date().getFullYear() - age;
    users[id] = {
      id,
      display_name: name,
      bio: BIOS[i % BIOS.length],
      status_text: STATUS[i % STATUS.length],
      sex_position: POS[Math.floor(r() * POS.length)],
      height_cm: 165 + Math.floor(r() * 30),
      weight_kg: 60 + Math.floor(r() * 40),
      body_type: BODY[Math.floor(r() * BODY.length)],
      relationship: r() < 0.7 ? 'Solteiro' : 'Relação aberta',
      pronouns: 'ele/dele',
      tribes: some(r, TRIBES, 1 + Math.floor(r() * 2)),
      looking_for: some(r, LOOK, 1 + Math.floor(r() * 3)),
      interests: some(r, INTS, 3 + Math.floor(r() * 5)),
      meet_at: some(r, ['host', 'travel', 'public', 'hotel', 'coffee'], 1 + Math.floor(r() * 2)),
      avatar_url: i % 11 === 10 ? null : portrait(i + 1),
      onboarded: true,
      last_active: ago(i % 4 === 0 ? 2 + i : i * 9 + 3),
      private: {
        birthdate: `${y}-0${1 + (i % 9)}-1${i % 9}`,
        hide_distance: i === 7,
        hide_age: false,
        incognito: false,
        on_prep: r() < 0.5,
        last_tested: '2026-09-01',
        show_health: r() < 0.4,
      },
      loc: { lat: snap(loc.lat), lng: snap(loc.lng) },
      photos: [portrait(i + 1), scene(i + 40), portrait(i + 200)].map((url, j) => ({ id: `${id}p${j}`, url })),
      is_pro: i % 6 === 0,
    };
    k++;
  });

  const db = {
    session: null,
    users,
    ent: { pro_until: null, album_credits: 0, group_credits: 0 },
    albums: [{ id: 'a-caio', owner_id: 'u1', title: 'Depois das 2h', created_at: ago(5000) },
      { id: 'a-theo', owner_id: 'u2', title: 'Viagem', created_at: ago(9000) }],
    albumItems: [0, 1, 2, 3].map((n) => ({ id: 'ai' + n, album_id: 'a-caio', url: scene(300 + n), media_type: 'image', created_at: ago(4000 - n) }))
      .concat([0, 1].map((n) => ({ id: 'bi' + n, album_id: 'a-theo', url: scene(400 + n), media_type: 'image', created_at: ago(8000) }))),
    shares: [{ id: 'sh1', album_id: 'a-caio', owner_id: 'u1', recipient_id: ME, created_at: ago(30), expires_at: ahead(60 * 20), revoked_at: null }],
    requests: [{ id: 'rq1', requester_id: 'u4', owner_id: ME, status: 'pending', created_at: ago(12) }],
    convs: [],
    messages: [],
    reads: {},
    taps: [
      { from_id: 'u5', to_id: ME, kind: 'fire', created_at: ago(4), seen: false },
      { from_id: 'u9', to_id: ME, kind: 'wave', created_at: ago(40), seen: false },
      { from_id: 'u13', to_id: ME, kind: 'wink', created_at: ago(300), seen: true },
    ],
    views: ['u3', 'u5', 'u8', 'u10', 'u14', 'u20', 'u22'].map((v, i) => ({ viewer_id: v, viewed_id: ME, viewed_at: ago(i * 37 + 3) })),
    posts: [],
    likes: [],
    comments: [],
    stories: [],
    storyViews: [],
    blocks: [],
    reports: [],
  };

  const conv = (id, a, b, msgs) => {
    db.convs.push({ id, is_group: false, member_ids: [a, b], roles: {}, created_at: ago(400), last_message_at: ago(1), last_message_preview: '' });
    msgs.forEach(([from, body, min, kind = 'text', meta = {}]) => {
      db.messages.push({ id: uid(), conversation_id: id, sender_id: from, kind, body, meta, created_at: ago(min) });
    });
    const last = db.messages.filter((m) => m.conversation_id === id).at(-1);
    const c = db.convs.find((x) => x.id === id);
    c.last_message_at = last.created_at;
    c.last_message_preview = preview(last);
  };
  // mais gente com álbum privado, para dar para pedir acesso no demo
  ['u3', 'u5', 'u6', 'u9', 'u12', 'u15', 'u18'].forEach((owner, n) => {
    db.albums.push({ id: 'a-' + owner, owner_id: owner, title: ['Praia', 'Só pra você', 'Noite', 'Academia', 'Viagem', 'Fim de semana', 'Sem filtro'][n], created_at: ago(3000 + n) });
    [0, 1, 2].forEach((j) => db.albumItems.push({ id: `ai-${owner}-${j}`, album_id: 'a-' + owner, url: scene(600 + n * 3 + j), media_type: 'image', created_at: ago(2900) }));
  });

  conv('c-caio', 'u1', ME, [
    ['u1', 'Oi! Vi que você tá aqui perto 👀', 48],
    [ME, 'Oi! Tô sim, na Frei Caneca', 46],
    ['u1', 'Te mandei meu álbum, abre lá 😏', 30],
    ['u1', 'Depois das 2h', 30, 'album', { album_id: 'a-caio', share_id: 'sh1', expires_at: ahead(60 * 20) }],
  ]);
  conv('c-theo', 'u2', ME, [
    ['u2', 'E aí, bora um café amanhã?', 180],
    [ME, 'Bora! Onde?', 170],
    ['u2', 'Tem um lugar ótimo na Consolação ☕', 165],
  ]);
  conv('c-davi', 'u4', ME, [['u4', 'Pediu para ver seus álbuns', 12, 'album_request', { request_id: 'rq1' }]]);
  db.reads['c-theo'] = ago(1);

  db.convs.push({ id: 'g-augusta', is_group: true, title: 'Rolê Augusta sexta', description: 'Quem vai? Encontro 23h', member_ids: [ME, 'u1', 'u3', 'u6', 'u7', 'u12', 'u15'], roles: { u3: 'owner' }, invite_code: 'augusta23', created_at: ago(2000), last_message_at: ago(8), last_message_preview: '' });
  [['u3', 'Grupo criado', 2000, 'system'], ['u6', 'Alguém já tá lá?', 20], ['u12', 'Chegando em 15 min 🚕', 8]].forEach(([from, body, min, kind = 'text']) =>
    db.messages.push({ id: uid(), conversation_id: 'g-augusta', sender_id: from, kind, body, meta: {}, created_at: ago(min) }));
  db.convs.find((c) => c.id === 'g-augusta').last_message_preview = 'Chegando em 15 min 🚕';

  // Agora (expira em 60 min) e Feed
  [['u6', 'Na balada da Augusta, quem cola? 🪩', 6], ['u1', 'Tenho local aqui na Bela Vista, chama no chat', 14],
    ['u11', 'Alguém pra um drink agora na Paulista?', 25], ['u17', 'Saindo da academia, bora um açaí?', 33],
    ['u9', 'Cheguei hoje em SP, quero conhecer a noite', 48]].forEach(([a, body, min], i) =>
    db.posts.push({ id: 'n' + i, author_id: a, kind: 'now', body, media_url: i === 0 ? scene(77) : null, created_at: ago(min), expires_at: ahead(60 - min) }));
  [['u2', 'Domingo de sol no Ibirapuera ☀️', 300, scene(11)], ['u5', 'Nova tattoo, o que acharam?', 900, scene(12)],
    ['u14', 'Pôr do sol de hoje direto do terraço', 1500, scene(13)], ['u8', 'Playlist da festa de sábado tá no meu perfil 🎧', 2600, null],
    ['u20', 'Primeira vez na Parada, que energia!', 4000, scene(14)]].forEach(([a, body, min, img], i) =>
    db.posts.push({ id: 'f' + i, author_id: a, kind: 'feed', body, media_url: img, created_at: ago(min), expires_at: null }));
  db.likes.push({ post_id: 'f0', user_id: 'u3' }, { post_id: 'f0', user_id: 'u7' }, { post_id: 'f1', user_id: 'u2' });
  db.comments.push({ id: 'cm1', post_id: 'f0', author_id: 'u7', body: 'Que dia lindo!', created_at: ago(200) });

  ['u1', 'u5', 'u6', 'u10', 'u12', 'u3'].forEach((a, i) =>
    [0, 1].slice(0, 1 + (i % 2)).forEach((j) =>
      db.stories.push({ id: `st${i}${j}`, author_id: a, media_url: scene(500 + i * 3 + j, { w: 540, h: 960 }), caption: j ? '' : ['Esquenta 🔥', 'Hoje tem!', 'Vista daqui', 'Café da manhã', 'Look da noite', 'Pré-rolê'][i], created_at: ago(30 + i * 40 + j), expires_at: ahead(24 * 60 - 30 - i * 40) })));
  return db;
}

function preview(m) {
  return ({ image: '📷 Foto', album: '🔒 Álbum compartilhado', album_request: '🔑 Pedido de álbum', location: '📍 Localização', tap: '⚡ Faísca', safe_date: '🛡️ Encontro seguro' }[m.kind] || m.body || '').slice(0, 120);
}

// ------------------------------------------------------------------ persistência
let db;
function load() {
  if (db) return db;
  try {
    db = JSON.parse(localStorage.getItem(KEY));
  } catch {
    db = null;
  }
  if (!db?.users) db = seed();
  return db;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* sem espaço: fica só em memória nesta sessão */
  }
}
const mut = (fn) => {
  load();
  const r = fn(db);
  save();
  return r;
};

// ------------------------------------------------------------------ eventos "realtime"
const convListeners = new Map();
const inboxListeners = new Set();
function emit(convId, evt) {
  (convListeners.get(convId) || []).forEach((l) => l(evt));
  inboxListeners.forEach((l) => l({ type: 'message', row: evt.message }));
}

// ------------------------------------------------------------------ helpers de leitura
const me = () => load().users[ME];
const isPro = () => !!(load().ent.pro_until && new Date(load().ent.pro_until) > new Date());
const blockedPair = (a, b) => load().blocks.some((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
const online = (u) => Date.now() - new Date(u.last_active).getTime() < 10 * 60000;
const activeShare = (s) => !s.revoked_at && (!s.expires_at || new Date(s.expires_at) > new Date());
const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};
function visibleUser(id) {
  const u = load().users[id];
  return u && u.onboarded && !u.suspended && !blockedPair(ME, id) ? u : null;
}
function summary(u, origin) {
  return {
    id: u.id,
    display_name: u.display_name,
    age: u.private.hide_age ? null : ageOf(u.private.birthdate),
    sex_position: u.sex_position,
    avatar_url: u.avatar_url,
    status_text: u.status_text,
    tribes: u.tribes,
    looking_for: u.looking_for,
    interests: u.interests,
    distance_m: u.private.hide_distance ? null : haversine(origin, u.loc),
    approx_lat: u.private.hide_distance ? null : u.loc?.lat,
    approx_lng: u.private.hide_distance ? null : u.loc?.lng,
    online: online(u),
    last_active: u.last_active,
    is_pro: !!u.is_pro,
    has_story: load().stories.some((s) => s.author_id === u.id && new Date(s.expires_at) > new Date()),
  };
}
function status() {
  const d = load();
  const used = d.shares.filter((s) => s.owner_id === ME && s.created_at >= monthStart()).length;
  return {
    is_pro: isPro(),
    pro_until: d.ent.pro_until,
    album_free_limit: LIMITS.albumFreeMonthly,
    album_used: used,
    album_credits: d.ent.album_credits,
    group_credits: d.ent.group_credits,
    pro_includes_groups: true,
    age_verified: !!me()?.private?.age_verified_at,
    onboarded: !!me()?.onboarded,
    suspended: false,
  };
}
function directKey(a, b) {
  return [a, b].sort().join(':');
}
function findDirect(other) {
  return load().convs.find((c) => !c.is_group && directKey(...c.member_ids) === directKey(ME, other));
}
function pushMessage(convId, sender, kind, body, meta = {}) {
  const m = { id: uid(), conversation_id: convId, sender_id: sender, kind, body, meta, created_at: now(), deleted_at: null };
  mut((d) => {
    d.messages.push(m);
    const c = d.convs.find((x) => x.id === convId);
    c.last_message_at = m.created_at;
    c.last_message_preview = preview(m);
    if (sender === ME) d.reads[convId] = m.created_at;
  });
  setTimeout(() => emit(convId, { type: 'message', message: m }), 0);
  return m;
}
function ensureDirect(other) {
  let c = findDirect(other);
  if (!c) {
    c = { id: 'c-' + uid().slice(0, 8), is_group: false, member_ids: [ME, other], roles: {}, created_at: now(), last_message_at: now(), last_message_preview: '' };
    mut((d) => d.convs.push(c));
  }
  return c.id;
}
async function toDataUrl(file, max = 900) {
  const blob = file.type?.startsWith('image/') ? await compressImage(file, { max, quality: 0.8 }) : file;
  return blobToDataUrl(blob);
}

// respostas automáticas para dar vida ao demo
const REPLIES = ['Haha adorei 😄', 'Tô por aqui sim', 'Que bom que você chamou!', 'Bora! Que horas?', 'Me conta mais de você',
  'Tenho local aqui perto, se quiser', 'Manda uma foto sua? 📸', 'Tô saindo da academia agora', 'Hoje à noite tô livre ✨', 'Onde você tá exatamente?'];
function scheduleReply(convId) {
  const c = load().convs.find((x) => x.id === convId);
  if (!c || c.is_group) return;
  const other = c.member_ids.find((x) => x !== ME);
  if (blockedPair(ME, other)) return;
  setTimeout(() => (convListeners.get(convId) || []).forEach((l) => l({ type: 'typing', payload: { user_id: other, typing: true } })), 1200);
  setTimeout(() => {
    (convListeners.get(convId) || []).forEach((l) => l({ type: 'typing', payload: { user_id: other, typing: false } }));
    pushMessage(convId, other, 'text', REPLIES[Math.floor(Math.random() * REPLIES.length)]);
    mut((d) => (d.users[other].last_active = now()));
  }, 3400 + Math.random() * 2000);
}

// ===================================================================
export const api = {
  demo: true,

  auth: {
    async getSession() {
      return load().session;
    },
    onChange(cb) {
      const h = () => cb(load().session);
      window.addEventListener('basher-demo-auth', h);
      return () => window.removeEventListener('basher-demo-auth', h);
    },
    async signIn(provider) {
      await wait(500);
      mut((d) => {
        d.session = { user: { id: ME, email: provider === 'apple' ? 'privado@privaterelay.appleid.com' : 'voce@gmail.com', app_metadata: { provider } } };
        if (!d.users[ME]) {
          d.users[ME] = {
            id: ME, display_name: '', bio: '', status_text: '', sex_position: null, height_cm: null, weight_kg: null,
            body_type: null, relationship: null, pronouns: null, tribes: [], looking_for: [], interests: [], meet_at: [],
            avatar_url: null, onboarded: false, last_active: now(),
            private: { birthdate: null, age_verified_at: null, incognito: false, hide_distance: false, hide_age: false, on_prep: null, last_tested: null, show_health: false, accepted_terms_at: null, sensitive_consent_at: null },
            loc: { lat: snap(DEFAULT_COORDS.lat), lng: snap(DEFAULT_COORDS.lng) },
            photos: [], is_pro: false,
          };
          // um álbum de exemplo para testar o envio
          if (!d.albums.some((a) => a.owner_id === ME)) {
            d.albums.push({ id: 'a-me', owner_id: ME, title: 'Noite', created_at: now() });
            [0, 1, 2].forEach((j) => d.albumItems.push({ id: 'ai-me-' + j, album_id: 'a-me', url: scene(900 + j), media_type: 'image', created_at: now() }));
          }
        }
      });
      window.dispatchEvent(new Event('basher-demo-auth'));
    },
    async handleDeepLink() {
      return false;
    },
    async signOut() {
      mut((d) => (d.session = null));
      window.dispatchEvent(new Event('basher-demo-auth'));
    },
    async deleteAccount() {
      try { localStorage.removeItem(KEY); } catch { /* noop */ }
      db = null;
      window.dispatchEvent(new Event('basher-demo-auth'));
    },
  },

  async getMe() {
    await wait(120);
    const u = me();
    if (!u) throw new AppError('AUTH_REQUIRED');
    const { private: priv, photos, loc, is_pro, ...profile } = u;
    return { id: ME, email: load().session?.user?.email, provider: load().session?.user?.app_metadata?.provider, profile, private: priv, photos, status: status() };
  },
  async myStatus() {
    return status();
  },
  async updateProfile(patch) {
    await wait();
    mut((d) => Object.assign(d.users[ME], patch));
    const { private: _p, photos: _ph, loc: _l, ...profile } = me();
    return profile;
  },
  async updatePrivate(patch) {
    await wait();
    if (patch.birthdate && ageOf(patch.birthdate) < 18) throw new AppError('UNDERAGE');
    if (patch.incognito && !isPro()) throw new AppError('PRO_REQUIRED');
    mut((d) => Object.assign(d.users[ME].private, patch));
    return me().private;
  },
  async recordAgeSignal(lower, source) {
    await wait(300);
    if (lower < 18) throw new AppError('UNDERAGE');
    mut((d) => Object.assign(d.users[ME].private, { age_verified_at: now(), age_verification_method: source }));
    return { verified: true };
  },
  async completeOnboarding() {
    await wait(300);
    const u = me();
    if (!u.display_name.trim()) throw new AppError('NAME_REQUIRED');
    if (!u.private.birthdate) throw new AppError('BIRTHDATE_REQUIRED');
    if (ageOf(u.private.birthdate) < 18) throw new AppError('UNDERAGE');
    if (!u.private.accepted_terms_at || !u.private.sensitive_consent_at) throw new AppError('CONSENT_REQUIRED');
    if (!u.private.age_verified_at) throw new AppError('AGE_VERIFICATION_REQUIRED');
    mut((d) => (d.users[ME].onboarded = true));
    // alguém por perto puxa assunto pouco depois
    setTimeout(() => {
      const c = ensureDirect('u6');
      pushMessage(c, 'u6', 'text', 'Oi! Apareceu aqui que você tá pertinho 👀');
    }, 18000);
    return { onboarded: true };
  },
  async updateLocation(lat, lng) {
    mut((d) => {
      d.users[ME].loc = { lat: snap(lat), lng: snap(lng) };
      d.users[ME].last_active = now();
    });
  },

  async uploadPhoto(file, sort = 0) {
    if (me().photos.length >= 6) throw new AppError('PHOTO_LIMIT');
    const url = await toDataUrl(file, 720);
    const p = { id: uid(), url, path: 'demo', sort };
    mut((d) => d.users[ME].photos.push(p));
    return p;
  },
  async deletePhoto(photo) {
    mut((d) => (d.users[ME].photos = d.users[ME].photos.filter((p) => p.id !== photo.id)));
  },
  async reorderPhotos(photos) {
    mut((d) => (d.users[ME].photos = photos.map((p, i) => ({ ...p, sort: i }))));
  },

  async nearby({ filters = {}, offset = 0, limit = 60, explore = null } = {}) {
    await wait(220);
    const pro = isPro();
    if (explore && !pro) throw new AppError('PRO_REQUIRED');
    const origin = explore ? { lat: explore.lat, lng: explore.lng } : me().loc;
    const f = { ...filters };
    if (!pro) Object.assign(f, { positions: [], tribes: [], looking_for: [] });
    let rows = Object.values(load().users)
      .filter((u) => u.id !== ME && visibleUser(u.id) && !u.private.incognito)
      .map((u) => {
        // em "Explorar" a demo desloca os perfis para a cidade escolhida
        const shifted = explore ? { ...u, loc: { lat: u.loc.lat - DEFAULT_COORDS.lat + explore.lat, lng: u.loc.lng - DEFAULT_COORDS.lng + explore.lng } } : u;
        return summary(shifted, origin);
      })
      .filter((s) => (!f.online_only || s.online) && (!f.with_photo || s.avatar_url))
      .filter((s) => s.age == null || (s.age >= (f.age_min || 18) && s.age <= (f.age_max || 99)))
      .filter((s) => !f.positions?.length || f.positions.includes(s.sex_position))
      .filter((s) => !f.tribes?.length || s.tribes.some((t) => f.tribes.includes(t)))
      .filter((s) => !f.looking_for?.length || s.looking_for.some((t) => f.looking_for.includes(t)))
      .filter((s) => !f.max_km || s.distance_m == null || s.distance_m <= f.max_km * 1000)
      .sort((a, b) => (a.distance_m ?? 9e9) - (b.distance_m ?? 9e9));
    const max = pro ? rows.length : Math.min(rows.length, LIMITS.freeGridLimit);
    return rows.slice(offset, Math.min(offset + limit, max));
  },
  async getProfile(id) {
    await wait(140);
    if (id === ME) {
      const u = me();
      return { ...summary(u, u.loc), ...u, photos: u.photos, age: ageOf(u.private.birthdate), health: u.private.show_health ? { on_prep: u.private.on_prep, last_tested: u.private.last_tested } : null, albums_count: load().albums.filter((a) => a.owner_id === ME).length, shared_albums: [], is_pro: isPro() };
    }
    const u = visibleUser(id);
    if (!u) throw new AppError('NOT_FOUND');
    const d = load();
    const conv = findDirect(id);
    const talked = conv && d.messages.some((m) => m.conversation_id === conv.id);
    const near = haversine(me().loc, u.loc) <= 10000;
    const hasAlbums = d.albums.some((a) => a.owner_id === id);
    if (!me().private.incognito) {
      mut((dd) => {
        dd.views = dd.views.filter((v) => !(v.viewer_id === ME && v.viewed_id === id));
        dd.views.push({ viewer_id: ME, viewed_id: id, viewed_at: now() });
      });
    }
    return {
      ...summary(u, me().loc),
      bio: u.bio, height_cm: u.height_cm, weight_kg: u.weight_kg, body_type: u.body_type, relationship: u.relationship,
      pronouns: u.pronouns, meet_at: u.meet_at,
      health: u.private.show_health ? { on_prep: u.private.on_prep, last_tested: u.private.last_tested } : null,
      photos: u.photos,
      albums_count: d.albums.filter((a) => a.owner_id === id).length,
      shared_albums: d.shares.filter((s) => s.owner_id === id && s.recipient_id === ME && activeShare(s))
        .map((s) => ({ album_id: s.album_id, title: d.albums.find((a) => a.id === s.album_id)?.title, share_id: s.id, expires_at: s.expires_at })),
      pending_request: d.requests.some((q) => q.requester_id === ME && q.owner_id === id && q.status === 'pending'),
      can_request_album: hasAlbums && (talked || near),
      tapped_at: d.taps.find((t) => t.from_id === ME && t.to_id === id)?.created_at || null,
      blocked_by_me: false,
    };
  },
  async myViewers() {
    await wait();
    const d = load();
    const views = d.views.filter((v) => v.viewed_id === ME && visibleUser(v.viewer_id)).sort((a, b) => b.viewed_at.localeCompare(a.viewed_at));
    if (!isPro()) return { locked: true, count: views.length, viewers: views.map((v) => ({ id: null, avatar_url: d.users[v.viewer_id].avatar_url, viewed_at: v.viewed_at })) };
    return { locked: false, count: views.length, viewers: views.map((v) => ({ id: v.viewer_id, display_name: d.users[v.viewer_id].display_name, avatar_url: d.users[v.viewer_id].avatar_url, viewed_at: v.viewed_at })) };
  },
  async sendTap(to, kind) {
    await wait();
    if (blockedPair(ME, to)) throw new AppError('BLOCKED');
    mut((d) => {
      d.taps = d.taps.filter((t) => !(t.from_id === ME && t.to_id === to));
      d.taps.push({ from_id: ME, to_id: to, kind, created_at: now(), seen: false });
    });
    // às vezes a faísca é retribuída
    if (Math.random() < 0.6) {
      setTimeout(() => {
        mut((d) => {
          d.taps = d.taps.filter((t) => !(t.from_id === to && t.to_id === ME));
          d.taps.push({ from_id: to, to_id: ME, kind: 'fire', created_at: now(), seen: false });
        });
        inboxListeners.forEach((l) => l({ type: 'tap', row: { from_id: to, to_id: ME } }));
      }, 6000);
    }
  },
  async myTaps() {
    await wait();
    const d = load();
    return d.taps.filter((t) => t.to_id === ME && visibleUser(t.from_id)).sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((t) => ({ from_id: t.from_id, display_name: d.users[t.from_id].display_name, avatar_url: d.users[t.from_id].avatar_url, kind: t.kind, created_at: t.created_at, seen: t.seen }));
  },
  async markTapsSeen() {
    mut((d) => d.taps.forEach((t) => t.to_id === ME && (t.seen = true)));
  },

  // ---------------- Álbuns ----------------
  async myAlbums() {
    await wait();
    const d = load();
    return d.albums.filter((a) => a.owner_id === ME).map((a) => {
      const items = d.albumItems.filter((i) => i.album_id === a.id);
      return { id: a.id, title: a.title, created_at: a.created_at, count: items.length, cover: items[0]?.url || null };
    });
  },
  async createAlbum(title) {
    await wait();
    const a = { id: 'a-' + uid().slice(0, 8), owner_id: ME, title, created_at: now() };
    mut((d) => d.albums.push(a));
    return a;
  },
  async renameAlbum(albumId, title) {
    mut((d) => (d.albums.find((a) => a.id === albumId && a.owner_id === ME).title = title));
  },
  async deleteAlbum(albumId) {
    mut((d) => {
      d.albums = d.albums.filter((a) => !(a.id === albumId && a.owner_id === ME));
      d.albumItems = d.albumItems.filter((i) => i.album_id !== albumId);
      d.shares = d.shares.filter((s) => s.album_id !== albumId);
    });
  },
  async albumMeta(albumId) {
    const a = load().albums.find((x) => x.id === albumId);
    if (!a) throw new AppError('NOT_FOUND');
    return { id: a.id, title: a.title, owner_id: a.owner_id };
  },
  async albumItems(albumId) {
    await wait();
    const d = load();
    const a = d.albums.find((x) => x.id === albumId);
    if (!a) throw new AppError('NOT_FOUND');
    const allowed = a.owner_id === ME || d.shares.some((s) => s.album_id === albumId && s.recipient_id === ME && activeShare(s) && !blockedPair(ME, a.owner_id));
    if (!allowed) throw new AppError('FORBIDDEN');
    return d.albumItems.filter((i) => i.album_id === albumId);
  },
  async addAlbumItem(albumId, file) {
    const url = await toDataUrl(file, 900);
    const it = { id: uid(), album_id: albumId, url, media_type: 'image', created_at: now() };
    mut((d) => d.albumItems.push(it));
    return it;
  },
  async deleteAlbumItem(item) {
    mut((d) => (d.albumItems = d.albumItems.filter((i) => i.id !== item.id)));
  },
  async albumShares(albumId) {
    await wait();
    const d = load();
    return d.shares.filter((s) => s.album_id === albumId && s.owner_id === ME && activeShare(s))
      .map((s) => ({ id: s.id, created_at: s.created_at, expires_at: s.expires_at, recipient: { id: s.recipient_id, display_name: d.users[s.recipient_id]?.display_name, avatar_url: d.users[s.recipient_id]?.avatar_url } }));
  },
  async shareAlbum(albumId, to, hours) {
    await wait(260);
    const d = load();
    const a = d.albums.find((x) => x.id === albumId && x.owner_id === ME);
    if (!a) throw new AppError('NOT_FOUND');
    if (blockedPair(ME, to)) throw new AppError('BLOCKED');
    const exp = hours ? ahead(hours * 60) : null;
    let share = d.shares.find((s) => s.album_id === albumId && s.recipient_id === to && activeShare(s));
    if (!share) {
      if (!isPro() && status().album_used >= LIMITS.albumFreeMonthly) {
        if (d.ent.album_credits <= 0) throw new AppError('ALBUM_QUOTA_EXCEEDED');
        mut((dd) => dd.ent.album_credits--);
      }
      share = { id: 'sh-' + uid().slice(0, 8), album_id: albumId, owner_id: ME, recipient_id: to, created_at: now(), expires_at: exp, revoked_at: null };
      mut((dd) => dd.shares.push(share));
    } else {
      mut(() => (share.expires_at = exp));
    }
    const conv = ensureDirect(to);
    pushMessage(conv, ME, 'album', a.title, { album_id: albumId, share_id: share.id, expires_at: exp });
    mut((dd) => dd.requests.forEach((q) => q.requester_id === to && q.owner_id === ME && q.status === 'pending' && (q.status = 'accepted')));
    return share.id;
  },
  async revokeShare(shareId) {
    mut((d) => {
      const s = d.shares.find((x) => x.id === shareId && x.owner_id === ME);
      if (s) s.revoked_at = now();
    });
  },
  async requestAlbum(owner) {
    await wait();
    const p = await api.getProfile(owner);
    if (!p.can_request_album) throw new AppError('ALBUM_REQUEST_NOT_ALLOWED');
    const d = load();
    let q = d.requests.find((x) => x.requester_id === ME && x.owner_id === owner && x.status === 'pending');
    if (q) return q.id;
    q = { id: 'rq-' + uid().slice(0, 8), requester_id: ME, owner_id: owner, status: 'pending', created_at: now() };
    mut((dd) => dd.requests.push(q));
    const conv = ensureDirect(owner);
    pushMessage(conv, ME, 'album_request', 'Pediu para ver seus álbuns', { request_id: q.id });
    // no demo, o outro aceita depois de alguns segundos
    const album = d.albums.find((a) => a.owner_id === owner);
    setTimeout(() => {
      const share = { id: 'sh-' + uid().slice(0, 8), album_id: album.id, owner_id: owner, recipient_id: ME, created_at: now(), expires_at: ahead(24 * 60), revoked_at: null };
      mut((dd) => {
        dd.shares.push(share);
        dd.requests.find((x) => x.id === q.id).status = 'accepted';
      });
      pushMessage(conv, owner, 'album', album.title, { album_id: album.id, share_id: share.id, expires_at: share.expires_at });
    }, 7000);
    return q.id;
  },
  async myAlbumRequests() {
    const d = load();
    return d.requests.filter((q) => q.owner_id === ME && q.status === 'pending' && visibleUser(q.requester_id))
      .map((q) => ({ id: q.id, requester_id: q.requester_id, display_name: d.users[q.requester_id].display_name, avatar_url: d.users[q.requester_id].avatar_url, created_at: q.created_at }));
  },
  async declineAlbumRequest(id) {
    mut((d) => {
      const q = d.requests.find((x) => x.id === id && x.owner_id === ME);
      if (q) q.status = 'declined';
    });
  },

  // ---------------- Conversas ----------------
  async conversations() {
    await wait(140);
    const d = load();
    return d.convs
      .filter((c) => c.member_ids.includes(ME))
      .map((c) => {
        const other = c.is_group ? null : c.member_ids.find((x) => x !== ME);
        const ou = other ? d.users[other] : null;
        const read = d.reads[c.id] || '0';
        return {
          id: c.id,
          is_group: c.is_group,
          title: c.is_group ? c.title : ou?.display_name,
          avatar_url: c.is_group ? c.avatar_url || null : ou?.avatar_url,
          other_id: other,
          other_online: ou ? online(ou) : false,
          last_message_at: c.last_message_at,
          last_message_preview: c.last_message_preview,
          unread: d.messages.filter((m) => m.conversation_id === c.id && m.sender_id !== ME && m.created_at > read).length,
          member_count: c.member_ids.length,
          muted: !!c.muted,
        };
      })
      .filter((c) => c.is_group || (c.last_message_preview && !blockedPair(ME, c.other_id)))
      .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
  },
  async openDirect(userId) {
    await wait();
    if (blockedPair(ME, userId)) throw new AppError('BLOCKED');
    return ensureDirect(userId);
  },
  async conversation(convId) {
    await wait(100);
    const d = load();
    const c = d.convs.find((x) => x.id === convId && x.member_ids.includes(ME));
    if (!c) throw new AppError('NOT_FOUND');
    const members = c.member_ids.map((id) => {
      const u = id === ME ? me() : d.users[id];
      return { role: c.roles?.[id] || (id === c.owner_id ? 'owner' : 'member'), user_id: id, profile: { id, display_name: u?.display_name, avatar_url: u?.avatar_url, last_active: u?.last_active } };
    });
    const other = c.is_group ? null : members.find((m) => m.user_id !== ME)?.profile;
    return { ...c, members, other, myRole: c.roles?.[ME] || (c.owner_id === ME ? 'owner' : 'member') };
  },
  async messages(convId) {
    await wait(120);
    return load().messages.filter((m) => m.conversation_id === convId).sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-200);
  },
  async send(convId, { kind = 'text', body = '', meta = {} }) {
    await wait(80);
    const c = load().convs.find((x) => x.id === convId);
    const other = c && !c.is_group ? c.member_ids.find((x) => x !== ME) : null;
    if (other && blockedPair(ME, other)) throw new AppError('BLOCKED');
    const m = pushMessage(convId, ME, kind, body, meta);
    if (kind === 'text' || kind === 'image') scheduleReply(convId);
    return m;
  },
  async sendImage(convId, file) {
    const url = await toDataUrl(file, 900);
    return api.send(convId, { kind: 'image', meta: { url } });
  },
  async unsend(id) {
    mut((d) => {
      const m = d.messages.find((x) => x.id === id && x.sender_id === ME);
      if (m) Object.assign(m, { deleted_at: now(), body: '', meta: {} });
    });
    const m = load().messages.find((x) => x.id === id);
    (convListeners.get(m?.conversation_id) || []).forEach((l) => l({ type: 'update', message: m }));
  },
  async markRead(convId) {
    mut((d) => (d.reads[convId] = now()));
  },
  subscribeConversation(convId, { onMessage, onUpdate, onTyping }) {
    const l = (e) => {
      if (e.type === 'message') onMessage?.(e.message);
      if (e.type === 'update') onUpdate?.(e.message);
      if (e.type === 'typing') onTyping?.(e.payload);
    };
    convListeners.set(convId, [...(convListeners.get(convId) || []), l]);
    return {
      typing: () => {},
      close: () => convListeners.set(convId, (convListeners.get(convId) || []).filter((x) => x !== l)),
    };
  },
  subscribeInbox(cb) {
    inboxListeners.add(cb);
    return () => inboxListeners.delete(cb);
  },
  async createGroup(title, memberIds, description) {
    await wait(260);
    if (!title?.trim()) throw new AppError('TITLE_REQUIRED');
    if (!isPro()) {
      if (load().ent.group_credits <= 0) throw new AppError('GROUP_CREDIT_REQUIRED');
      mut((d) => d.ent.group_credits--);
    }
    const id = 'g-' + uid().slice(0, 8);
    mut((d) => d.convs.push({ id, is_group: true, title: title.trim(), description, member_ids: [ME, ...memberIds.filter((x) => !blockedPair(ME, x))], roles: { [ME]: 'owner' }, owner_id: ME, invite_code: uid().slice(0, 8), created_at: now(), last_message_at: now(), last_message_preview: '' }));
    pushMessage(id, ME, 'system', 'Grupo criado');
    return id;
  },
  async addGroupMembers(convId, ids) {
    mut((d) => {
      const c = d.convs.find((x) => x.id === convId);
      c.member_ids = [...new Set([...c.member_ids, ...ids])];
    });
    return ids.length;
  },
  async removeGroupMember(convId, userId) {
    mut((d) => {
      const c = d.convs.find((x) => x.id === convId);
      c.member_ids = c.member_ids.filter((x) => x !== userId);
    });
  },
  async joinGroup(code) {
    await wait();
    const c = load().convs.find((x) => x.is_group && x.invite_code === code.trim());
    if (!c) throw new AppError('NOT_FOUND');
    mut(() => !c.member_ids.includes(ME) && c.member_ids.push(ME));
    return c.id;
  },
  async leaveConversation(convId) {
    mut((d) => {
      const c = d.convs.find((x) => x.id === convId);
      c.member_ids = c.member_ids.filter((x) => x !== ME);
    });
  },
  async setMuted(convId, muted) {
    mut((d) => (d.convs.find((x) => x.id === convId).muted = muted));
  },

  // ---------------- Feed, Agora, Stories ----------------
  async posts(kind) {
    await wait(180);
    const d = load();
    const origin = me().loc;
    return d.posts
      .filter((p) => p.kind === kind && (!p.expires_at || new Date(p.expires_at) > new Date()))
      .filter((p) => p.author_id === ME || visibleUser(p.author_id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((p) => {
        const u = p.author_id === ME ? me() : d.users[p.author_id];
        return {
          ...p,
          author_name: u.display_name,
          author_avatar: u.avatar_url,
          author_age: ageOf(u.private.birthdate),
          author_position: u.sex_position,
          author_online: online(u),
          distance_m: u.private.hide_distance ? null : haversine(origin, u.loc),
          likes: d.likes.filter((l) => l.post_id === p.id).length,
          liked: d.likes.some((l) => l.post_id === p.id && l.user_id === ME),
          comments: d.comments.filter((c) => c.post_id === p.id).length,
        };
      });
  },
  async createPost({ kind, body, file }) {
    await wait(220);
    const media_url = file ? await toDataUrl(file, 900) : null;
    const p = { id: 'p-' + uid().slice(0, 8), author_id: ME, kind, body, media_url, created_at: now(), expires_at: kind === 'now' ? ahead(LIMITS.nowPostMinutes) : null };
    mut((d) => {
      if (kind === 'now') d.posts = d.posts.filter((x) => !(x.author_id === ME && x.kind === 'now'));
      d.posts.push(p);
    });
    return { id: p.id };
  },
  async deletePost(post) {
    mut((d) => (d.posts = d.posts.filter((p) => !(p.id === post.id && p.author_id === ME))));
  },
  async like(postId, on) {
    mut((d) => {
      d.likes = d.likes.filter((l) => !(l.post_id === postId && l.user_id === ME));
      if (on) d.likes.push({ post_id: postId, user_id: ME });
    });
  },
  async comments(postId) {
    await wait();
    const d = load();
    return d.comments.filter((c) => c.post_id === postId && (c.author_id === ME || visibleUser(c.author_id)))
      .map((c) => {
        const u = c.author_id === ME ? me() : d.users[c.author_id];
        return { ...c, author_name: u.display_name, author_avatar: u.avatar_url };
      });
  },
  async addComment(postId, body) {
    mut((d) => d.comments.push({ id: uid(), post_id: postId, author_id: ME, body, created_at: now() }));
  },
  async storiesTray() {
    await wait();
    const d = load();
    const active = d.stories.filter((s) => new Date(s.expires_at) > new Date() && (s.author_id === ME || visibleUser(s.author_id)));
    const authors = [...new Set(active.map((s) => s.author_id))];
    return authors
      .map((a) => {
        const u = a === ME ? me() : d.users[a];
        const mine = active.filter((s) => s.author_id === a);
        return { author_id: a, display_name: u.display_name, avatar_url: u.avatar_url, is_me: a === ME, last_at: mine.at(-1).created_at, unseen: mine.some((s) => !d.storyViews.some((v) => v.story_id === s.id && v.viewer_id === ME)) };
      })
      .sort((x, y) => (y.is_me - x.is_me) || (y.unseen - x.unseen));
  },
  async storiesOf(authorId) {
    await wait();
    const d = load();
    const u = authorId === ME ? me() : visibleUser(authorId);
    if (!u) throw new AppError('NOT_FOUND');
    return {
      author: { id: authorId, display_name: u.display_name, avatar_url: u.avatar_url },
      stories: d.stories.filter((s) => s.author_id === authorId && new Date(s.expires_at) > new Date()).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    };
  },
  async createStory(file, caption = '') {
    const media_url = await toDataUrl(file, 1080);
    mut((d) => d.stories.push({ id: 'st-' + uid().slice(0, 8), author_id: ME, media_url, caption, created_at: now(), expires_at: ahead(24 * 60) }));
  },
  async viewStory(storyId) {
    mut((d) => !d.storyViews.some((v) => v.story_id === storyId && v.viewer_id === ME) && d.storyViews.push({ story_id: storyId, viewer_id: ME }));
  },
  async deleteStory(storyId) {
    mut((d) => (d.stories = d.stories.filter((s) => !(s.id === storyId && s.author_id === ME))));
  },

  // ---------------- Segurança ----------------
  async block(userId) {
    mut((d) => !blockedPair(ME, userId) && d.blocks.push({ a: ME, b: userId, created_at: now() }));
  },
  async unblock(userId) {
    mut((d) => (d.blocks = d.blocks.filter((x) => !(x.a === ME && x.b === userId))));
  },
  async blocked() {
    const d = load();
    return d.blocks.filter((x) => x.a === ME).map((x) => ({ id: x.b, display_name: d.users[x.b]?.display_name, avatar_url: d.users[x.b]?.avatar_url, created_at: x.created_at }));
  },
  async report(userId, reason, details, block = true) {
    await wait(260);
    mut((d) => d.reports.push({ reporter: ME, reported: userId, reason, details, created_at: now() }));
    if (block) await api.block(userId);
  },

  // ---------------- Compras simuladas ----------------
  async demoPurchase(productKey) {
    await wait(700);
    const p = PRODUCTS[productKey];
    mut((d) => {
      if (p.kind === 'pro') d.ent.pro_until = ahead(p.period === 'ano' ? 525600 : 43200);
      if (p.kind === 'album_pack') d.ent.album_credits += LIMITS.albumPackSize;
      if (p.kind === 'group') d.ent.group_credits += 1;
    });
    return status();
  },
  async demoCancelPro() {
    mut((d) => (d.ent.pro_until = null));
    return status();
  },
};
