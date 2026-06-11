/**
 * UTE Escobedo – Datos de Edificios del Campus v4.3
 * Coordenadas actualizadas por el administrador
 * 11 edificios: D1-D8, T1-T3
 */
'use strict';

const EDIFICIOS_DATA = [
  // ─── TALLERES (columna oeste) ───
  {
    id:'T1', nombre:'Taller T1 – QTA y Mantenimiento', tipo:'taller',
    lat:25.829909, lng:-100.278461, color:'#BF360C',
    carreras:['QTA (Química, Tecnología y Ambiente)','Mantenimiento Industrial'],
    areas:['Taller QTA','Laboratorio de Química','Área de Mantenimiento Industrial'],
    maestros:[{ini:'BC',nombre:'Ing. Beatriz Campos – QTA'},{ini:'OS',nombre:'Ing. Omar Serna – Mantenimiento'}],
    grupos:['QTA-101','QTA-201','MAN-102'],
    tramites:['Uso de laboratorio químico','Equipos de seguridad','Préstamo de herramientas'],
    salones:{total:6,labs:3,aulas:2,salas:1}, horario:'Lun–Vie 7:00–20:00 h'
  },{
    id:'T2', nombre:'Taller T2 – Mantenimiento Industrial', tipo:'taller',
    lat:25.829078, lng:-100.278423, color:'#4527A0',
    carreras:['Mantenimiento Industrial Área Manufactura'],
    areas:['Taller CNC','Taller de Soldadura','Área de Manufactura'],
    maestros:[{ini:'RP',nombre:'Ing. Rodrigo Pérez – CNC'},{ini:'GL',nombre:'Téc. Gustavo Luna – Soldadura'}],
    grupos:['MAN-201B','MAN-301B','CNC-101'],
    tramites:['Uso de equipos CNC','Taller de soldadura','Proyectos manufactura'],
    salones:{total:4,labs:3,aulas:1,salas:0}, horario:'Lun–Vie 7:00–20:00 h'
  },{
    id:'T3', nombre:'Taller T3 – Mecatrónica', tipo:'taller',
    lat:25.830372, lng:-100.277758, color:'#1A237E',
    carreras:['Mecatrónica – Área Práctica','Proyectos de Robótica'],
    areas:['Taller de Robótica','Área de PLCs','Lab. de Sensores'],
    maestros:[{ini:'NF',nombre:'Dr. Nicolás Flores – Robótica'},{ini:'KC',nombre:'Ing. Karen Castro – PLCs'}],
    grupos:['ROB-101','PLC-101','MEC-LAB'],
    tramites:['Uso de robots','Préstamo de kits electrónicos'],
    salones:{total:4,labs:4,aulas:0,salas:0}, horario:'Lun–Vie 7:00–20:00 h'
  },
  // ─── ZONA CENTRO ───
  {
    id:'D1', nombre:'D1 – Rectoría, Sec. Académica y Administración', tipo:'docencia',
    lat:25.829213, lng:-100.277678, color:'#F4821F',
    carreras:['Rectoría','Secretaría Académica','Administración General'],
    areas:['Dirección General','Secretaría Académica','Planeación','RR.HH.','Caja'],
    maestros:[{ini:'RG',nombre:'M.A. Roberto Garza – Rector'},{ini:'SA',nombre:'Lic. Sandra Alvarado – Sec. Académica'},{ini:'PL',nombre:'M.C. Pedro Luna – Planeación'}],
    grupos:['Área Administrativa'],
    tramites:['Cartas de presentación','Constancias oficiales','Titulación general','Vinculación empresarial','Pago de servicios'],
    salones:{total:10,labs:0,aulas:6,salas:4}, horario:'Lun–Vie 8:00–20:00 h'
  },{
    id:'D8', nombre:'D8 – Auditorio / Cafetería / Enfermería', tipo:'servicio',
    lat:25.830469, lng:-100.276954, color:'#2E7D32',
    carreras:['Área de servicios estudiantiles'],
    areas:['Auditorio Principal','Cafetería Central','Enfermería','Servicios Estudiantiles','Depto. de Deportes'],
    maestros:[{ini:'MZ',nombre:'Lic. Mariana López – Orientación'},{ini:'VE',nombre:'Enf. Verónica Estrada – Enfermería'}],
    grupos:['Servicios generales'],
    tramites:['Atención médica','Reserva de auditorio','Trámites de deportes','Orientación educativa'],
    salones:{total:5,labs:0,aulas:2,salas:3}, horario:'Lun–Vie 7:00–21:00 h | Enfermería 7:00–20:00 h'
  },
  // ─── COLUMNA DERECHA (este) ───
  {
    id:'D2', nombre:'D2 – Desarrollo de Negocios / Mercadotecnia', tipo:'docencia',
    lat:25.829547, lng:-100.275291, color:'#1565C0',
    carreras:['Desarrollo de Negocios Área Mercadotecnia','TSU en Administración'],
    areas:['Coordinación de Negocios','Aulas de Mercadotecnia','Lab. de Marketing Digital'],
    maestros:[{ini:'MH',nombre:'M.B.A. Marcos Hernández'},{ini:'LT',nombre:'Lic. Laura Torres'},{ini:'JV',nombre:'Mtro. Juan Valdés'}],
    grupos:['NEG-101','NEG-201','MKT-101','MKT-201','ADM-101'],
    tramites:['Kardex','Cambio de carrera','Trámites de beca'],
    salones:{total:12,labs:2,aulas:8,salas:2}, horario:'Lun–Vie 7:00–21:00 h'
  },{
    id:'D3', nombre:'D3 – Vinculación / Mantenimiento / Estadías y Caja', tipo:'docencia',
    lat:25.829426, lng:-100.276444, color:'#00897B',
    carreras:['Vinculación Empresarial','Carrera Mantenimiento Área Industrial','Estadías y Caja'],
    areas:['Depto. de Vinculación','Caja General','Control de Estadías','Mantenimiento Industrial'],
    maestros:[{ini:'EG',nombre:'Ing. Eduardo González – Vinculación'},{ini:'RC',nombre:'Ing. Roberto Cruz – Mantenimiento'},{ini:'AM',nombre:'Lic. Ana Mora – Estadías'}],
    grupos:['MAN-101','MAN-201','MAN-301','VIN-101'],
    tramites:['Carta de estadía','Pago de colegiaturas','Convenios empresariales','Solicitud de vinculación'],
    salones:{total:14,labs:3,aulas:9,salas:2}, horario:'Lun–Vie 7:00–21:00 h | Caja 8:00–19:00 h'
  },{
    id:'D4', nombre:'D4 – Tecnologías de la Información', tipo:'docencia',
    lat:25.830165, lng:-100.275178, color:'#6A1B9A',
    carreras:['Carrera Tecnologías de la Información','Redes Digitales'],
    areas:['Lab. de Redes','Lab. de Cómputo A','Lab. Cómputo B','Sala de Servidores'],
    maestros:[{ini:'CM',nombre:'Ing. Carlos Muñoz – TIC'},{ini:'DT',nombre:'M.Sc. Daniela Torres – Redes'},{ini:'FS',nombre:'Ing. Felipe Soto – Cómputo'}],
    grupos:['TIC-101','TIC-201','TIC-301','RED-101','RED-201'],
    tramites:['Uso de laboratorio','Credencial de acceso TI','Proyectos de titulación'],
    salones:{total:16,labs:6,aulas:8,salas:2}, horario:'Lun–Vie 7:00–22:00 h | Sáb 8:00–14:00 h'
  },{
    id:'D5', nombre:'D5 – Mecatrónica Área Automatización', tipo:'docencia',
    lat:25.830845, lng:-100.275956, color:'#00838F',
    carreras:['Carrera Mecatrónica Área Automatización','Ing. en Mecatrónica'],
    areas:['Lab. de Automatización','Lab. de Control','Sala de Proyectos Mecatrónicos'],
    maestros:[{ini:'HM',nombre:'Dr. Héctor Montoya – Mecatrónica'},{ini:'LV',nombre:'M.C. Laura Vázquez – Automatización'},{ini:'AE',nombre:'Ing. Arturo Estrada – Control'}],
    grupos:['MEC-101','MEC-201','MEC-301','AUT-101','AUT-201'],
    tramites:['Lab. automatización','Proyectos IoT','Equipos de préstamo'],
    salones:{total:14,labs:5,aulas:7,salas:2}, horario:'Lun–Vie 7:00–21:00 h'
  },{
    id:'D6', nombre:'D6 – Servicios Escolares / Lengua Inglesa', tipo:'docencia',
    lat:25.831377, lng:-100.275634, color:'#AD1457',
    carreras:['Servicios Escolares','Carrera de Lengua Inglesa'],
    areas:['Control Escolar','Servicios Escolares','Lab. de Idiomas A','Lab. de Idiomas B'],
    maestros:[{ini:'PM',nombre:'Lic. Patricia Moreno – Control Escolar'},{ini:'JR',nombre:'M.Ed. José Ramírez – Idiomas'},{ini:'GF',nombre:'Lic. Gabriela Fuentes – Inglés'}],
    grupos:['ING-101','ING-201','ING-301','ING-401'],
    tramites:['Certificado de estudios','Historial académico','Reinscripción','Baja temporal','Titulación idiomas'],
    salones:{total:12,labs:2,aulas:8,salas:2}, horario:'Lun–Vie 7:00–21:00 h | Serv. Escolares 8:00–20:00 h'
  },{
    id:'D7', nombre:'D7 – Mecatrónica Área Automatización (T2)', tipo:'docencia',
    lat:25.830744, lng:-100.275194, color:'#E65100',
    carreras:['Carrera Mecatrónica Área Automatización (Turno 2)'],
    areas:['Aulas Mecatrónica','Lab. Electrónica','Lab. Hidráulica y Neumática'],
    maestros:[{ini:'EL',nombre:'Dr. Ernesto Leal – Automatización'},{ini:'MG',nombre:'M.C. Mario García – Electrónica'},{ini:'PH',nombre:'Ing. Patricia Hdez – Neumática'}],
    grupos:['MEC-102','MEC-202','MEC-302'],
    tramites:['Lab. electrónica','Equipos de préstamo mecatrónico'],
    salones:{total:10,labs:4,aulas:5,salas:1}, horario:'Lun–Vie 7:00–21:00 h'
  }
];
