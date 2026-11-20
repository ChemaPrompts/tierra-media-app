// Lógica pura del juego (sin DOM ni plugins) para poder probarla con node.
import {
  HITOS,
  MISIONES,
  PENALIZACIONES,
  MEDALLAS_FIJAS,
  TOTAL_KM,
  XP_MAX,
  EXPONENTE,
  PASO_M_DEFECTO,
} from './data.js';

const EPS = 1e-6;

// ---------- Niveles ----------

export function xpForLevel(n) {
  if (n <= 1) return 0;
  return Math.round(XP_MAX * Math.pow(n / 100, EXPONENTE));
}

export function levelFromXp(xp) {
  for (let n = 100; n > 1; n--) {
    if (xp >= xpForLevel(n)) return n;
  }
  return 1;
}

export function levelProgress(xp) {
  const level = levelFromXp(xp);
  if (level >= 100) return { level, into: 0, needed: 0, pct: 1 };
  const lower = xpForLevel(level);
  const upper = xpForLevel(level + 1);
  return { level, into: xp - lower, needed: upper - lower, pct: (xp - lower) / (upper - lower) };
}

// ---------- Puertas ----------

export function requiredXp(h) {
  if (h.km <= 0) return 0;
  if (h.final) return XP_MAX;
  return Math.round((XP_MAX * h.km) / TOTAL_KM / 10) * 10;
}

export const PUERTAS = HITOS.map((h) => {
  const xp = requiredXp(h);
  return { ...h, xp, nivel: levelFromXp(xp) };
});

// Hasta dónde se puede avanzar con este XP. Se puede llegar a un hito, pero
// no salir de él sin su XP. El último hito exige el XP completo para llegar.
export function capKm(xp) {
  for (const h of PUERTAS) {
    if (h.km <= 0 || xp >= h.xp) continue;
    return h.final ? h.km - 0.01 : h.km;
  }
  return TOTAL_KM;
}

export function addKm(km, gain, xp) {
  const cap = capKm(xp);
  if (km >= cap - EPS) return { km, lost: gain };
  const next = Math.min(km + gain, cap);
  return { km: next, lost: gain - (next - km) };
}

// ---------- Misiones y XP ----------

export function missionXp(done) {
  if (!done) return 0;
  return MISIONES.reduce((sum, m) => sum + (done[m.id] ? m.xp : 0), 0);
}

export function penaltyXp(done) {
  if (!done) return 0;
  return PENALIZACIONES.reduce((sum, m) => sum + (done[m.id] ? m.xp : 0), 0);
}

// XP total repasando los días en orden. Cada día suma primero las misiones y
// después resta las penalizaciones, sin bajar del inicio del nivel alcanzado.
// Así el nivel nunca baja y corregir un día pasado recalcula todo bien.
export function totalXp(missions) {
  let xp = 0;
  for (const date of Object.keys(missions || {}).sort()) {
    const dia = missions[date];
    xp += missionXp(dia);
    const pen = penaltyXp(dia);
    if (pen > 0) xp = Math.max(xp - pen, xpForLevel(levelFromXp(xp)));
  }
  return xp;
}

// ---------- Medallas por días limpios ----------

export function umbralMedalla(i) {
  if (i < MEDALLAS_FIJAS.length) return MEDALLAS_FIJAS[i];
  return 30 * (i - MEDALLAS_FIJAS.length + 2); // 60, 90, 120...
}

export function etiquetaMedalla(dias) {
  if (dias === 1) return '1 día';
  if (dias < 7) return `${dias} días`;
  if (dias < 30) return dias === 7 ? '1 semana' : `${dias / 7} semanas`;
  const m = dias / 30;
  return m === 1 ? '1 mes' : `${m} meses`;
}

const diasEntre = (a, b) => {
  const f = (x) => Date.UTC(+x.slice(0, 4), +x.slice(5, 7) - 1, +x.slice(8, 10));
  return Math.round((f(b) - f(a)) / 86400000);
};

