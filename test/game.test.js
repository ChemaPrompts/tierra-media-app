import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/game.js';
import { MISIONES, PENALIZACIONES, XP_MAX, TOTAL_KM } from '../src/data.js';

const fresh = () => G.newState('2026-11-17');

test('niveles: nivel 1 con 0 XP, nivel 100 con XP_MAX, monótono', () => {
  assert.equal(G.levelFromXp(0), 1);
  assert.equal(G.levelFromXp(XP_MAX), 100);
  assert.equal(G.xpForLevel(100), XP_MAX);
  for (let n = 2; n <= 100; n++) assert.ok(G.xpForLevel(n) > G.xpForLevel(n - 1));
  for (let n = 1; n <= 100; n++) assert.equal(G.levelFromXp(G.xpForLevel(n)), n);
});

test('puertas: Hobbiton sin requisito, Cricava 3.070 XP (nivel 11), final = XP_MAX', () => {
  assert.equal(G.PUERTAS[0].xp, 0);
  assert.equal(G.PUERTAS[1].nombre, 'Cricava');
  assert.equal(G.PUERTAS[1].xp, 3070);
  assert.equal(G.PUERTAS[1].nivel, 11);
  assert.equal(XP_MAX, 76400);
  assert.equal(G.PUERTAS.at(-1).xp, XP_MAX);
  assert.equal(G.PUERTAS.at(-1).nivel, 100);
  for (let i = 1; i < G.PUERTAS.length; i++) assert.ok(G.PUERTAS[i].xp >= G.PUERTAS[i - 1].xp);
});

test('capKm: sin XP se llega a Cricava y se espera allí', () => {
  assert.equal(G.capKm(0), 115);
  assert.equal(G.capKm(3070), 140);
});

test('pasos con la puerta cerrada no suman más allá del hito', () => {
  const r = G.addKm(110, 10, 0);
  assert.equal(r.km, 115);
  assert.ok(Math.abs(r.lost - 5) < 1e-9);
  assert.equal(G.addKm(115, 10, 0).km, 115);
});

test('sincronizar no duplica pasos', () => {
  let s = fresh();
  s = G.syncSteps(s, [{ date: '2026-11-17', steps: 1333 }]);
  const km1 = s.km;
  s = G.syncSteps(s, [{ date: '2026-11-17', steps: 1333 }]);
  assert.equal(s.km, km1);
  s = G.syncSteps(s, [{ date: '2026-11-17', steps: 2666 }]);
  assert.ok(Math.abs(s.km - 2 * km1) < 1e-9);
});

test('pasos anteriores a la fecha de inicio se ignoran', () => {
  const s = G.syncSteps(fresh(), [{ date: '2026-11-16', steps: 9000 }]);
  assert.equal(s.km, 0);
});

test('lleva a Cricava y se queda esperando hasta tener el XP', () => {
  let s = fresh();
  s = G.syncSteps(s, [{ date: '2026-11-17', steps: 200000 }]);
  assert.equal(s.km, 115);
  let st = G.journeyStatus(s.km, G.totalXp(s.missions));
  assert.ok(st.waiting);
  assert.equal(st.gate.nombre, 'Cricava');
  assert.equal(st.xpMissing, 3070);
  // Los pasos se pierden por defecto
  assert.ok(s.lostKm > 0);
  s = G.syncSteps(s, [{ date: '2026-11-18', steps: 100 }]);
  assert.equal(s.km, 115);
});

test('con reserva activada, los pasos sobrantes se aplican al abrir la puerta', () => {
  let s = { ...fresh(), bankSteps: true };
  s = G.syncSteps(s, [{ date: '2026-11-17', steps: 200000 }]); // 150 km, tope 115
  assert.equal(s.km, 115);
  assert.ok(s.bankKm > 30);
  // Hace falta XP: 15 días completos de misiones (160 XP/día) = 3.200
  for (let d = 1; d <= 20; d++) {
    const date = `2026-12-${String(d).padStart(2, '0')}`;
    for (const m of MISIONES) s = G.toggleMission(s, date, m.id);
  }
  assert.ok(G.totalXp(s.missions) >= 3070);
  assert.ok(s.km > 115);
});

test('el Monte del Destino exige el XP completo para llegar', () => {
  assert.ok(G.capKm(XP_MAX - 1) < TOTAL_KM);
  assert.equal(G.capKm(XP_MAX), TOTAL_KM);
  const st = G.journeyStatus(TOTAL_KM - 0.01, XP_MAX - 1);
  assert.ok(st.waiting);
  assert.ok(st.gate.final);
  const fin = G.journeyStatus(TOTAL_KM, XP_MAX);
  assert.ok(fin.finished);
});

test('XP: un día completo son 160 y las marcas se pueden quitar', () => {
  let s = fresh();
  for (const m of MISIONES) s = G.toggleMission(s, '2026-11-17', m.id);
  assert.equal(G.totalXp(s.missions), 160);
  s = G.toggleMission(s, '2026-11-17', 'ejercicio');
  assert.equal(G.totalXp(s.missions), 120);
});

test('meta de agua con 92 kg: 2,6 L y 3,1 L si hay ejercicio', () => {
  assert.equal(G.waterGoalL(92, false), 2.6);
  assert.equal(G.waterGoalL(92, true), 3.1);
});

test('el estado no se muta al sincronizar ni al marcar', () => {
  const s = fresh();
  const copy = JSON.stringify(s);
  G.syncSteps(s, [{ date: '2026-11-17', steps: 5000 }]);
  G.toggleMission(s, '2026-11-17', 'agua');
  assert.equal(JSON.stringify(s), copy);
});

