import './style.css';
import { cargar, guardar } from './storage.js';
import * as G from './game.js';
import { MISIONES } from './data.js';
import * as P from './steps.js';

const $ = (s) => document.querySelector(s);
const fmt0 = (n) => Math.round(n).toLocaleString('es-ES');
const fmt1 = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtL = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

let state;
let vista = 'camino';
let dia = 'hoy';
let sync = { ok: null, texto: 'Aún sin sincronizar', falta: false };
let ocupado = false;
let irAlActual = true;
let backupTexto = '';

const hoy = () => P.fechaLocal();
const ayer = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return P.fechaLocal(d);
};

async function guardarEstado() {
  try {
    await guardar(state);
  } catch (e) {
    console.error('No se pudo guardar', e);
  }
}

// ---------- Pintado ----------

function pintar() {
  pintarCabecera();
  pintarVista();
  document
    .querySelectorAll('#menu button')
    .forEach((b) => b.classList.toggle('activo', b.dataset.vista === vista));
}

function pintarCabecera() {
  const xp = G.totalXp(state.missions);
  const p = G.levelProgress(xp);
  const pasosHoy = state.counted[hoy()] ?? 0;
  const kmHoy = (pasosHoy * state.stepLengthM) / 1000;
  const detalle =
    p.level >= 100
      ? 'Nivel máximo'
      : `${fmt0(p.into)} / ${fmt0(p.needed)} XP para el nivel ${p.level + 1}`;
  $('#cabecera').innerHTML = `
    <div class="fila">
      <div class="nivel"><small>NIVEL</small><b>${p.level}</b></div>
      <div class="xp">
        <div class="barra"><i style="width:${Math.round(p.pct * 100)}%"></i></div>
        <small>${detalle} · ${fmt0(xp)} XP en total</small>
      </div>
    </div>
    <div class="fila resumen">
      <span>👣 ${fmt0(pasosHoy)} pasos hoy (${fmt1(kmHoy)} km)</span>
      <span>🧭 ${fmt1(state.km)} / ${fmt0(G.TOTAL_KM)} km</span>
    </div>`;
}

function pintarVista() {
  const contenedor = $('#vista');
  const scroll = contenedor.scrollTop;
  if (vista === 'camino') contenedor.innerHTML = vistaCamino();
  else if (vista === 'misiones') contenedor.innerHTML = vistaMisiones();
  else contenedor.innerHTML = vistaAjustes();
  if (vista === 'camino' && irAlActual) {
    irAlActual = false;
    const el = contenedor.querySelector('.actual') || contenedor.querySelector('.tramo');
    if (el) el.scrollIntoView({ block: 'center' });
  } else {
    contenedor.scrollTop = scroll;
  }
}

function vistaCamino() {
  const xp = G.totalXp(state.missions);
  const st = G.journeyStatus(state.km, xp);
  let texto;
  if (st.finished) texto = '🏔️ <b>¡Has llegado al Monte del Destino!</b> El anillo es historia.';
  else if (st.waiting && st.gate.final)
    texto = `🔒 <b>A las puertas del Monte del Destino.</b> Necesitas el nivel 100 (${fmt0(st.gate.xp)} XP). Te faltan ${fmt0(st.xpMissing)} XP.`;
  else if (st.waiting)
    texto = `🔒 <b>Esperando en ${st.gate.nombre}.</b> Para seguir necesitas el nivel ${st.gate.nivel} (${fmt0(st.gate.xp)} XP). Te faltan ${fmt0(st.xpMissing)} XP.`;
  else texto = `🥾 <b>Camino a ${st.next.nombre}.</b> Faltan ${fmt1(st.kmToNext)} km.`;

  let extra = '';
  if (state.bankSteps && state.bankKm > 0.05)
    extra = `<p class="nota">Reserva de pasos: ${fmt1(state.bankKm)} km, se aplican al abrir la puerta.</p>`;
  else if (!state.bankSteps && state.lostKm > 0.05)
    extra = `<p class="nota">Kilómetros que no han contado por puerta cerrada: ${fmt1(state.lostKm)}.</p>`;

  const filas = G.PUERTAS.map((h, i) => {
    const llegado = state.km >= h.km - 1e-6;
    const actual = llegado && h.nombre === st.last.nombre && !st.finished;
    const clase = llegado ? (actual ? 'hecho actual' : 'hecho') : 'pendiente';
    const icono = llegado ? (actual && st.waiting ? '🔒' : actual ? '📍' : '🏅') : '○';
    const req =
      h.km > 0
        ? `<span class="req">Nivel ${h.nivel} · ${fmt0(h.xp)} XP</span>`
        : '<span class="req">Punto de partida</span>';
    let html = `<li class="hito ${clase}">
      <span class="ico">${icono}</span>
      <div class="cuerpo">
        <div class="titulo"><b>${h.nombre}</b><span class="km">km ${fmt0(h.km)}</span></div>
        <div class="nota">${h.nota}</div>
        ${req}
      </div></li>`;
    const sig = G.PUERTAS[i + 1];
    if (sig && state.km > h.km + 1e-6 && state.km < sig.km - 1e-6) {
      const pct = Math.round(((state.km - h.km) / (sig.km - h.km)) * 100);
      html += `<li class="tramo"><span class="ico">🧍</span>
        <div class="cuerpo"><div class="barra fina"><i style="width:${pct}%"></i></div>
        <small>Estás aquí · km ${fmt1(state.km)} · ${pct} % del tramo a ${sig.nombre}</small></div></li>`;
    }
    return html;
  }).join('');

  return `<section class="tarjeta estado">${texto}${extra}</section><ol class="ruta">${filas}</ol>`;
}

