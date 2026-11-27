import { Capacitor } from '@capacitor/core';
import { DEFAULT_COORDS } from '../lib/env';

export async function getPosition() {
  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    const perm = await Geolocation.checkPermissions().catch(() => null);
    if (perm?.location !== 'granted') {
      const req = await Geolocation.requestPermissions({ permissions: ['location'] });
      if (req.location !== 'granted') throw new Error('denied');
    }
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  });
}

export const fallbackCoords = () => ({ ...DEFAULT_COORDS });

// Cidades para o "Explorar" (Pro)
export const EXPLORE_CITIES = [
  { name: 'São Paulo', lat: -23.5535, lng: -46.6528 },
  { name: 'Rio de Janeiro', lat: -22.9839, lng: -43.1969 },
  { name: 'Florianópolis', lat: -27.5949, lng: -48.5482 },
  { name: 'Belo Horizonte', lat: -19.9227, lng: -43.9451 },
  { name: 'Salvador', lat: -12.9714, lng: -38.5014 },
  { name: 'Recife', lat: -8.1137, lng: -34.8963 },
  { name: 'Brasília', lat: -15.7942, lng: -47.8822 },
  { name: 'Porto Alegre', lat: -30.0277, lng: -51.2287 },
  { name: 'Curitiba', lat: -25.4284, lng: -49.2733 },
  { name: 'Fortaleza', lat: -3.7319, lng: -38.5267 },
  { name: 'Lisboa', lat: 38.7139, lng: -9.1394 },
  { name: 'Buenos Aires', lat: -34.5895, lng: -58.3974 },
];
