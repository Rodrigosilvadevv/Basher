// Verificação de transações e notificações da App Store (StoreKit 2 / JWS).
import fs from 'node:fs/promises';
import path from 'node:path';
import { SignedDataVerifier, Environment } from '@apple/app-store-server-library';
import { cfg } from './config.js';

const ROOT_URLS = [
  'https://www.apple.com/certificateauthority/AppleRootCA-G3.cer',
  'https://www.apple.com/certificateauthority/AppleRootCA-G2.cer',
  'https://www.apple.com/appleca/AppleIncRootCertificate.cer',
];

let rootsPromise = null;
async function loadRoots() {
  if (!rootsPromise) {
    rootsPromise = (async () => {
      if (cfg.APPLE_ROOT_CERTS_DIR) {
        const files = (await fs.readdir(cfg.APPLE_ROOT_CERTS_DIR)).filter((f) => f.endsWith('.cer'));
        return Promise.all(files.map((f) => fs.readFile(path.join(cfg.APPLE_ROOT_CERTS_DIR, f))));
      }
      return Promise.all(ROOT_URLS.map(async (u) => {
        const r = await fetch(u);
        if (!r.ok) throw new Error(`Falha ao baixar certificado raiz da Apple: ${u}`);
        return Buffer.from(await r.arrayBuffer());
      }));
    })().catch((e) => {
      rootsPromise = null;
      throw e;
    });
  }
  return rootsPromise;
}

const verifiers = new Map();
async function verifierFor(env) {
  if (!verifiers.has(env)) {
    const roots = await loadRoots();
    verifiers.set(env, new SignedDataVerifier(roots, true, env, cfg.APPLE_BUNDLE_ID, env === Environment.PRODUCTION ? cfg.APPLE_APP_ID : undefined));
  }
  return verifiers.get(env);
}

// Tenta produção primeiro; a revisão da Apple e o TestFlight usam sandbox.
function environments() {
  const envs = [];
  if (cfg.APPLE_APP_ID) envs.push(Environment.PRODUCTION);
  envs.push(Environment.SANDBOX);
  return envs;
}

async function tryAll(fn) {
  let last;
  for (const env of environments()) {
    try {
      return { env, data: await fn(await verifierFor(env)) };
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error('VERIFY_FAILED');
}

export const decodeTransaction = (jws) => tryAll((v) => v.verifyAndDecodeTransaction(jws));
export const decodeNotification = (payload) => tryAll((v) => v.verifyAndDecodeNotification(payload));
export const decodeRenewal = (jws) => tryAll((v) => v.verifyAndDecodeRenewalInfo(jws));
