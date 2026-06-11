-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  UTE ESCOBEDO – ESQUEMA DE BASE DE DATOS SEGURO                ║
-- ║  MySQL 8.0+  |  Proyecto Integrador  |  2026                  ║
-- ║  Modelo: Relacional normalizado (3FN)                          ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ── 1. CREAR BASE DE DATOS ────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS ute_mapa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ute_mapa;

-- ── 2. TIPOS DE EDIFICIO ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tipos_edificio (
  id        TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre    VARCHAR(30) NOT NULL UNIQUE  -- 'docencia' | 'taller' | 'servicio'
) ENGINE=InnoDB;

INSERT INTO tipos_edificio (nombre) VALUES ('docencia'),('taller'),('servicio');

-- ── 3. EDIFICIOS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS edificios (
  id              VARCHAR(5)  NOT NULL PRIMARY KEY,   -- D1, D2…D8, T1…T3
  nombre          VARCHAR(120) NOT NULL,
  tipo_id         TINYINT UNSIGNED NOT NULL,
  latitud         DECIMAL(10,7) NOT NULL,
  longitud        DECIMAL(10,7) NOT NULL,
  color_hex       CHAR(7)  NOT NULL DEFAULT '#F4821F',
  horario         VARCHAR(100),
  capacidad_total SMALLINT UNSIGNED DEFAULT 0,
  labs            SMALLINT UNSIGNED DEFAULT 0,
  aulas           SMALLINT UNSIGNED DEFAULT 0,
  salas           SMALLINT UNSIGNED DEFAULT 0,
  activo          TINYINT(1) NOT NULL DEFAULT 1,
  creado_en       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tipo_id) REFERENCES tipos_edificio(id) ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ── 4. CARRERAS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carreras (
  id        SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre    VARCHAR(120) NOT NULL UNIQUE,
  nivel     ENUM('TSU','Ingenieria','Licenciatura','Otro') DEFAULT 'TSU'
) ENGINE=InnoDB;

