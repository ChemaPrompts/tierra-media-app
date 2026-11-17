// Lectura de pasos desde Health Connect (solo en la app Android).
import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';

export const esNativa = () => Capacitor.isNativePlatform();

export function fechaLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Comprueba que Health Connect está disponible y que hay permiso de pasos.
// Con `pedir` abre la pantalla de permisos del sistema.
export async function asegurarAcceso(pedir) {
  const disp = await Health.isAvailable();
  if (!disp.available) {
    return { ok: false, mensaje: disp.reason || 'Health Connect no está disponible en este móvil.' };
  }
  let estado = await Health.checkAuthorization({ read: ['steps'] });
  if (!estado.readAuthorized.includes('steps')) {
    if (!pedir) return { ok: false, falta: true, mensaje: 'Falta el permiso para leer los pasos.' };
    estado = await Health.requestAuthorization({ read: ['steps'] });
    if (!estado.readAuthorized.includes('steps')) {
      return { ok: false, falta: true, mensaje: 'No se concedió el permiso de pasos.' };
    }
  }
  return { ok: true };
}

// Pasos totales por día desde `desdeISO` (YYYY-MM-DD, hora local) hasta ahora.
export async function leerPasosDiarios(desdeISO) {
  const [y, m, d] = desdeISO.split('-').map(Number);
  const inicio = new Date(y, m - 1, d, 0, 0, 0, 0);
  const res = await Health.queryAggregated({
    dataType: 'steps',
    startDate: inicio.toISOString(),
    endDate: new Date().toISOString(),
    bucket: 'day',
    aggregation: 'sum',
  });
  return (res.samples || []).map((s) => ({
    date: fechaLocal(new Date(s.startDate)),
    steps: Math.round(s.value || 0),
  }));
}
