import { Preferences } from '@capacitor/preferences';

const KEY = 'tierra-media-estado';

export async function cargar() {
  const { value } = await Preferences.get({ key: KEY });
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function guardar(estado) {
  await Preferences.set({ key: KEY, value: JSON.stringify(estado) });
}
