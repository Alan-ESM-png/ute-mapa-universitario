-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  UTE ESCOBEDO – GUÍA DE SEGURIDAD DE BASE DE DATOS            ║
-- ╚══════════════════════════════════════════════════════════════════╝

/*
═══════════════════════════════════════════════════════════════════
  1. USUARIOS DE BASE DE DATOS (Principio de mínimo privilegio)
═══════════════════════════════════════════════════════════════════
  Nunca uses el usuario root en producción.
  Crea usuarios específicos con sólo los permisos necesarios.
*/

-- Usuario de SOLO LECTURA (para visitantes/alumnos)
CREATE USER IF NOT EXISTS 'ute_reader'@'localhost'
  IDENTIFIED BY 'UteMapa2026!';

GRANT SELECT ON ute_mapa.edificios         TO 'ute_reader'@'localhost';
GRANT SELECT ON ute_mapa.carreras          TO 'ute_reader'@'localhost';
GRANT SELECT ON ute_mapa.rutas             TO 'ute_reader'@'localhost';
GRANT SELECT ON ute_mapa.paradas           TO 'ute_reader'@'localhost';
GRANT SELECT ON ute_mapa.coordenadas_ruta  TO 'ute_reader'@'localhost';
GRANT SELECT ON ute_mapa.horarios_ruta     TO 'ute_reader'@'localhost';
GRANT SELECT ON ute_mapa.tipos_edificio    TO 'ute_reader'@'localhost';
GRANT SELECT ON ute_mapa.tipos_ruta        TO 'ute_reader'@'localhost';
-- NO puede ver: usuarios, sesiones, auditoria, login_intentos

-- Usuario de APLICACIÓN (backend Node/PHP, lee y escribe datos del campus)
CREATE USER IF NOT EXISTS 'ute_app'@'localhost'
  IDENTIFIED BY 'UteMapa2026!';

GRANT SELECT, INSERT, UPDATE ON ute_mapa.edificios        TO 'ute_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON ute_mapa.carreras         TO 'ute_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON ute_mapa.rutas            TO 'ute_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON ute_mapa.paradas          TO 'ute_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON ute_mapa.coordenadas_ruta TO 'ute_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON ute_mapa.horarios_ruta    TO 'ute_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON ute_mapa.tramites         TO 'ute_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON ute_mapa.grupos           TO 'ute_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON ute_mapa.maestros         TO 'ute_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON ute_mapa.maestro_edificio TO 'ute_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON ute_mapa.edificio_carrera TO 'ute_app'@'localhost';
GRANT SELECT, INSERT        ON ute_mapa.sesiones          TO 'ute_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON ute_mapa.sesiones          TO 'ute_app'@'localhost';
GRANT SELECT, INSERT        ON ute_mapa.auditoria         TO 'ute_app'@'localhost';
GRANT SELECT, INSERT        ON ute_mapa.login_intentos    TO 'ute_app'@'localhost';
GRANT SELECT, UPDATE        ON ute_mapa.usuarios          TO 'ute_app'@'localhost';
GRANT SELECT                ON ute_mapa.roles             TO 'ute_app'@'localhost';
-- Vistas públicas (necesarias para GET /api/edificios y GET /api/rutas)
GRANT SELECT ON ute_mapa.v_edificios_publico TO 'ute_app'@'localhost';
GRANT SELECT ON ute_mapa.v_rutas_publico     TO 'ute_app'@'localhost';
-- Procedimientos almacenados (login y coordenadas)
GRANT EXECUTE ON PROCEDURE ute_mapa.sp_verificar_intentos_login  TO 'ute_app'@'localhost';
GRANT EXECUTE ON PROCEDURE ute_mapa.sp_actualizar_coordenadas    TO 'ute_app'@'localhost';
-- NO tiene DELETE en tablas críticas

-- Usuario de AUTENTICACIÓN (solo maneja login/usuarios)
CREATE USER IF NOT EXISTS 'ute_auth'@'localhost'
  IDENTIFIED BY 'UteMapa2026!';

GRANT SELECT, UPDATE         ON ute_mapa.usuarios       TO 'ute_auth'@'localhost';
GRANT SELECT, INSERT, UPDATE ON ute_mapa.sesiones       TO 'ute_auth'@'localhost';
GRANT SELECT, INSERT         ON ute_mapa.login_intentos TO 'ute_auth'@'localhost';
GRANT SELECT                 ON ute_mapa.roles          TO 'ute_auth'@'localhost';

FLUSH PRIVILEGES;

/*
═══════════════════════════════════════════════════════════════════
  2. VISTA PÚBLICA (expone solo lo necesario al frontend)
═══════════════════════════════════════════════════════════════════
*/
CREATE OR REPLACE VIEW v_edificios_publico AS
  SELECT
    e.id,
    e.nombre,
    t.nombre   AS tipo,
    e.latitud,
    e.longitud,
    e.color_hex,
    e.horario,
    e.capacidad_total AS salones_total,
    e.labs,
    e.aulas,
    e.salas
  FROM edificios e
  JOIN tipos_edificio t ON e.tipo_id = t.id
  WHERE e.activo = 1;

