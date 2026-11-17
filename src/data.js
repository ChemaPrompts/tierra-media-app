// Datos del juego. Aquí se ajusta todo: ruta, XP por misión y curva de niveles.

// Longitud total de la ruta (km). Fuente: Atlas de la Tierra Media de Fonstad,
// 1.779 millas ≈ 2.865 km desde Bolsón Cerrado hasta el Monte del Destino.
export const TOTAL_KM = 2865;

// XP acumulado necesario para el nivel 100 (y para llegar al Monte del Destino).
// Sale de ~548 XP/semana (645 XP máx. con 3 días de ejercicio × 85 %) durante
// las ~68 semanas que lleva la ruta a ~8.000 pasos al día.
export const XP_MAX = 37400;

// XP acumulado de un nivel n = XP_MAX × (n/100)^EXPONENTE.
export const EXPONENTE = 1.5;

// Longitud de paso por defecto (metros). 1 km ≈ 1.333 pasos.
export const PASO_M_DEFECTO = 0.75;

// Hitos de la ruta. `km` = distancia acumulada desde Hobbiton (aproximada
// en los puntos intermedios; los puntos de Fonstad son 115, 215, 385, 735,
// 1.285, 1.480, 2.105, 2.360, 2.640, 2.675 y 2.865).
export const HITOS = [
  { nombre: 'Hobbiton', km: 0, nota: 'El inicio del viaje, en la Comarca.' },
  { nombre: 'Cricava', km: 115, nota: 'Primera parada, a las puertas del Bosque Viejo.' },
  { nombre: 'Bosque Viejo', km: 140, nota: 'Árboles que no te quieren ahí.' },
  { nombre: 'Túmulos', km: 170, nota: 'Niebla y tumbas antiguas.' },
  { nombre: 'Bree', km: 215, nota: 'Posada, humo de pipa y miradas curiosas.' },
  { nombre: 'Cima de los Vientos', km: 385, nota: 'Ruinas de una torre con vistas peligrosas.' },
  { nombre: 'Vado del Bruinen', km: 685, nota: 'El río que frena a los jinetes oscuros.' },
  { nombre: 'Rivendel', km: 735, nota: 'Refugio élfico, descanso y consejo.' },
  { nombre: 'Hollin', km: 1000, nota: 'Tierra de ruinas, vigilada por cuervos.' },
  { nombre: 'Paso del Caradhras', km: 1150, nota: 'La montaña cruel, cubierta de nieve.' },
  { nombre: 'Puertas de Moria', km: 1285, nota: 'La entrada oeste de las minas enanas.' },
  { nombre: 'Puente de Khazad-dûm', km: 1330, nota: 'Un puente estrecho sobre el abismo.' },
  { nombre: 'Lothlórien', km: 1480, nota: 'El bosque dorado, fuera del tiempo.' },
  { nombre: 'Argonath', km: 2070, nota: 'Dos estatuas gigantes vigilan el río.' },
  { nombre: 'Amon Hen', km: 2105, nota: 'La colina de la vista, donde se rompe la compañía.' },
  { nombre: 'Emyn Muil', km: 2200, nota: 'Riscos laberínticos y cuerdas élficas.' },
  { nombre: 'Ciénagas de los Muertos', km: 2360, nota: 'Luces falsas sobre el agua.' },
  { nombre: 'Puerta Negra', km: 2420, nota: 'La entrada cerrada de Mordor.' },
  { nombre: 'Ithilien', km: 2500, nota: 'Jardín salvaje a las puertas del enemigo.' },
  { nombre: 'Minas Morgul', km: 2640, nota: 'La torre de la hechicería, de luz enferma.' },
  { nombre: 'Guarida de Ella-Laraña', km: 2675, nota: 'Un túnel oscuro con una araña antigua.' },
  { nombre: 'Gorgoroth', km: 2780, nota: 'Llanura de ceniza bajo un cielo rojo.' },
  { nombre: 'Monte del Destino', km: 2865, nota: 'Donde acaba el viaje y se destruye el anillo.', final: true },
];

// Misiones diarias. Todas son marca de hecho / no hecho.
export const MISIONES = [
  { id: 'ejercicio', nombre: 'Ejercicio', detalle: 'Sesión completa', xp: 40 },
  { id: 'ingles', nombre: 'Inglés', detalle: 'Sesión del día', xp: 25 },
  { id: 'chino', nombre: 'Chino', detalle: 'Lección de Duolingo', xp: 25 },
  { id: 'lectura', nombre: 'Lectura', detalle: 'Has leído hoy', xp: 15 },
  { id: 'agua', nombre: 'Agua', detalle: 'Meta de agua del día', xp: 10 },
];
