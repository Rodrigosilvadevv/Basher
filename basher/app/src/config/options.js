export const POSITIONS = [
  { id: 'top', label: 'Ativo', short: 'ATV' },
  { id: 'vers_top', label: 'Versátil ativo', short: 'V.ATV' },
  { id: 'versatile', label: 'Versátil', short: 'VERS' },
  { id: 'vers_bottom', label: 'Versátil passivo', short: 'V.PAS' },
  { id: 'bottom', label: 'Passivo', short: 'PAS' },
  { id: 'side', label: 'Side', short: 'SIDE' },
];
export const positionLabel = (id) => POSITIONS.find((p) => p.id === id)?.label || null;
export const positionShort = (id) => POSITIONS.find((p) => p.id === id)?.short || null;

export const LOOKING_FOR = [
  { id: 'now', label: 'Agora' },
  { id: 'chat', label: 'Conversa' },
  { id: 'date', label: 'Encontro' },
  { id: 'friends', label: 'Amizade' },
  { id: 'relationship', label: 'Namoro' },
  { id: 'party', label: 'Rolê' },
  { id: 'networking', label: 'Networking' },
];

export const MEET_AT = [
  { id: 'host', label: 'Tenho local' },
  { id: 'travel', label: 'Vou até você' },
  { id: 'public', label: 'Bar / balada' },
  { id: 'hotel', label: 'Motel / hotel' },
  { id: 'coffee', label: 'Café primeiro' },
];

export const TRIBES = [
  'Urso', 'Lontra', 'Barbie', 'Twink', 'Daddy', 'Chaser', 'Atleta', 'Rato de academia', 'Geek',
  'Couro', 'Discreto', 'Maduro', 'Trans', 'Não-binário', 'Drag', 'Alternativo',
];

export const INTERESTS = [
  'Academia', 'Praia', 'Eletrônica', 'Pop', 'Funk', 'Pagode', 'MPB', 'Drag Race', 'Séries', 'Cinema',
  'Games', 'Anime', 'Viagem', 'Café', 'Vinho', 'Cerveja', 'Cozinhar', 'Pets', 'Arte', 'Moda',
  'Livros', 'Yoga', 'Corrida', 'Bike', 'Vôlei', 'Futebol', 'Teatro', 'Tatuagem', 'Fotografia',
  'Balada', 'Karaokê', 'Natureza', 'Astrologia', 'Tecnologia',
];

export const BODY_TYPES = ['Magro', 'Atlético', 'Médio', 'Musculoso', 'Forte', 'Gordinho'];
export const RELATIONSHIPS = ['Solteiro', 'Namorando', 'Relação aberta', 'Casado', 'Complicado'];
export const PRONOUNS = ['ele/dele', 'ela/dela', 'elu/delu', 'qualquer'];

export const REPORT_REASONS = [
  { id: 'underage', label: 'Parece menor de 18 anos' },
  { id: 'fake', label: 'Perfil falso ou golpe' },
  { id: 'harassment', label: 'Assédio ou ameaça' },
  { id: 'explicit_public', label: 'Nudez na foto pública' },
  { id: 'selling', label: 'Venda de serviços / prostituição' },
  { id: 'violence', label: 'Violência ou discurso de ódio' },
  { id: 'spam', label: 'Spam' },
  { id: 'other', label: 'Outro motivo' },
];

export const TAP_KINDS = [
  { id: 'fire', emoji: '🔥', label: 'Quente' },
  { id: 'wave', emoji: '👋', label: 'Oi' },
  { id: 'wink', emoji: '😏', label: 'Piscadinha' },
];

export const QUICK_REPLIES = ['Oi! 👋', 'Tudo bem?', 'Onde você tá?', 'Tem local?', 'Bora se ver?', 'Manda mais fotos?'];

export const ALBUM_DURATIONS = [
  { hours: 1, label: '1 hora' },
  { hours: 24, label: '24 horas' },
  { hours: 168, label: '7 dias' },
  { hours: null, label: 'Sem prazo' },
];

export const SAFE_DATE_DURATIONS = [30, 60, 120, 180];