function vistaMisiones() {
  const fecha = dia === 'hoy' ? hoy() : ayer();
  const hechas = state.missions[fecha] || {};
  const meta = G.waterGoalL(state.weightKg, !!hechas.ejercicio);
  const maxXp = MISIONES.reduce((a, m) => a + m.xp, 0);
  const filas = MISIONES.map((m) => {
    const detalle = m.id === 'agua' ? `Beber ${fmtL(meta)} L (sin contar la comida)` : m.detalle;
    return `<button class="mision ${hechas[m.id] ? 'hecha' : ''}" data-mision="${m.id}">
      <span class="check">${hechas[m.id] ? '✔' : ''}</span>
      <span class="txt"><b>${m.nombre}</b><small>${detalle}</small></span>
      <span class="xpchip">+${m.xp} XP</span></button>`;
  }).join('');
  return `
    <div class="chips">
      <button data-dia="hoy" class="${dia === 'hoy' ? 'activo' : ''}">Hoy</button>
      <button data-dia="ayer" class="${dia === 'ayer' ? 'activo' : ''}">Ayer</button>
    </div>
    <section class="tarjeta">${filas}</section>
    <p class="nota centro">XP de este día: ${G.missionXp(hechas)} / ${maxXp}</p>`;
}

function vistaAjustes() {
  const nativa = P.esNativa();
  const pruebas = nativa
    ? ''
    : `<section class="tarjeta"><h3>Pruebas (navegador)</h3>
        <p class="nota">Aquí no se leen pasos reales. Suma pasos a mano para probar.</p>
        <div class="fila-form"><input id="pasosPrueba" type="number" min="0" step="500" placeholder="Pasos" />
        <button data-accion="prueba-pasos">Sumar a hoy</button></div></section>`;
  const estadoSync =
    sync.ok === true ? '✅' : sync.ok === false ? '⚠️' : '⏳';
  return `
    <section class="tarjeta"><h3>Pasos</h3>
      <p class="nota">${estadoSync} ${sync.texto}</p>
      <div class="botones">
        <button data-accion="sync">Sincronizar ahora</button>
        <button data-accion="permiso">Dar permiso de pasos</button>
      </div>
      <p class="nota">Los pasos cuentan desde el inicio del ${state.startDate.split('-').reverse().join('/')}.</p>
    </section>
    <section class="tarjeta"><h3>Tus datos</h3>
      <label>Peso (kg)<input name="peso" type="number" inputmode="decimal" min="30" max="250" step="0.1" value="${state.weightKg}" /></label>
      <label>Longitud de paso (m)<input name="paso" type="number" inputmode="decimal" min="0.4" max="1.2" step="0.01" value="${state.stepLengthM}" /></label>
      <label class="casilla"><input name="reserva" type="checkbox" ${state.bankSteps ? 'checked' : ''} />
        Guardar en reserva los pasos que sobran con la puerta cerrada (se aplican al abrirla)</label>
    </section>
    ${pruebas}
    <section class="tarjeta"><h3>Copia de seguridad</h3>
      <div class="botones">
        <button data-accion="exportar">Mostrar copia</button>
        <button data-accion="importar">Importar texto</button>
      </div>
      <textarea id="backup" rows="5" placeholder="Aquí aparece la copia, o pega una para importarla">${backupTexto}</textarea>
    </section>
    <section class="tarjeta peligro"><h3>Reiniciar</h3>
      <p class="nota">Borra el progreso, las misiones y vuelve a Hobbiton.</p>
      <button data-accion="reiniciar">Reiniciar el viaje</button>
    </section>
    <p class="nota centro">Tierra Media v0.1</p>`;
}

