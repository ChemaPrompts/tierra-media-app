# Tierra Media

App personal para Android: un viaje a pie de Hobbiton al Monte del Destino.

- Los **pasos** (leídos de Health Connect) hacen avanzar tu posición por la ruta, con distancia real (2.865 km).
- Las **misiones diarias** (ejercicio, inglés, chino, lectura, agua) dan XP y niveles.
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
