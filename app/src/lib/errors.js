const MESSAGES = {
  AUTH_REQUIRED: 'Entre na sua conta para continuar.',
  UNDERAGE: 'O Basher é exclusivo para maiores de 18 anos.',
  BIRTHDATE_LOCKED: 'Sua data de nascimento já foi verificada e não pode ser alterada.',
  BIRTHDATE_REQUIRED: 'Informe sua data de nascimento.',
  NAME_REQUIRED: 'Escolha um nome para o perfil.',
  CONSENT_REQUIRED: 'Aceite os termos para continuar.',
  AGE_VERIFICATION_REQUIRED: 'Precisamos confirmar que você tem 18 anos ou mais.',
  AGE_SIGNAL_MISSING: 'Não conseguimos confirmar sua idade agora.',
  PRO_REQUIRED: 'Recurso exclusivo do Basher Pro.',
  ALBUM_QUOTA_EXCEEDED: 'Você usou seus 20 envios de álbum deste mês.',
  ALBUM_REQUEST_NOT_ALLOWED: 'Vocês precisam ter conversado ou estar por perto para pedir o álbum.',
  GROUP_CREDIT_REQUIRED: 'Criar um grupo custa R$ 1,99 (ou é grátis no Pro).',
  BLOCKED: 'Não é possível interagir com este perfil.',
  NOT_FOUND: 'Não encontrado.',
  FORBIDDEN: 'Você não tem permissão para isso.',
  PHOTO_LIMIT: 'Máximo de 6 fotos no perfil.',
  INVALID_LOCATION: 'Localização inválida.',
  SUSPENDED: 'Sua conta está em análise pela moderação.',
  IAP_NATIVE_ONLY: 'As compras são feitas pelo app do Basher no iPhone.',
  IAP_CANCELLED: 'Compra cancelada.',
  NETWORK: 'Sem conexão. Tente de novo.',
  TITLE_REQUIRED: 'Dê um nome ao grupo.',
};

export class AppError extends Error {
  constructor(code, message) {
    super(message || MESSAGES[code] || code);
    this.code = code;
  }
}

export function toAppError(err) {
  if (!err) return new AppError('UNKNOWN', 'Algo deu errado.');
  if (err instanceof AppError) return err;
  const raw = String(err.message || err.error_description || err);
  const code = Object.keys(MESSAGES).find((k) => raw.includes(k));
  if (code) return new AppError(code);
  if (/fetch|network|Failed to fetch/i.test(raw)) return new AppError('NETWORK');
  return new AppError('UNKNOWN', raw.length < 140 ? raw : 'Algo deu errado. Tente de novo.');
}

export const errorMessage = (e) => toAppError(e).message;