// ---------- Pasos ----------

async function sincronizar(pedir = false) {
  if (ocupado) return;
  ocupado = true;
  try {
    if (!P.esNativa()) {
      sync = { ok: false, texto: 'Estás en el navegador: los pasos solo se leen en la app Android.' };
      return;
    }
    const acc = await P.asegurarAcceso(pedir);
    if (!acc.ok) {
      sync = { ok: false, texto: acc.mensaje, falta: acc.falta };
      return;
    }
    const dias = await P.leerPasosDiarios(state.startDate);
    state = G.syncSteps(state, dias);
    await guardarEstado();
    const h = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    sync = { ok: true, texto: `Sincronizado a las ${h}.` };
  } catch (e) {
    sync = { ok: false, texto: `No se pudieron leer los pasos: ${e?.message || e}` };
  } finally {
    ocupado = false;
    pintar();
  }
}

// ---------- Eventos ----------

document.addEventListener('click', async (ev) => {
  const t = ev.target.closest('button');
  if (!t) return;
  if (t.dataset.vista) {
    vista = t.dataset.vista;
    if (vista === 'camino') irAlActual = true;
    $('#vista').scrollTop = 0;
    pintar();
  } else if (t.dataset.dia) {
    dia = t.dataset.dia;
    pintar();
  } else if (t.dataset.mision) {
    const fecha = dia === 'hoy' ? hoy() : ayer();
    state = G.toggleMission(state, fecha, t.dataset.mision);
    await guardarEstado();
    pintar();
  } else if (t.dataset.accion) {
    await accion(t.dataset.accion);
  }
});

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.name === 'peso') {
    const v = parseFloat(el.value);
    if (v >= 30 && v <= 250) state.weightKg = v;
  } else if (el.name === 'paso') {
    const v = parseFloat(el.value);
    if (v >= 0.4 && v <= 1.2) state.stepLengthM = v;
  } else if (el.name === 'reserva') {
    state.bankSteps = el.checked;
  } else return;
  await guardarEstado();
  pintar();
});

async function accion(nombre) {
  if (nombre === 'sync') await sincronizar(false);
  else if (nombre === 'permiso') await sincronizar(true);
  else if (nombre === 'prueba-pasos') {
    const n = parseInt($('#pasosPrueba').value, 10);
    if (n > 0) {
      const d = hoy();
      state = G.syncSteps(state, [{ date: d, steps: (state.counted[d] ?? 0) + n }]);
      await guardarEstado();
      pintar();
    }
  } else if (nombre === 'exportar') {
    backupTexto = JSON.stringify(state);
    pintar();
    try {
      await navigator.clipboard.writeText(backupTexto);
    } catch {
      /* si no se puede copiar, el texto queda en la caja */
    }
  } else if (nombre === 'importar') {
    try {
      const nuevo = JSON.parse($('#backup').value);
      if (nuevo.v !== 1 || typeof nuevo.km !== 'number') throw new Error('formato');
      state = { ...G.newState(hoy()), ...nuevo };
      await guardarEstado();
      backupTexto = '';
      pintar();
    } catch {
      sync = { ok: false, texto: 'La copia pegada no es válida.' };
      pintar();
    }
  } else if (nombre === 'reiniciar') {
    if (confirm('¿Seguro? Se borra todo el progreso y vuelves a Hobbiton.')) {
      const peso = state.weightKg;
      const paso = state.stepLengthM;
      state = { ...G.newState(hoy()), weightKg: peso, stepLengthM: paso, permissionAsked: true };
      await guardarEstado();
      irAlActual = true;
      pintar();
    }
  }
}

// ---------- Inicio ----------

async function iniciar() {
  const guardado = await cargar();
  state = { ...G.newState(guardado?.startDate || hoy()), ...(guardado || {}) };
  pintar();
  if (!state.permissionAsked && P.esNativa()) {
    state.permissionAsked = true;
    await guardarEstado();
    await sincronizar(true);
  } else {
    await sincronizar(false);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) sincronizar(false);
  });
  setInterval(() => {
    if (!document.hidden) sincronizar(false);
  }, 5 * 60 * 1000);
}

iniciar();
