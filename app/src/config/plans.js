// Produtos da App Store (crie com estes IDs no App Store Connect).
// O preço exibido vem da Apple; os valores abaixo são só o fallback visual.
export const PRODUCTS = {
  pro_monthly: {
    id: 'br.com.basher.app.pro.monthly',
    kind: 'pro',
    type: 'subs',
    title: 'Pro mensal',
    period: 'mês',
    fallbackPrice: 'R$ 29,90',
  },
  pro_yearly: {
    id: 'br.com.basher.app.pro.yearly',
    kind: 'pro',
    type: 'subs',
    title: 'Pro anual',
    period: 'ano',
    fallbackPrice: 'R$ 199,90',
    note: 'economize 44%',
  },
  album_pack: {
    id: 'br.com.basher.app.albums10',
    kind: 'album_pack',
    type: 'inapp',
    consumable: true,
    title: '+10 envios de álbum',
    fallbackPrice: 'R$ 2,99',
  },
  group: {
    id: 'br.com.basher.app.group',
    kind: 'group',
    type: 'inapp',
    consumable: true,
    title: 'Criar 1 grupo',
    fallbackPrice: 'R$ 1,99',
  },
};

export const LIMITS = {
  albumFreeMonthly: 20,
  albumPackSize: 10,
  freeGridLimit: 99,
  nowPostMinutes: 60,
};

export const PRO_FEATURES = [
  { icon: 'Infinity', title: 'Perfis sem limite', text: 'Veja todo mundo por perto, não só os 99 primeiros.' },
  { icon: 'SlidersHorizontal', title: 'Filtros avançados', text: 'Posição, tribos e o que cada um procura.' },
  { icon: 'Globe', title: 'Explorar cidades', text: 'Converse com quem está no destino antes de chegar.' },
  { icon: 'EyeOff', title: 'Modo invisível', text: 'Navegue sem aparecer na grade nem nas visitas.' },
  { icon: 'Eye', title: 'Quem me viu', text: 'A lista completa de quem visitou seu perfil.' },
  { icon: 'LockKeyhole', title: 'Álbuns ilimitados', text: 'Envie seus álbuns privados quantas vezes quiser.' },
  { icon: 'UsersRound', title: 'Grupos grátis', text: 'Crie grupos sem pagar por cada um, sem limite de pessoas.' },
  { icon: 'Sparkles', title: 'Brilho Pro', text: 'Anel violeta no seu card para chamar atenção.' },
];
