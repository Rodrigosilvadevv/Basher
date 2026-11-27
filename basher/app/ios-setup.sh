#!/bin/bash
# ============================================================
#  Basher — prepara o projeto iOS pela primeira vez
#  Rode UMA VEZ no Mac onde vai desenvolver/arquivar.
#  Pré-requisito: Xcode 16+, Node 22+, CocoaPods
# ============================================================
set -e
cd "$(dirname "$0")"

echo "▶ 1/4  Instalando dependências web..."
npm ci

echo "▶ 2/4  Build de produção..."
npm run build

echo "▶ 3/4  Capacitor add iOS (só na primeira vez)..."
if [ ! -d "ios" ]; then
  npx cap add ios
else
  echo "   pasta ios/ já existe, pulando cap add"
fi

echo "▶ 4/4  Sync + CocoaPods..."
npx cap sync ios
cd ios/App
pod install --repo-update
cd ../..

echo ""
echo "✅ Pronto! Abra o Xcode com:"
echo "   npx cap open ios"
echo ""
echo "No Xcode:"
echo "  1. Signing & Capabilities → selecione seu Team"
echo "  2. Bundle ID deve ser: br.com.basher.app"
echo "  3. Product → Archive → Distribute App → App Store Connect"