-- ── 5. EDIFICIO ↔ CARRERA (N:M) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS edificio_carrera (
  edificio_id VARCHAR(5)       NOT NULL,
  carrera_id  SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (edificio_id, carrera_id),
  FOREIGN KEY (edificio_id) REFERENCES edificios(id)  ON DELETE CASCADE,
  FOREIGN KEY (carrera_id)  REFERENCES carreras(id)   ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 6. MAESTROS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maestros (
  id          SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  iniciales   CHAR(3)      NOT NULL,
  especialidad VARCHAR(80),
  activo      TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- ── 7. MAESTRO ↔ EDIFICIO (N:M) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS maestro_edificio (
  maestro_id  SMALLINT UNSIGNED NOT NULL,
  edificio_id VARCHAR(5)        NOT NULL,
  PRIMARY KEY (maestro_id, edificio_id),
  FOREIGN KEY (maestro_id)  REFERENCES maestros(id)   ON DELETE CASCADE,
  FOREIGN KEY (edificio_id) REFERENCES edificios(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 8. GRUPOS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grupos (
  id          SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clave       VARCHAR(20) NOT NULL UNIQUE,   -- Ej: TIC-101
  carrera_id  SMALLINT UNSIGNED,
  edificio_id VARCHAR(5),
  cuatrimestre TINYINT UNSIGNED DEFAULT 1,
  activo      TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (carrera_id)  REFERENCES carreras(id),
  FOREIGN KEY (edificio_id) REFERENCES edificios(id)
) ENGINE=InnoDB;

-- ── 9. TRÁMITES POR EDIFICIO ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS tramites (
  id          SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  edificio_id VARCHAR(5)   NOT NULL,
  descripcion VARCHAR(100) NOT NULL,
  FOREIGN KEY (edificio_id) REFERENCES edificios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 10. TIPOS DE RUTA ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tipos_ruta (
  id     TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(20) NOT NULL UNIQUE  -- 'publica' | 'privada'
) ENGINE=InnoDB;

INSERT INTO tipos_ruta (nombre) VALUES ('publica'),('privada');

-- ── 11. RUTAS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rutas (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  tipo_id     TINYINT UNSIGNED NOT NULL,
  operador    VARCHAR(80),
  color_hex   CHAR(7) NOT NULL DEFAULT '#2E7D32',
  costo       VARCHAR(40),
  nota        TEXT,
  activa      TINYINT(1) NOT NULL DEFAULT 1,
  creado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tipo_id) REFERENCES tipos_ruta(id)
) ENGINE=InnoDB;

-- ── 12. HORARIOS DE RUTA ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS horarios_ruta (
  id       SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ruta_id  INT UNSIGNED NOT NULL,
  tipo     ENUM('entrada','salida') NOT NULL,
  hora     TIME NOT NULL,
  FOREIGN KEY (ruta_id) REFERENCES rutas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 13. PARADAS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS paradas (
  id        SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ruta_id   INT UNSIGNED NOT NULL,
  sentido   ENUM('ida','vuelta') NOT NULL,
  orden     TINYINT UNSIGNED NOT NULL,
  nombre    VARCHAR(100) NOT NULL,
  latitud   DECIMAL(10,7),
  longitud  DECIMAL(10,7),
  FOREIGN KEY (ruta_id) REFERENCES rutas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 14. MÉTODOS DE PAGO POR RUTA ─────────────────────────────────
CREATE TABLE IF NOT EXISTS metodos_pago (
  id          SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ruta_id     INT UNSIGNED NOT NULL,
  descripcion VARCHAR(60) NOT NULL,
  FOREIGN KEY (ruta_id) REFERENCES rutas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 15. COORDENADAS DE RUTA (polilínea) ──────────────────────────
CREATE TABLE IF NOT EXISTS coordenadas_ruta (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ruta_id   INT UNSIGNED NOT NULL,
  sentido   ENUM('ida','vuelta') NOT NULL,
  orden     SMALLINT UNSIGNED NOT NULL,
  latitud   DECIMAL(10,7) NOT NULL,
  longitud  DECIMAL(10,7) NOT NULL,
  FOREIGN KEY (ruta_id) REFERENCES rutas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 16. ROLES DE USUARIO ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id     TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(20) NOT NULL UNIQUE   -- visitor|student|employee|admin
) ENGINE=InnoDB;

INSERT INTO roles (nombre) VALUES ('visitor'),('student'),('employee'),('admin');

-- ── 17. USUARIOS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(80)  NOT NULL,
  email         VARCHAR(120) NOT NULL UNIQUE,
  -- BCrypt hash (factor 12+). NUNCA almacenar contraseña en texto plano.
  password_hash VARCHAR(255) NOT NULL,
  rol_id        TINYINT UNSIGNED NOT NULL DEFAULT 2,  -- student por defecto
  avatar        VARCHAR(5),
  activo        TINYINT(1)   NOT NULL DEFAULT 1,
  ultimo_login  TIMESTAMP    NULL,
  creado_en     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rol_id) REFERENCES roles(id)
) ENGINE=InnoDB;

-- ── 18. SESIONES (tokens de sesión, no cookies de texto plano) ────
CREATE TABLE IF NOT EXISTS sesiones (
  id           CHAR(64)    NOT NULL PRIMARY KEY,  -- SHA-256 token
  usuario_id   INT UNSIGNED NOT NULL,
  ip_origen    VARCHAR(45),   -- IPv4 o IPv6
  user_agent   VARCHAR(200),
  creado_en    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  expira_en    TIMESTAMP   NOT NULL,
  revocada     TINYINT(1)  NOT NULL DEFAULT 0,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_usuario (usuario_id),
  INDEX idx_expira  (expira_en)
) ENGINE=InnoDB;

-- ── 19. LOG DE AUDITORÍA ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auditoria (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT UNSIGNED,
  accion      VARCHAR(60) NOT NULL,   -- 'EDIT_EDIFICIO' | 'DELETE_RUTA' | ...
  tabla       VARCHAR(40),
  registro_id VARCHAR(20),
  detalle     JSON,
  ip_origen   VARCHAR(45),
  registrado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON SET NULL
) ENGINE=InnoDB;

-- ── 20. INTENTOS DE LOGIN (protección fuerza bruta) ───────────────
CREATE TABLE IF NOT EXISTS login_intentos (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(120) NOT NULL,
  ip_origen   VARCHAR(45)  NOT NULL,
  exitoso     TINYINT(1)   NOT NULL DEFAULT 0,
  creado_en   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_ip (email, ip_origen),
  INDEX idx_creado   (creado_en)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────────
-- DATOS INICIALES – Edificios
-- ─────────────────────────────────────────────────────────────────
INSERT INTO edificios (id, nombre, tipo_id, latitud, longitud, color_hex, horario, capacidad_total, labs, aulas, salas) VALUES
('T1','Taller T1 – QTA y Mantenimiento',   2, 25.8289500, -100.2864500,'#BF360C','Lun–Vie 7:00–20:00 h', 6, 3, 2, 1),
('T2','Taller T2 – Mantenimiento Industrial',2, 25.8301000,-100.2864500,'#4527A0','Lun–Vie 7:00–20:00 h', 4, 3, 1, 0),
('T3','Taller T3 – Mecatrónica',             2, 25.8312000,-100.2864500,'#1A237E','Lun–Vie 7:00–20:00 h', 4, 4, 0, 0),
('D1','D1 – Rectoría, Sec. Académica y Adm.',1, 25.8290500,-100.2848000,'#F4821F','Lun–Vie 8:00–20:00 h',10, 0, 6, 4),
('D8','D8 – Auditorio / Cafetería / Enfermería',3,25.8301000,-100.2842000,'#2E7D32','Lun–Vie 7:00–21:00 h', 5, 0, 2, 3),
('D2','D2 – Desarrollo de Negocios / Mercadotecnia',1,25.8293000,-100.2824000,'#1565C0','Lun–Vie 7:00–21:00 h',12, 2, 8, 2),
('D3','D3 – Vinculación / Mantenimiento / Caja',1,25.8301000,-100.2823500,'#00897B','Lun–Vie 7:00–21:00 h',14, 3, 9, 2),
('D4','D4 – Tecnologías de la Información',  1, 25.8308500,-100.2823500,'#6A1B9A','Lun–Vie 7:00–22:00 h',16, 6, 8, 2),
('D5','D5 – Mecatrónica Área Automatización',1, 25.8316500,-100.2830000,'#00838F','Lun–Vie 7:00–21:00 h',14, 5, 7, 2),
('D6','D6 – Servicios Escolares / Lengua Inglesa',1,25.8320000,-100.2821000,'#AD1457','Lun–Vie 7:00–21:00 h',12, 2, 8, 2),
('D7','D7 – Mecatrónica Área Auto. (T2)',    1, 25.8315000,-100.2821500,'#E65100','Lun–Vie 7:00–21:00 h',10, 4, 5, 1);

-- Admin demo (BCrypt hash de 'admin123' con factor 12 – REEMPLAZAR EN PROD)
INSERT INTO usuarios (nombre, email, password_hash, rol_id, avatar) VALUES
('Admin Sistema',   'admin@ute.edu.mx',  '$2b$12$PLACEHOLDER_HASH_ADMIN',  4, 'AS'),
('María Rodríguez', 'maria@ute.edu.mx',  '$2b$12$PLACEHOLDER_HASH_ALUMNO', 2, 'MR'),
('Carlos Empleado', 'carlos@ute.edu.mx', '$2b$12$PLACEHOLDER_HASH_EMP',    3, 'CE');
