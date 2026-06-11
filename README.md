# 🗺️ UTE Escobedo – Mapa Universitario Interactivo v4.2

## Novedades v4.2 (Junio 2026)
- **Iconos vectoriales**: Reemplazo de emojis por Font Awesome 6 Free para consistencia visual en cualquier navegador y sistema operativo.
- **Mapa mejor centrado**: El centro del campus se calculó geométricamente promediando las coordenadas de los 11 edificios (D1–D8, T1–T3).
- **Capa OSM de respaldo**: Nueva capa OpenStreetMap como alternativa libre que siempre funciona sin límites de API.
- **Compatibilidad cross-browser**: Mejoras para Safari, Firefox y Edge — soporte para scrollbar en Firefox, prevención de zoom en iOS, fallback de `gap` en Safari.
- **Estilos de impresión**: Al imprimir se ocultan las barras de navegación y se optimiza el contenido.
- **Demo colapsable**: Las credenciales de prueba en la página de login están ocultas por defecto (clic para expandir).

## Cómo usar
1. Abre la carpeta en VS Code
2. Clic derecho en `index.html` → **Open with Live Server**
3. Inicia sesión con las credenciales de prueba

## Credenciales de prueba
| Rol           | Email                   | Contraseña |
|---------------|-------------------------|------------|
| Administrador | admin@ute.edu.mx        | admin123   |
| Alumno        | maria@ute.edu.mx        | alumno123  |
| Empleado      | carlos@ute.edu.mx       | emp123     |
| Visitante     | (sin registro)          | —          |

## Estructura
```
ute_v4/
├── index.html          ← Login / Landing (abre esto primero)
├── css/
│   └── shared.css      ← Sistema de diseño compartido + Font Awesome
├── js/
│   ├── auth.js         ← Sistema de roles y sesión
│   └── data.js         ← Datos del campus (edificios, rutas)
├── pages/
│   ├── mapa.html       ← Mapa interactivo del campus
│   ├── rutas.html      ← Página de rutas de transporte
│   └── perfil.html     ← Perfil de usuario / permisos
├── admin/
│   └── index.html      ← Panel de administración + Editor de rutas
└── database/
    ├── schema.sql      ← Esquema MySQL 8.0 completo
    ├── security.sql    ← Guía de seguridad y usuarios BD
    └── api_backend.js  ← API REST en Node.js (producción)
```

## Coordenadas reales
- Campus UTE: 25.83044° N, 100.28352° O (centro geométrico calculado)
- Edificios: D1–D8, T1–T3 con posiciones reales del plano oficial

## Capas de mapa disponibles
| Capa | Descripción |
|------|-------------|
| CartoDB Voyager | Mapa limpio (predeterminado) |
| Google Calles | Mapa vial actualizado |
| Google Satélite | Imágenes satelitales reales |
| Google Híbrido ⭐ | Satélite + nombres de calles |
| Terreno | Relieve topográfico |
| OpenStreetMap | Respaldo libre (sin límites) |
| Dark Matter | Modo oscuro |

## Rutas incluidas
- **C4 – La Unidad / Laredo / UTE** (pública): Entrada 7:00 y 18:00 / Salida 14:20 y 21:45
- **Bus Escolar – Zona Sur**: $350 MXN/mes

## Características principales
- 🗺️ Mapa interactivo con 11 edificios geoposicionados
- 🔍 Búsqueda inteligente (Ctrl+K) por edificio, carrera, maestro o trámite
- 🚌 Rutas de transporte con horarios, paradas y métodos de pago
- 🌙 Modo oscuro automático con persistencia
- 👤 4 roles de usuario (Visitante, Alumno, Empleado, Administrador)
- 📱 Diseño responsive: desktop, tablet y móvil
- ⚙️ Panel de administración con editor de rutas sobre mapa
- 🖊️ Modo editor con arrastre de marcadores (admin)
- 🔗 Compartir edificios por URL
- 🕐 Estado en tiempo real de edificios (abierto/cerrado)
- 📋 Onboarding guiado para nuevos usuarios

## Notas
- Los datos se guardan en localStorage del navegador
- El admin puede crear nuevas rutas dibujando en el mapa
- Se requiere internet para cargar el mapa (Leaflet + tiles + Font Awesome)
- Para producción, configurar el backend Node.js en `database/api_backend.js`