// Racha de días limpios de una marca (bebida / anillo). Un día cuenta como
// limpio cuando ya ha terminado sin marca; hoy todavía no cuenta.
export function racha(missions, startDate, todayISO, id) {
  const marcas = Object.keys(missions || {})
    .filter((d) => missions[d]?.[id] && d >= startDate && d <= todayISO)
    .sort();
  let best = 0;
  let desde = startDate; // primer día potencialmente limpio del tramo actual
  for (const m of marcas) {
    best = Math.max(best, diasEntre(desde, m));
    const sig = new Date(`${m}T12:00:00Z`);
    sig.setUTCDate(sig.getUTCDate() + 1);
    desde = sig.toISOString().slice(0, 10);
  }
  const current = Math.max(0, diasEntre(desde, todayISO));
  best = Math.max(best, current);
  const ganadas = [];
  let i = 0;
  while (umbralMedalla(i) <= best) ganadas.push(umbralMedalla(i++));
  const siguiente = umbralMedalla(i);
  return { current, best, ganadas, siguiente, faltan: siguiente - current };
}

// Meta de bebida: 35 ml/kg de líquidos totales, menos ~20 % que aporta la
// comida, y +0,5 L los días de ejercicio.
export function waterGoalL(weightKg, exerciseDone) {
  const base = Math.round(weightKg * 0.035 * 0.8 * 10) / 10;
  return exerciseDone ? Math.round((base + 0.5) * 10) / 10 : base;
}

// ---------- Estado ----------

// Lleva una copia guardada (v1 o v2) al formato actual sin perder nada.
export function migrate(saved, todayISO) {
  const base = newState(saved?.startDate || todayISO);
  if (!saved) return base;
  const out = { ...base, ...saved, v: 2 };
  if (saved.v === 1 && saved.weightSet === undefined) out.weightSet = true;
  return out;
}

export function newState(todayISO) {
  return {
    v: 2,
    startDate: todayISO,
    weightKg: 70, // valor neutro hasta que se indique el peso real
    weightSet: false,
    stepLengthM: PASO_M_DEFECTO,
    bankSteps: false, // guardar en reserva los pasos que sobran con la puerta cerrada
    km: 0,
    bankKm: 0,
    lostKm: 0,
    counted: {},
    base: {},
    missions: {},
    permissionAsked: false,
  };
}

function releaseBank(s) {
  if (!s.bankKm || s.bankKm <= 0) return;
  const r = addKm(s.km, s.bankKm, totalXp(s.missions));
  s.km = r.km;
  s.bankKm = r.lost; // lo que no cabe sigue en la reserva
}

export function toggleMission(state, date, id) {
  const s = structuredClone(state);
  s.missions[date] = { ...(s.missions[date] || {}) };
  s.missions[date][id] = !s.missions[date][id];
  releaseBank(s);
  return s;
}

// Aplica los pasos diarios leídos del sistema. Cada día solo cuenta la
// diferencia con lo ya contado, así que sincronizar varias veces no duplica.
export function syncSteps(state, days) {
  const s = structuredClone(state);
  const xp = totalXp(s.missions);
  for (const { date, steps } of days) {
    if (date < s.startDate) continue;
    // `base` guarda los pasos que ya existían al reiniciar el viaje: no cuentan.
    const efectivos = Math.max(0, steps - (s.base?.[date] ?? 0));
    const prev = s.counted[date] ?? 0;
    if (efectivos <= prev) continue;
    const gainKm = ((efectivos - prev) * s.stepLengthM) / 1000;
    const r = addKm(s.km, gainKm, xp);
    s.km = r.km;
    if (s.bankSteps) s.bankKm = (s.bankKm || 0) + r.lost;
    else s.lostKm = (s.lostKm || 0) + r.lost;
    s.counted[date] = efectivos;
  }
  releaseBank(s);
  const keys = Object.keys(s.counted).sort();
  while (keys.length > 45) delete s.counted[keys.shift()];
  return s;
}

// ---------- Estado del viaje (para la interfaz) ----------

export function journeyStatus(km, xp) {
  const finished = km >= TOTAL_KM - EPS;
  const last = [...PUERTAS].reverse().find((h) => km >= h.km - EPS) || PUERTAS[0];
  const next = PUERTAS.find((h) => h.km > km + EPS) || null;
  const cap = capKm(xp);
  const waiting = !finished && cap < TOTAL_KM && km >= cap - EPS;
  let gate = null;
  if (waiting) gate = PUERTAS.find((h) => (h.final ? h.km - 0.01 : h.km) === cap) || null;
  return {
    finished,
    last,
    next,
    waiting,
    gate,
    xpMissing: gate ? Math.max(0, gate.xp - xp) : 0,
    kmToNext: next ? Math.max(0, next.km - km) : 0,
  };
}

export function reachedHitos(km) {
  return PUERTAS.filter((h) => km >= h.km - EPS);
}

export { TOTAL_KM, XP_MAX };
