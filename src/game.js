// Lógica pura del juego (sin DOM ni plugins) para poder probarla con node.
import { HITOS, MISIONES, TOTAL_KM, XP_MAX, EXPONENTE, PASO_M_DEFECTO } from './data.js';

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

export function totalXp(missions) {
  return Object.values(missions || {}).reduce((sum, d) => sum + missionXp(d), 0);
}

// Meta de bebida: 35 ml/kg de líquidos totales, menos ~20 % que aporta la
// comida, y +0,5 L los días de ejercicio.
export function waterGoalL(weightKg, exerciseDone) {
  const base = Math.round(weightKg * 0.035 * 0.8 * 10) / 10;
  return exerciseDone ? Math.round((base + 0.5) * 10) / 10 : base;
}

// ---------- Estado ----------

export function newState(todayISO) {
  return {
    v: 1,
    startDate: todayISO,
    weightKg: 92,
    stepLengthM: PASO_M_DEFECTO,
    bankSteps: false, // guardar en reserva los pasos que sobran con la puerta cerrada
    km: 0,
    bankKm: 0,
    lostKm: 0,
    counted: {},
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
    const prev = s.counted[date] ?? 0;
    if (steps <= prev) continue;
    const gainKm = ((steps - prev) * s.stepLengthM) / 1000;
    const r = addKm(s.km, gainKm, xp);
    s.km = r.km;
    if (s.bankSteps) s.bankKm = (s.bankKm || 0) + r.lost;
    else s.lostKm = (s.lostKm || 0) + r.lost;
    s.counted[date] = steps;
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
