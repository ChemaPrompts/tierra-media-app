# Tierra Media

App personal para Android: un viaje a pie de Hobbiton al Monte del Destino.

- Los **pasos** (leídos de Health Connect) hacen avanzar tu posición por la ruta, con distancia real (2.865 km).
- Las **misiones diarias** (ejercicio, inglés, chino, IA, escritura, lectura, agua) dan XP y niveles.
- Dos **penalizaciones** (Bebida y Anillo) restan XP, pero nunca por debajo del inicio de tu nivel actual; el nivel no baja.
- La pestaña **Medallas** cuenta los días limpios de cada una (1, 2, 3, 5 días, 1-3 semanas, 1 mes y luego una por mes).
- Cada hito es una **puerta**: llegas caminando, pero para seguir hace falta el XP indicado. El Monte del Destino exige nivel 100.

## Dónde se ajusta el juego

Todo está en `src/data.js`: hitos y kilómetros, XP por misión, XP del nivel 100 y exponente de la curva.

## Pruebas y desarrollo

```
npm install
npm test        # lógica del juego
npm run dev     # versión web (los pasos se suman a mano en Ajustes)
```

## APK

Cada push a `main` construye el APK con GitHub Actions y lo publica en la release **Última versión**.
Instalación: descargar `tierra-media.apk` en el móvil y permitir la instalación desde el navegador.