CREATE OR REPLACE VIEW v_rutas_publico AS
  SELECT
    r.id,
    r.nombre,
    tp.nombre AS tipo,
    r.operador,
    r.color_hex,
    r.costo,
    r.nota
  FROM rutas r
  JOIN tipos_ruta tp ON r.tipo_id = tp.id
  WHERE r.activa = 1;

/*
═══════════════════════════════════════════════════════════════════
  3. STORED PROCEDURE – Login seguro (con rate-limit en BD)
═══════════════════════════════════════════════════════════════════
*/
DELIMITER $$

CREATE PROCEDURE sp_verificar_intentos_login(
  IN  p_email     VARCHAR(120),
  IN  p_ip        VARCHAR(45),
  OUT p_bloqueado TINYINT
)
BEGIN
  DECLARE v_intentos INT;

  -- Contar intentos fallidos en los últimos 15 minutos
  SELECT COUNT(*) INTO v_intentos
  FROM login_intentos
  WHERE email     = p_email
    AND ip_origen = p_ip
    AND exitoso   = 0
    AND creado_en >= NOW() - INTERVAL 15 MINUTE;

  IF v_intentos >= 5 THEN
    SET p_bloqueado = 1;   -- Bloquear: demasiados intentos
  ELSE
    SET p_bloqueado = 0;
  END IF;
END$$

-- Procedimiento para actualizar coordenadas de un edificio con auditoría
CREATE PROCEDURE sp_actualizar_coordenadas(
  IN  p_edificio_id VARCHAR(5),
  IN  p_lat         DECIMAL(10,7),
  IN  p_lng         DECIMAL(10,7),
  IN  p_usuario_id  INT UNSIGNED,
  IN  p_ip          VARCHAR(45)
)
BEGIN
  DECLARE v_lat_old DECIMAL(10,7);
  DECLARE v_lng_old DECIMAL(10,7);

  -- Leer coordenadas anteriores
  SELECT latitud, longitud INTO v_lat_old, v_lng_old
  FROM edificios WHERE id = p_edificio_id;

  -- Actualizar
  UPDATE edificios
     SET latitud = p_lat, longitud = p_lng
   WHERE id = p_edificio_id;

  -- Registrar en auditoría
  INSERT INTO auditoria (usuario_id, accion, tabla, registro_id, detalle, ip_origen)
  VALUES (
    p_usuario_id,
    'UPDATE_COORDENADAS',
    'edificios',
    p_edificio_id,
    JSON_OBJECT(
      'lat_antes', v_lat_old, 'lng_antes', v_lng_old,
      'lat_nueva', p_lat,     'lng_nueva', p_lng
    ),
    p_ip
  );
END$$

DELIMITER ;

/*
═══════════════════════════════════════════════════════════════════
  4. ÍNDICES PARA PERFORMANCE Y SEGURIDAD
═══════════════════════════════════════════════════════════════════
*/
ALTER TABLE edificios        ADD INDEX idx_tipo    (tipo_id);
ALTER TABLE edificios        ADD INDEX idx_activo  (activo);
ALTER TABLE usuarios         ADD INDEX idx_email   (email);
ALTER TABLE usuarios         ADD INDEX idx_activo  (activo);
ALTER TABLE sesiones         ADD INDEX idx_token   (id);
ALTER TABLE auditoria        ADD INDEX idx_usuario (usuario_id);
ALTER TABLE auditoria        ADD INDEX idx_accion  (accion);
ALTER TABLE coordenadas_ruta ADD INDEX idx_ruta_sentido (ruta_id, sentido, orden);
ALTER TABLE paradas          ADD INDEX idx_ruta_sent    (ruta_id, sentido, orden);

/*
═══════════════════════════════════════════════════════════════════
  5. LIMPIEZA AUTOMÁTICA (EVENT SCHEDULER)
═══════════════════════════════════════════════════════════════════
*/
-- IMPORTANTE: Para que esto persista tras reiniciar MySQL, agregar tambien en my.cnf:
-- [mysqld]
-- event_scheduler = ON
SET GLOBAL event_scheduler = ON;

-- Limpiar sesiones expiradas cada hora
CREATE EVENT IF NOT EXISTS ev_limpiar_sesiones
  ON SCHEDULE EVERY 1 HOUR
  DO DELETE FROM sesiones WHERE expira_en < NOW() OR revocada = 1;

-- Limpiar intentos de login de más de 24h
CREATE EVENT IF NOT EXISTS ev_limpiar_intentos
  ON SCHEDULE EVERY 6 HOUR
  DO DELETE FROM login_intentos WHERE creado_en < NOW() - INTERVAL 24 HOUR;
