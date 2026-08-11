/**
 * UTE Escobedo – Utilidades + Datos + Persistencia v4.6
 * Incluye: $(), toast(), CAMPUS_CENTER, RUTAS_DATA, DB
 * Depende de: edificios.js (EDIFICIOS_DATA)
 *
 * 🛡️ Refactor v4.6:
 *   - var → const (funciones globales)
 *   - DB: try/catch en todos los accesos a localStorage
 *   - toast(): fallback si el contenedor no existe
 *   - Comentarios JSDoc
 */
'use strict';

/**
 * Selector rápido por ID.
 * @param {string} id — ID del elemento
 * @returns {HTMLElement|null}
 */
const $ = function(id) { return document.getElementById(id); };

/**
 * Muestra una notificación toast temporal.
 * @param {string} msg — Mensaje a mostrar
 * @param {'success'|'error'|'info'|'warn'} [type='info'] — Tipo de toast
 * @param {number} [dur=3200] — Duración en ms
 */
function toast(msg, type, dur) {
  type = type || 'info';
  dur = dur || 3200;
  const c = $('toast-c');
  if (!c) return; // Sin contenedor de toasts, no hacer nada
  const t = document.createElement('div');
  const icons = {
    success: 'fa-circle-check', error: 'fa-circle-xmark',
    info: 'fa-circle-info', warn: 'fa-triangle-exclamation'
  };
  t.className = 'toast ' + type;
  t.innerHTML = '<i class="fa-solid ' + (icons[type] || icons.info) + '"></i> ' + msg;
  c.appendChild(t);
  setTimeout(function() { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, Math.max(0, dur - 400));
  setTimeout(function() { t.remove(); }, dur);
}

/** Centro geométrico del campus (calculado promediando los 11 edificios). */
const CAMPUS_CENTER = { lat: 25.83010, lng: -100.27663 };

/* ═══════════════════════════════════════════════════
   RUTAS DE TRANSPORTE
   Ruta C4: La Unidad – Laredo – UTE (datos reales)
═══════════════════════════════════════════════════ */
const RUTAS_DATA = [
  {
    id: 'ruta-real-palmas', nombre: 'Real de Palmas – General Zuazua / UTE', tipo: 'privada',
    operador: 'Transporte Serrato', color: '#E65100', colorFondo: '#FBE9E7',
    horarios: { entrada: ['5:50'], salida: [] },
    costo: 'Consultar con operador',
    metodoPago: ['Efectivo', 'Transferencia'],
    nota: 'Servicio en camioneta tipo Van blanca. Contacto: José Juan Serrato Bustos – Cel. 8131732831. Estar 10 minutos antes.',
    paradas_ida: [
      '1. Panadería y pastelería La Suprema (5:50am)',
      '2. Primera Farmacia Guadalajara (5:53am)',
      '3. GM Super Carnes Zuazua (5:55am)',
      '4. 7-Eleven (6:00am)',
      '5. Bodega Aurrera Express (6:10am)',
      '6. Super Dim (6:15am)',
      '7. UTE (6:50am)',
    ],
    paradas_vuelta: [
      'UTE',
      'Super Dim',
      'Bodega Aurrera Express',
      '7-Eleven',
      'GM Super Carnes Zuazua',
      'Farmacia Guadalajara',
      'Panadería La Suprema',
    ],
    coords_ida: [[25.895, -100.155], [25.88418, -100.17527], [25.87337, -100.19554], [25.86255, -100.21581], [25.85173, -100.23609], [25.84092, -100.25636], [25.8301, -100.27663]],
    coords_vuelta: [[25.8301, -100.27663], [25.84092, -100.25636], [25.85173, -100.23609], [25.86255, -100.21581], [25.87337, -100.19554], [25.88418, -100.17527], [25.895, -100.155]]
  },
  {
    id: 'ruta-pilares-valles', nombre: 'Pilares Valles – Sector Montaña / UTE', tipo: 'privada',
    operador: 'TSA (Transporte y Servicios Santiago)', color: '#1565C0', colorFondo: '#E3F2FD',
    horarios: { entrada: ['5:40'], salida: [] },
    costo: 'Consultar con operador',
    metodoPago: ['Efectivo', 'Transferencia'],
    nota: 'Contacto: Ana Morales – Cel. 42-91-02-26-37. Estar 10 minutos antes de la hora marcada.',
    paradas_ida: [
      '1. Plaza Principal Salinas (5:40am)',
      '2. Firts Cash Calzada del Sol (5:50am)',
      '3. Cuarta Avenida y Calzada del Sol (5:52am)',
      '4. Cerradas Platinium (5:54am)',
      '5. Oxxo Av Cerro de la Silla y Marte (5:58am)',
      '6. Ofertón de Cantú (6:00am)',
      '7. Guadalajara en Rotonda (6:02am)',
      '8. Av Marte y Número 2 Salón Testigo de Geova (6:06am)',
      '9. Entrada Bosques Parabus (6:10am)',
      '10. Super y Carnicería Valle del Norte (6:12am)',
      '11. Segundo Oxxo en Rotonda Valle del Norte (6:14am)',
      '12. Paseo Santa Isabel (6:16am)',
      '13. Rotonda Fuentes de Castilla (6:18am)',
      '14. Sector Montaña (6:20am)',
      '15. Campus UTE (6:45am)',
    ],
    paradas_vuelta: [
      'UTE',
      'Sector Montaña',
      'Fuentes de Castilla',
      'Paseo Santa Isabel',
      'Oxxo Valle del Norte',
      'Carnicería Valle del Norte',
      'Bosques Parabus',
      'Av Marte',
      'Guadalajara Rotonda',
      'Ofertón de Cantú',
      'Oxxo Cerro de la Silla',
      'Cerradas Platinium',
      'Cuarta Avenida',
      'Firts Cash',
      'Plaza Principal Salinas',
    ],
    coords_ida: [[25.86, -100.32], [25.85786, -100.3169], [25.85573, -100.3138], [25.85359, -100.31071], [25.85146, -100.30761], [25.84932, -100.30451], [25.84719, -100.30141], [25.84505, -100.29832], [25.84291, -100.29522], [25.84078, -100.29212], [25.83864, -100.28902], [25.83651, -100.28592], [25.83437, -100.28283], [25.83224, -100.27973], [25.8301, -100.27663]],
    coords_vuelta: [[25.8301, -100.27663], [25.83224, -100.27973], [25.83437, -100.28283], [25.83651, -100.28592], [25.83864, -100.28902], [25.84078, -100.29212], [25.84291, -100.29522], [25.84505, -100.29832], [25.84719, -100.30141], [25.84932, -100.30451], [25.85146, -100.30761], [25.85359, -100.31071], [25.85573, -100.3138], [25.85786, -100.3169], [25.86, -100.32]]
  },
  {
    id: 'ruta-apodaca-mat', nombre: 'Apodaca Matutino – LBL / UTE', tipo: 'privada',
    operador: 'Transportes LBL', color: '#00838F', colorFondo: '#E0F7FA',
    horarios: { entrada: ['6:15'], salida: [] },
    costo: 'Consultar con operador',
    metodoPago: ['Efectivo', 'Transferencia'],
    nota: 'Contacto: Leonel Almaguer – Cel. 81-16-09-10-14. Estar 10 minutos antes.',
    paradas_ida: [
      '1. Gasolinera Santa Rosa y Américas (6:15am)',
      '2. H-E-B Concordia (6:18am)',
      '3. Smart Plaza Sitadina (6:21am)',
      '4. Mi Tienda Concordia y E Sexta (6:24am)',
      '5. Agua y Drenaje Av Concordia (6:28am)',
      '6. Walmart E Sexta (6:32am)',
      '7. Plaza Rotonda E Sexta y Estelaris (6:35am)',
      '8. Andrómeda enfrente de Super Nava (6:38am)',
      '9. Similares Andrómeda y Dione (6:40am)',
      '10. Campus UTE (6:45am)',
    ],
    paradas_vuelta: [
      'UTE',
      'Similares Andrómeda',
      'Super Nava Andrómeda',
      'Plaza Rotonda',
      'Walmart E Sexta',
      'Agua y Drenaje',
      'Mi Tienda Concordia',
      'Smart Plaza Sitadina',
      'H-E-B Concordia',
      'Gasolinera Santa Rosa',
    ],
    coords_ida: [[25.782, -100.188], [25.78734, -100.19785], [25.79269, -100.2077], [25.79803, -100.21754], [25.80338, -100.22739], [25.80872, -100.23724], [25.81407, -100.24709], [25.81941, -100.25693], [25.82476, -100.26678], [25.8301, -100.27663]],
    coords_vuelta: [[25.8301, -100.27663], [25.82476, -100.26678], [25.81941, -100.25693], [25.81407, -100.24709], [25.80872, -100.23724], [25.80338, -100.22739], [25.79803, -100.21754], [25.79269, -100.2077], [25.78734, -100.19785], [25.782, -100.188]]
  },
  {
    id: 'ruta-buena-vista-mat', nombre: 'Buena Vista Matutino – LBL / UTE', tipo: 'privada',
    operador: 'Transportes LBL', color: '#F4821F', colorFondo: '#FFF3E0',
    horarios: { entrada: ['5:40'], salida: [] },
    costo: 'Consultar con operador',
    metodoPago: ['Efectivo', 'Transferencia'],
    nota: 'Contacto: Alejandro Ortiz – Cel. 81-81-38-23-71. Regreso por Av. Águila Real, ya no por San Francisco de Asís.',
    paradas_ida: [
      '1. Guadalajara Rotonda Av Paraíso (5:40am)',
      '2. Mi Tienda Av Paraíso (5:42am)',
      '3. Bodeguita Express Av San Miguel y Grulla (5:45am)',
      '4. Pizza Regia Av Carpintero (5:50am)',
      '5. Oxxo Águila Real y Alcatraz (5:53am)',
      '6. Ferretería Águila Real y Ninfa (5:55am)',
      '7. Soriana Puerta Sol R Salinas y Las Torres (6:15am)',
      '8. Petro Seven R Salinas y Acueducto (6:20am)',
      '9. Parabus H-E-B Av Compostela (6:28am)',
      '10. Bodeguita Express Compostela y Juárez (6:30am)',
      '11. Campus UTE (6:55am)',
    ],
    paradas_vuelta: [
      'UTE',
      'Bodeguita Express Compostela',
      'Parabus H-E-B',
      'Petro Seven',
      'Soriana Puerta Sol',
      'Ferretería Águila Real',
      'Oxxo Águila Real',
      'Pizza Regia',
      'Bodeguita Express San Miguel',
      'Mi Tienda Paraíso',
      'Guadalajara Rotonda Paraíso',
    ],
    coords_ida: [[25.74, -100.36], [25.74901, -100.35166], [25.75802, -100.34333], [25.76703, -100.33499], [25.77604, -100.32665], [25.78505, -100.31831], [25.79406, -100.30998], [25.80307, -100.30164], [25.81208, -100.2933], [25.82109, -100.28497], [25.8301, -100.27663]],
    coords_vuelta: [[25.8301, -100.27663], [25.82109, -100.28497], [25.81208, -100.2933], [25.80307, -100.30164], [25.79406, -100.30998], [25.78505, -100.31831], [25.77604, -100.32665], [25.76703, -100.33499], [25.75802, -100.34333], [25.74901, -100.35166], [25.74, -100.36]]
  },
  {
    id: 'ruta-buena-vista-noc', nombre: 'Buena Vista Nocturno – LBL / UTE', tipo: 'privada',
    operador: 'Transportes LBL', color: '#6A1B9A', colorFondo: '#F3E5F5',
    horarios: { entrada: ['16:40'], salida: [] },
    costo: 'Consultar con operador',
    metodoPago: ['Efectivo', 'Transferencia'],
    nota: 'Contacto: Sr. Leonel Ruiz – Cel. 81-16-09-10-14. Turno vespertino/nocturno.',
    paradas_ida: [
      '1. Guadalajara Rotonda Av Paraíso (16:40)',
      '2. Mi Tienda Av Paraíso (16:42)',
      '3. Bodeguita Express Av San Miguel y Grulla (16:45)',
      '4. Pizza Regia Av Carpintero (16:50)',
      '5. Oxxo Águila Real y Alcatraz (16:53)',
      '6. Ferretería Águila Real y Ninfa (16:55)',
      '7. Soriana Puerta Sol R Salinas y Las Torres (17:15)',
      '8. Petro Seven R Salinas y Acueducto (17:20)',
      '9. Parabus H-E-B Av Compostela (17:28)',
      '10. Bodeguita Express Compostela y Juárez (17:30)',
      '11. Campus UTE (17:55)',
    ],
    paradas_vuelta: [
      'UTE',
      'Bodeguita Express Compostela',
      'Parabus H-E-B',
      'Petro Seven',
      'Soriana Puerta Sol',
      'Ferretería Águila Real',
      'Oxxo Águila Real',
      'Pizza Regia',
      'Bodeguita Express San Miguel',
      'Mi Tienda Paraíso',
      'Guadalajara Rotonda Paraíso',
    ],
    coords_ida: [[25.74, -100.36], [25.74901, -100.35166], [25.75802, -100.34333], [25.76703, -100.33499], [25.77604, -100.32665], [25.78505, -100.31831], [25.79406, -100.30998], [25.80307, -100.30164], [25.81208, -100.2933], [25.82109, -100.28497], [25.8301, -100.27663]],
    coords_vuelta: [[25.8301, -100.27663], [25.82109, -100.28497], [25.81208, -100.2933], [25.80307, -100.30164], [25.79406, -100.30998], [25.78505, -100.31831], [25.77604, -100.32665], [25.76703, -100.33499], [25.75802, -100.34333], [25.74901, -100.35166], [25.74, -100.36]]
  },
  {
    id: 'ruta-apodaca-noc', nombre: 'Apodaca Nocturno – LBL / UTE', tipo: 'privada',
    operador: 'Transportes LBL', color: '#1A237E', colorFondo: '#E8EAF6',
    horarios: { entrada: ['17:00'], salida: [] },
    costo: 'Consultar con operador',
    metodoPago: ['Efectivo', 'Transferencia'],
    nota: 'Contacto: Leonel Almaguer – Cel. 81-16-09-10-14. Turno nocturno. Inicia en Plaza Centro Apodaca.',
    paradas_ida: [
      '1. Plaza Centro Apodaca (17:00)',
      '2. Gasolinera Santa Rosa y Américas (17:10)',
      '3. H-E-B Concordia (17:14)',
      '4. Smart Plaza Sitadina (17:17)',
      '5. Mi Tienda Concordia y E Sexta (17:20)',
      '6. Walmart E Sexta (17:23)',
      '7. Plaza Rotonda E Sexta y Estelaris (17:25)',
      '8. Andrómeda enfrente de Super Nava (17:28)',
      '9. Similares Andrómeda y Dione (17:32)',
      '10. Campus UTE (17:45)',
    ],
    paradas_vuelta: [
      'UTE',
      'Similares Andrómeda',
      'Super Nava Andrómeda',
      'Plaza Rotonda',
      'Walmart E Sexta',
      'Mi Tienda Concordia',
      'Smart Plaza Sitadina',
      'H-E-B Concordia',
      'Gasolinera Santa Rosa',
      'Plaza Centro Apodaca',
    ],
    coords_ida: [[25.782, -100.188], [25.78734, -100.19785], [25.79269, -100.2077], [25.79803, -100.21754], [25.80338, -100.22739], [25.80872, -100.23724], [25.81407, -100.24709], [25.81941, -100.25693], [25.82476, -100.26678], [25.8301, -100.27663]],
    coords_vuelta: [[25.8301, -100.27663], [25.82476, -100.26678], [25.81941, -100.25693], [25.81407, -100.24709], [25.80872, -100.23724], [25.80338, -100.22739], [25.79803, -100.21754], [25.79269, -100.2077], [25.78734, -100.19785], [25.782, -100.188]]
  },
  {
    id: 'ruta-salinas-noc', nombre: 'Salinas Centro Nocturno – TSA / UTE', tipo: 'privada',
    operador: 'TSA (Transporte y Servicios Santiago)', color: '#4527A0', colorFondo: '#EDE7F6',
    horarios: { entrada: ['17:00'], salida: [] },
    costo: 'Consultar con operador',
    metodoPago: ['Efectivo', 'Transferencia'],
    nota: 'Contacto: Ana Morales – Cel. 42-91-02-26-37. Ingreso directo por Carretera a Salinas Victoria. Estar 10 minutos antes.',
    paradas_ida: [
      '1. Plaza Centro de Salinas (17:00)',
      '2. Frente al Firts Cash (17:05)',
      '3. Parabus Entrada Bosques de los Nogales (17:08)',
      '4. Entrada Valle del Norte (17:12)',
      '5. Campus UTE (17:45)',
    ],
    paradas_vuelta: [
      'UTE',
      'Valle del Norte',
      'Bosques de los Nogales',
      'Firts Cash',
      'Plaza Centro de Salinas',
    ],
    coords_ida: [[25.87, -100.305], [25.86003, -100.29791], [25.85005, -100.29082], [25.84008, -100.28372], [25.8301, -100.27663]],
    coords_vuelta: [[25.8301, -100.27663], [25.84008, -100.28372], [25.85005, -100.29082], [25.86003, -100.29791], [25.87, -100.305]]
  },
  {
    id: 'ruta-rsp-alcala-08', nombre: 'Real de Palmas – R.S.P. – Villas de Alcalá / UTE (Unidad 08 y 20)', tipo: 'privada',
    operador: 'Almanza Rodríguez Transportes', color: '#2E7D32', colorFondo: '#E8F5E9',
    horarios: { entrada: ['6:00'], salida: [] },
    costo: 'Consultar con operador',
    metodoPago: ['Efectivo'],
    nota: 'Contacto: Sr. Mario Almanza – Cel. 81-13-88-23-65. Estar 10 minutos antes.',
    paradas_ida: [
      '1. Parques (6:00am)',
      '2. Bodega Ex Quemada (6:03am)',
      '3. Préstamo Salinas (6:05am)',
      '4. 2da Guadalajara Toma de Agua (6:07am)',
      '5. Seven de la GM (6:09am)',
      '6. Préstamo Express (6:11am)',
      '7. Ex Merco Parabus (6:13am)',
      '8. Mi Tienda Parabus (6:15am)',
      '9. Primer Six R.S.P. (6:17am)',
      '10. Primer Oxxo R.S.P (6:18am)',
      '11. Paletería a lado de la Guadalajara R.S.P. (6:20am)',
      '12. Portal de Alcalá (6:25am)',
      '13. UTE (6:45am)',
    ],
    paradas_vuelta: [
      'UTE',
      'Portal de Alcalá',
      'Paletería Guadalajara RSP',
      'Oxxo RSP',
      'Six RSP',
      'Mi Tienda Parabus',
      'Ex Merco',
      'Préstamo Express',
      'Seven de la GM',
      'Guadalajara Toma de Agua',
      'Préstamo Salinas',
      'Bodega Ex Quemada',
      'Parques',
    ],
    coords_ida: [[25.89, -100.32], [25.88501, -100.31639], [25.88002, -100.31277], [25.87503, -100.30916], [25.87003, -100.30554], [25.86504, -100.30193], [25.86005, -100.29832], [25.85506, -100.2947], [25.85007, -100.29109], [25.84508, -100.28747], [25.84008, -100.28386], [25.83509, -100.28024], [25.8301, -100.27663]],
    coords_vuelta: [[25.8301, -100.27663], [25.83509, -100.28024], [25.84008, -100.28386], [25.84508, -100.28747], [25.85007, -100.29109], [25.85506, -100.2947], [25.86005, -100.29832], [25.86504, -100.30193], [25.87003, -100.30554], [25.87503, -100.30916], [25.88002, -100.31277], [25.88501, -100.31639], [25.89, -100.32]]
  },
  {
    id: 'ruta-alcala-real-sol', nombre: 'Real de Palmas – Villas de Alcalá – Real del Sol / UTE (Unidad Blanca)', tipo: 'privada',
    operador: 'Almanza Rodríguez Transportes', color: '#00897B', colorFondo: '#E0F2F1',
    horarios: { entrada: ['5:45'], salida: [] },
    costo: 'Consultar con operador',
    metodoPago: ['Efectivo'],
    nota: 'Contacto: Sr. Mario Almanza – Cel. 81-13-88-23-65. Autobús blanco. Estar 5 minutos antes.',
    paradas_ida: [
      '1. Parques (5:45am)',
      '2. 2da Guadalajara (5:47am)',
      '3. Campo DIF (5:50am)',
      '4. Super 7 GM (5:51am)',
      '5. Exmerco (5:55am)',
      '6. Mi Tiendita (5:58am)',
      '7. Parabus Entrada R.S.P (6:00am)',
      '8. Bodega Aurrera V.A. (6:05am)',
      '9. Similares V.A (6:07am)',
      '10. 2da Bodega Aurrera V.A. (6:10am)',
      '11. Vendanova (6:15am)',
      '12. Oxxo Carrizal (6:20am)',
      '13. Oxxo Real del Sol (6:22am)',
      '14. Aceromex (6:25am)',
      '15. UTE (Llegada aprox. 6:45am)',
    ],
    paradas_vuelta: [
      'UTE',
      'Aceromex',
      'Oxxo Real del Sol',
      'Oxxo Carrizal',
      'Vendanova',
      '2da Bodega Aurrera',
      'Similares',
      'Bodega Aurrera V.A.',
      'Parabus RSP',
      'Mi Tiendita',
      'Exmerco',
      'Super 7 GM',
      'Campo DIF',
      '2da Guadalajara',
      'Parques',
    ],
    coords_ida: [[25.89, -100.32], [25.88572, -100.3169], [25.88144, -100.3138], [25.87716, -100.31071], [25.87289, -100.30761], [25.86861, -100.30451], [25.86433, -100.30141], [25.86005, -100.29832], [25.85577, -100.29522], [25.85149, -100.29212], [25.84721, -100.28902], [25.84294, -100.28592], [25.83866, -100.28283], [25.83438, -100.27973], [25.8301, -100.27663]],
    coords_vuelta: [[25.8301, -100.27663], [25.83438, -100.27973], [25.83866, -100.28283], [25.84294, -100.28592], [25.84721, -100.28902], [25.85149, -100.29212], [25.85577, -100.29522], [25.86005, -100.29832], [25.86433, -100.30141], [25.86861, -100.30451], [25.87289, -100.30761], [25.87716, -100.31071], [25.88144, -100.3138], [25.88572, -100.3169], [25.89, -100.32]]
  },
  {
    id: 'ruta-527', nombre: 'Ruta 527 Urbano – Fraustro / Apodaca / UTE', tipo: 'publica',
    operador: 'Muevo León / Ruta 527', color: '#2E7D32', colorFondo: '#E8F5E9',
    horarios: { entrada: ['6:00', '13:00', '20:30'], salida: ['14:20', '21:45'] },
    costo: 'Tarifa oficial estatal (~$15 MXN)',
    metodoPago: ['Efectivo', 'Tarjeta Feria', 'Tarjeta MeMuevo'],
    nota: 'Longitud: 36 km. 1 unidad asignada. Pasa por Apodaca Centro, Miguel Alemán, Carretera a Monclova.',
    paradas_ida: [
      '1. Caseta Centro de Apodaca',
      '2. Av. Miguel Alemán',
      '3. Ignacio Aldama',
      '4. San Francisco',
      '5. Garza García',
      '6. Salinas de Gortari',
      '7. Ignacio Zaragoza',
      '8. Benito Cantú Garza',
      '9. Andrómeda',
      '10. Carretera a Monclova',
      '11. Libramiento Noreste',
      '12. UTE',
    ],
    paradas_vuelta: [
      'UTE',
      'Libramiento Noreste',
      'Carretera a Monclova',
      'Andrómeda',
      'Benito Cantú Garza',
      'Ignacio Zaragoza',
      'Salinas de Gortari',
      'Garza García',
      'San Francisco',
      'Ignacio Aldama',
      'Av. Miguel Alemán',
      'Caseta Centro de Apodaca',
    ],
    coords_ida: [[25.782, -100.188], [25.78637, -100.19606], [25.79075, -100.20411], [25.79512, -100.21217], [25.79949, -100.22023], [25.80386, -100.22829], [25.80824, -100.23634], [25.81261, -100.2444], [25.81698, -100.25246], [25.82135, -100.26052], [25.82573, -100.26857], [25.8301, -100.27663]],
    coords_vuelta: [[25.8301, -100.27663], [25.82573, -100.26857], [25.82135, -100.26052], [25.81698, -100.25246], [25.81261, -100.2444], [25.80824, -100.23634], [25.80386, -100.22829], [25.79949, -100.22023], [25.79512, -100.21217], [25.79075, -100.20411], [25.78637, -100.19606], [25.782, -100.188]]
  },
  {
    id: 'ruta-c4', nombre: 'C4 – La Unidad / Carretera Laredo / UTE', tipo: 'publica',
    operador: 'Muevo León / Instituto de Movilidad', color: '#2E7D32', colorFondo: '#E8F5E9',
    horarios: { entrada: ['7:00', '18:00'], salida: ['14:20', '21:45'] },
    costo: 'Tarifa oficial estatal',
    metodoPago: ['Efectivo', 'Tarjeta MeMuevo'],
    nota: 'Longitud: 46 km. Cubre zonas de Monterrey, Escobedo y Apodaca.',
    paradas_ida: [
      '1. Avenida La Unidad (inicio)',
      '2. Antiguo Camino a San Agustín',
      '3. Avenida Agualeguas',
      '4. Avenida Monterrey',
      '5. Calle de las Águilas',
      '6. Santa Engracia',
      '7. Libramiento Noreste',
      '8. Carretera a Monclova',
      '9. Carretera a Colombia',
      '10. Antiguo Camino a San José de los Sauces',
      '11. Carretera Monclova',
      '12. Carretera Laredo',
      '13. UTE',
    ],
    paradas_vuelta: [
      'UTE',
      'Libramiento',
      'Av. Santa Engracia (Camino a las Pedreras)',
      'Calle Las Águilas',
      'Av. La Unidad',
    ],
    coords_ida: [[25.782, -100.335], [25.78601, -100.33014], [25.79002, -100.32527], [25.79403, -100.32041], [25.79803, -100.31554], [25.80204, -100.31068], [25.80605, -100.30581], [25.81006, -100.30095], [25.81407, -100.29609], [25.81808, -100.29122], [25.82208, -100.28636], [25.82609, -100.28149], [25.8301, -100.27663]],
    coords_vuelta: [[25.8301, -100.27663], [25.82609, -100.28149], [25.82208, -100.28636], [25.81808, -100.29122], [25.81407, -100.29609], [25.81006, -100.30095], [25.80605, -100.30581], [25.80204, -100.31068], [25.79803, -100.31554], [25.79403, -100.32041], [25.79002, -100.32527], [25.78601, -100.33014], [25.782, -100.335]]
  },
  {
    id: 'ruta-pilares', nombre: 'Ruta 1 – Pilares / Clínica 6 / UTE', tipo: 'publica',
    operador: 'Muevo León / Ruta 1', color: '#6A1B9A', colorFondo: '#F3E5F5',
    horarios: { entrada: [], salida: [] },
    costo: 'Tarifa oficial estatal',
    metodoPago: ['Efectivo', 'Tarjeta MeMuevo'],
    nota: 'Circuito continuo con frecuencia de 40 min a 1 hora.',
    paradas_ida: [
      '1. Caseta Ruta 1 (Av. Universidad)',
      '2. 1ra Parada Julio Cepeda (Sendero)',
      '3. Carretera Laredo',
      '4. Puente Caracol',
      '5. Libramiento Noreste',
      '6. UTE',
    ],
    paradas_vuelta: [
      'UTE',
      'Libramiento Puente frente UTE',
      'Carretera Laredo',
      'Av. Sendero',
      'Av. Universidad (Clínica 6)',
      'Caseta Ruta 1',
    ],
    coords_ida: [[25.755, -100.29], [25.77002, -100.28733], [25.78504, -100.28465], [25.80006, -100.28198], [25.81508, -100.2793], [25.8301, -100.27663]],
    coords_vuelta: [[25.8301, -100.27663], [25.81508, -100.2793], [25.80006, -100.28198], [25.78504, -100.28465], [25.77002, -100.28733], [25.755, -100.29]]
  },
  {
    id: 'ruta-alcala', nombre: 'Villas de Alcalá – Real San Pedro / UTE', tipo: 'privada',
    operador: 'Sr. Cipriano Avalos', color: '#C62828', colorFondo: '#FFEBEE',
    horarios: { entrada: ['6:00'], salida: [] },
    costo: 'Consultar con operador',
    metodoPago: ['Efectivo'],
    nota: 'Contacto: Sr. Cipriano Avalos – Cel. 81-36-03-62-04. Estar 10 minutos antes de la hora marcada.',
    paradas_ida: [
      '1. Tortillería Clarita (6:00am)',
      '2. Pizzas (6:01am)',
      '3. Toldo Rojo (6:02am)',
      '4. Portal de Alcalá (6:05am)',
      '5. Bodega Aurrera (6:07am)',
      '6. Six 1er Sector (6:08am)',
      '7. Oxxo Olimpia (6:20am)',
      '8. UTE (7:00am)',
    ],
    paradas_vuelta: [
      'UTE',
      'Oxxo Olimpia',
      'Six 1er Sector',
      'Bodega Aurrera',
      'Portal de Alcalá',
      'Toldo Rojo',
      'Pizzas',
      'Tortillería Clarita',
    ],
    coords_ida: [[25.788, -100.298], [25.79401, -100.29495], [25.80003, -100.29189], [25.80604, -100.28884], [25.81206, -100.28579], [25.81807, -100.28274], [25.82409, -100.27968], [25.8301, -100.27663]],
    coords_vuelta: [[25.8301, -100.27663], [25.82409, -100.27968], [25.81807, -100.28274], [25.81206, -100.28579], [25.80604, -100.28884], [25.80003, -100.29189], [25.79401, -100.29495], [25.788, -100.298]]
  }
];

/* ═══════════════════════════════════════════════════
   PERSISTENCIA — localStorage con try/catch
   + sincronización con backend MySQL via API
   en todas las operaciones para evitar errores
   silenciosos si el storage está lleno o ausente
═══════════════════════════════════════════════════ */

/**
 * Módulo de base de datos híbrida (localStorage + API REST).
 * - Lectura: localStorage (cache) → fallback a datos hardcodeados
 * - Escritura: localStorage + API (fire-and-forget, no bloquea UI)
 * - init(): carga datos frescos desde el backend al iniciar
 *
 * El backend se llama en segundo plano; si falla, la app
 * sigue funcionando 100% offline con datos locales.
 */
const DB = {
  /** Flag para saber si ya se inicializó desde el backend */
  _inicializado: false,

  /**
   * Lee una clave de localStorage con fallback.
   * @param {string} k — clave
   * @param {*} fallback — valor por defecto si no existe o hay error
   * @returns {*}
   */
  _get(k, fallback) {
    try {
      const s = localStorage.getItem(k);
      return s ? JSON.parse(s) : fallback;
    } catch (e) {
      console.warn('DB._get falló para ' + k + ':', e);
      return fallback;
    }
  },

  /**
   * Escribe una clave en localStorage.
   * @param {string} k — clave
   * @param {*} v — valor (se serializa a JSON)
   */
  _set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); }
    catch (e) { console.warn('DB._set falló para ' + k + ':', e); }
  },

  /**
   * Inicializa la caché local desde el backend MySQL.
   * Se llama UNA vez al cargar la página. Si el backend no responde,
   * se usan los datos locales existentes o los predeterminados.
   * @returns {Promise<void>}
   */
  async init() {
    if (this._inicializado) return;
    this._inicializado = true;

    // Cargar edificios desde backend
    try {
      const backendOk = await API.isBackendAvailable();
      if (backendOk) {
        const edificios = await API.getEdificios();
        if (edificios && edificios.length > 0) {
          // Enriquecer con datos locales (carreras, maestros, grupos, tramites, areas)
          const fallback = EDIFICIOS_DATA;
          const enriched = edificios.map(function(e) {
            const fb = fallback.find(function(f) { return f.id === e.id; });
            // Siempre asignar defaults para evitar crashes en cascada
            e.carreras = (fb && fb.carreras) || [];
            e.areas = (fb && fb.areas) || [];
            e.maestros = (fb && fb.maestros) || [];
            e.grupos = (fb && fb.grupos) || [];
            e.tramites = (fb && fb.tramites) || [];
            return e;
          });
          this._set('ute_edificios', enriched);
          console.log('✅ Edificios cargados desde MySQL (' + enriched.length + ')');
        }

        const rutas = await API.getRutas();
        if (rutas && rutas.length > 0) {
          this._set('ute_rutas', rutas);
          console.log('✅ Rutas cargadas desde MySQL (' + rutas.length + ')');
        }
      }
    } catch (e) {
      console.warn('⚠️ Backend no disponible, usando datos locales:', e.message);
    }
  },

  /** @returns {Array} Lista de edificios desde caché local o datos predeterminados */
  getEdificios() { return this._get('ute_edificios', EDIFICIOS_DATA); },

  /**
   * Guarda la lista de edificios en localStorage y envía al backend.
   * La llamada al backend es asíncrona (fire-and-forget) para no bloquear la UI.
   * @param {Array} d — Lista completa de edificios
   */
  saveEdificios(d) {
    this._set('ute_edificios', d);
    // Sincronizar con backend en segundo plano
    this._syncEdificios(d);
  },

  /**
   * Envía cambios de edificios al backend (uno por uno).
   * Solo envía los campos que el backend acepta.
   * @param {Array} d — Lista completa de edificios
   */
  async _syncEdificios(d) {
    try {
      const backendOk = await API.isBackendAvailable();
      if (!backendOk) return;
      for (let i = 0; i < d.length; i++) {
        const e = d[i];
        try {
          await API.updateEdificio(e.id, {
            nombre: e.nombre,
            horario: e.horario,
            salones: e.salones ? e.salones.total : undefined,
            lat: e.lat,
            lng: e.lng
          });
        } catch (err) {
          console.warn('DB._syncEdificios: error al guardar ' + e.id + ':', err.message);
        }
      }
    } catch (_) { /* backend no disponible, no pasa nada */ }
  },

  /** @returns {Array} Lista de rutas desde caché local o datos predeterminados */
  getRutas() { return this._get('ute_rutas', RUTAS_DATA); },

  /**
   * Guarda la lista de rutas en localStorage.
   * Las rutas no tienen endpoint de escritura en el backend actual,
   * pero se mantiene el localStorage como caché.
   * @param {Array} d — Lista completa de rutas
   */
  saveRutas(d) { this._set('ute_rutas', d); },

  /** Restaura todos los datos a sus valores predeterminados */
  resetAll() {
    try {
      localStorage.removeItem('ute_edificios');
      localStorage.removeItem('ute_rutas');
    } catch {}
  }
};
