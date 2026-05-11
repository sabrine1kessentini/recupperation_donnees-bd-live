-- =============================================
-- V2 : Table des alertes déclenchées
-- =============================================
CREATE TABLE alerts (
    id           BIGSERIAL PRIMARY KEY,
    equipment_id VARCHAR(100) NOT NULL,
    metric_type  VARCHAR(50)  NOT NULL,
    value        DOUBLE PRECISION NOT NULL,
    severity     VARCHAR(20)  NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    message      TEXT         NOT NULL,
    rule_id      BIGINT       REFERENCES alert_rules(id),
    triggered_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    resolved_at  TIMESTAMP
);

CREATE INDEX idx_alerts_equipment   ON alerts(equipment_id);
CREATE INDEX idx_alerts_status      ON alerts(status);
CREATE INDEX idx_alerts_triggered   ON alerts(triggered_at DESC);
CREATE INDEX idx_alerts_severity    ON alerts(severity);