test('penalización: resta XP pero no baja del inicio del nivel', () => {
  // Nivel 11 empieza en 2.787 XP. Se llega a 2.900 y el Anillo (−120) deja 2.787.
  const m = { '2026-01-01': { ejercicio: true } };
  // Construimos 2.900 XP con días completos + un día parcial
  const missions = {};
  for (let d = 1; d <= 18; d++) {
    const f = `2026-02-${String(d).padStart(2, '0')}`;
    missions[f] = Object.fromEntries(MISIONES.map((x) => [x.id, true]));
  }
  assert.equal(G.totalXp(missions), 2880);
  assert.equal(G.levelFromXp(2880), 11);
  missions['2026-02-19'] = { anillo: true };
  assert.equal(G.totalXp(missions), 2787);
  assert.equal(G.levelFromXp(G.totalXp(missions)), 11);
  assert.ok(m);
});

test('penalización sin nivel previo: nunca baja de 0 y el nivel no baja', () => {
  const missions = { '2026-02-01': { agua: true, anillo: true } };
  assert.equal(G.totalXp(missions), 0);
  assert.equal(G.levelFromXp(0), 1);
  const dos = { '2026-02-01': { ejercicio: true, bebida: true } };
  assert.equal(G.totalXp(dos), 0);
});

test('penalización dentro del nivel resta lo justo', () => {
  const missions = {
    '2026-02-01': Object.fromEntries(MISIONES.map((x) => [x.id, true])), // 160, nivel 3
    '2026-02-02': Object.fromEntries(MISIONES.map((x) => [x.id, true])), // 320
    '2026-02-03': { bebida: true },
  };
  const antes = G.xpForLevel(G.levelFromXp(320));
  assert.equal(G.totalXp(missions), Math.max(320 - 40, antes));
  assert.equal(G.penaltyXp({ bebida: true, anillo: true }), 160);
  assert.equal(PENALIZACIONES.length, 2);
});

test('medallas: escalera y umbrales mensuales', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(G.umbralMedalla), [1, 2, 3, 5, 7, 14, 21, 30]);
  assert.equal(G.umbralMedalla(8), 60);
  assert.equal(G.umbralMedalla(9), 90);
  assert.equal(G.etiquetaMedalla(7), '1 semana');
  assert.equal(G.etiquetaMedalla(21), '3 semanas');
  assert.equal(G.etiquetaMedalla(30), '1 mes');
  assert.equal(G.etiquetaMedalla(60), '2 meses');
});

test('racha: sin marcas cuenta días completos desde el inicio (hoy no cuenta)', () => {
  const r0 = G.racha({}, '2026-11-17', '2026-11-17', 'anillo');
  assert.equal(r0.current, 0);
  assert.deepEqual(r0.ganadas, []);
  assert.equal(r0.siguiente, 1);
  const r1 = G.racha({}, '2026-11-17', '2026-11-18', 'anillo');
  assert.equal(r1.current, 1);
  assert.deepEqual(r1.ganadas, [1]);
  const r8 = G.racha({}, '2026-11-17', '2026-11-25', 'anillo');
  assert.equal(r8.current, 8);
  assert.deepEqual(r8.ganadas, [1, 2, 3, 5, 7]);
  assert.equal(r8.siguiente, 14);
  assert.equal(r8.faltan, 6);
});

test('racha: al marcar se reinicia pero las medallas ganadas se conservan', () => {
  const missions = { '2026-11-25': { anillo: true } };
  // Del 17 al 24 limpios (8 días), marca el 25
  const r = G.racha(missions, '2026-11-17', '2026-11-26', 'anillo');
  assert.equal(r.best, 8);
  assert.equal(r.current, 0);
  assert.deepEqual(r.ganadas, [1, 2, 3, 5, 7]);
  assert.equal(r.siguiente, 14);
  assert.equal(r.faltan, 14);
  // Tres días después: 3 limpios, no se vuelve a ganar nada nuevo
  const r2 = G.racha(missions, '2026-11-17', '2026-11-29', 'anillo');
  assert.equal(r2.current, 3);
  assert.deepEqual(r2.ganadas, [1, 2, 3, 5, 7]);
  assert.equal(r2.faltan, 11);
});

test('racha: bebida y anillo van por separado', () => {
  const missions = { '2026-11-20': { bebida: true } };
  const b = G.racha(missions, '2026-11-17', '2026-11-22', 'bebida');
  const a = G.racha(missions, '2026-11-17', '2026-11-22', 'anillo');
  assert.equal(b.current, 1);
  assert.equal(a.current, 5);
});

test('migración: una copia v1 conserva peso y datos y pasa a v2', () => {
  const v1 = { v: 1, startDate: '2026-11-10', weightKg: 92, km: 12, missions: { '2026-11-10': { agua: true } } };
  const m = G.migrate(v1, '2026-11-17');
  assert.equal(m.v, 2);
  assert.equal(m.weightKg, 92);
  assert.equal(m.weightSet, true);
  assert.equal(m.km, 12);
  assert.equal(m.startDate, '2026-11-10');
  assert.ok(m.counted && m.stepLengthM);
});

test('estado nuevo: peso neutro sin fijar', () => {
  const s = G.newState('2026-11-17');
  assert.equal(s.weightSet, false);
  assert.notEqual(s.weightKg, 92);
});
