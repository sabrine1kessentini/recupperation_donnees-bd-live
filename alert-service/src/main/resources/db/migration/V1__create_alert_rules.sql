-- =============================================
-- V1 : Table des règles d'alerte
-- =============================================
CREATE TABLE alert_rules (
    id               BIGSERIAL PRIMARY KEY,
    metric_type      VARCHAR(50)  NOT NULL,
    equipment_id     VARCHAR(100),
    threshold_min    DOUBLE PRECISION,
    threshold_max    DOUBLE PRECISION,
    severity         VARCHAR(20)  NOT NULL,
    message_template VARCHAR(255) NOT NULL,
    enabled          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- =============================================
-- Règles par défaut (seuil)
-- =============================================
INSERT INTO alert_rules (metric_type, threshold_max, severity, message_template) VALUES
    ('TEMPERATURE', 30.0,   'CRITICAL', 'Température critique : {value}°C sur équipement {equipmentId}'),
    ('TEMPERATURE', 25.0,   'MINOR',    'Température élevée : {value}°C sur équipement {equipmentId}'),
    ('CO2',         1000.0, 'MAJOR',    'CO2 élevé : {value} ppm sur équipement {equipmentId}'),
    ('ENERGY',      500.0,  'MAJOR',    'Surconsommation énergie : {value} kWh sur équipement {equipmentId}'),
    ('HUMIDITY',    80.0,   'MINOR',    'Humidité élevée : {value}% sur équipement {equipmentId}');

INSERT INTO alert_rules (metric_type, threshold_min, severity, message_template) VALUES
    ('TEMPERATURE', 10.0,   'MAJOR',    'Température trop basse : {value}°C sur équipement {equipmentId}'),
    ('HUMIDITY',    20.0,   'MINOR',    'Humidité trop basse : {value}% sur équipement {equipmentId}');
