import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/game.js';
import { MISIONES, XP_MAX, TOTAL_KM } from '../src/data.js';

const fresh = () => G.newState('2026-11-17');

test('niveles: nivel 1 con 0 XP, nivel 100 con XP_MAX, monótono', () => {
  assert.equal(G.levelFromXp(0), 1);
  assert.equal(G.levelFromXp(XP_MAX), 100);
  assert.equal(G.xpForLevel(100), XP_MAX);
  for (let n = 2; n <= 100; n++) assert.ok(G.xpForLevel(n) > G.xpForLevel(n - 1));
  for (let n = 1; n <= 100; n++) assert.equal(G.levelFromXp(G.xpForLevel(n)), n);
});

test('puertas: Hobbiton sin requisito, Cricava ~1.500 XP, final = XP_MAX', () => {
  assert.equal(G.PUERTAS[0].xp, 0);
  assert.equal(G.PUERTAS[1].nombre, 'Cricava');
  assert.equal(G.PUERTAS[1].xp, 1500);
  assert.equal(G.PUERTAS.at(-1).xp, XP_MAX);
  assert.equal(G.PUERTAS.at(-1).nivel, 100);
  for (let i = 1; i < G.PUERTAS.length; i++) assert.ok(G.PUERTAS[i].xp >= G.PUERTAS[i - 1].xp);
});

test('capKm: sin XP se llega a Cricava y se espera allí', () => {
  assert.equal(G.capKm(0), 115);
  assert.equal(G.capKm(1500), 140);
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
  assert.equal(st.xpMissing, 1500);
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
  // Hace falta XP: 15 días completos de misiones (115 XP/día) = 1.725
  for (let d = 1; d <= 15; d++) {
    const date = `2026-12-${String(d).padStart(2, '0')}`;
    for (const m of MISIONES) s = G.toggleMission(s, date, m.id);
  }
  assert.ok(G.totalXp(s.missions) >= 1500);
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

test('XP: un día completo son 115 y las marcas se pueden quitar', () => {
  let s = fresh();
  for (const m of MISIONES) s = G.toggleMission(s, '2026-11-17', m.id);
  assert.equal(G.totalXp(s.missions), 115);
  s = G.toggleMission(s, '2026-11-17', 'ejercicio');
  assert.equal(G.totalXp(s.missions), 75);
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
