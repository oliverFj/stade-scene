import { brandAssetDataURL } from '../design/runtime/engine.mjs';

const mimeTypes = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml' };
export const imageAccept = '.png,.jpg,.jpeg,.webp,.svg';
export const maxImageBytes = 2 * 1024 * 1024;
const maxMediaBytes = 4 * 1024 * 1024;
const mediaId = /^media-[a-z0-9-]{1,64}$/;
const imageTypes = new Set(Object.values(mimeTypes));
const byteCount = data => data.length / 4 * 3 - (data.endsWith('==') ? 2 : Number(data.endsWith('=')));
export const mediaURL = image => 'data:' + image.mimeType + ';base64,' + image.data;
export const findMedia = (scene, id) => scene.media?.find(image => image.id === id);

function validImage(image) {
  if (!image || !imageTypes.has(image.mimeType) || typeof image.data !== 'string'
    || image.data.length > Math.ceil(maxImageBytes / 3) * 4 || image.data.length % 4
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.data)) return false;
  try {
    if (image.mimeType === 'image/svg+xml') return Boolean(brandAssetDataURL(image));
    const binary = atob(image.data);
    if (binary.length > maxImageBytes || btoa(binary) !== image.data) return false;
    if (image.mimeType === 'image/png') return binary.startsWith('\x89PNG\r\n\x1a\n');
    if (image.mimeType === 'image/jpeg') return binary.startsWith('\xff\xd8\xff') && binary.endsWith('\xff\xd9');
    return binary.startsWith('RIFF') && binary.slice(8, 12) === 'WEBP';
  } catch { return false; }
}

export async function readSceneImage(file) {
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  const mimeType = Object.hasOwn(mimeTypes, extension) ? mimeTypes[extension] : undefined;
  if (!mimeType) throw new Error('Vælg et PNG-, JPEG-, WebP- eller SVG-billede.');
  const limit = mimeType === 'image/svg+xml' ? 256 * 1024 : maxImageBytes;
  if (file.size > limit) throw new Error('Billedet må højst fylde ' + (limit === maxImageBytes ? '2 MB.' : '256 KB for SVG.'));
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 16384) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  }
  const image = { id: 'media-' + crypto.randomUUID(), name: file.name.trim().slice(0, 255), mimeType, data: btoa(binary) };
  if (!validImage(image)) throw new Error('Filen indeholder ikke et gyldigt billede i det valgte format.');
  return image;
}

export function addSceneImage(scene, image) {
  const media = scene.media ?? [];
  const existing = media.find(item => item.mimeType === image.mimeType && item.data === image.data);
  if (existing) return existing;
  const bytes = media.reduce((total, item) => total + byteCount(item.data), byteCount(image.data));
  if (bytes > maxMediaBytes) throw new Error('Projektets billeder må tilsammen fylde højst 4 MB.');
  (scene.media ??= []).push(image);
  return image;
}

export function validateSceneMedia(scene, referencedIds) {
  const media = scene.media === undefined ? [] : scene.media;
  if (!Array.isArray(media)) return 'Projektets medier skal være en billedliste.';
  const ids = new Set();
  let bytes = 0;
  for (const image of media) {
    if (!image || typeof image.id !== 'string' || !mediaId.test(image.id) || ids.has(image.id)
      || typeof image.name !== 'string' || !image.name.trim() || image.name.length > 255
      || typeof image.data !== 'string') return 'Projektet indeholder et ugyldigt billede.';
    bytes += byteCount(image.data);
    if (bytes > maxMediaBytes) return 'Projektets billeder må tilsammen fylde højst 4 MB.';
    if (!validImage(image)) return 'Projektet indeholder et ugyldigt billede.';
    ids.add(image.id);
  }
  if (scene.appLogo !== undefined && !ids.has(scene.appLogo)) return 'Appens logo mangler i Medier.';
  if (referencedIds.some(id => !ids.has(id))) return 'Et valgt billede mangler i Medier.';
  return '';
}
