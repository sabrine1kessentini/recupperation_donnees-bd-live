package com.digitaltwin.alert_service.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.Instant;

/**
 * Règle d'alerte par seuil.
 * Exemples :
 *   TEMPERATURE > 30 → CRITICAL
 *   CO2 > 1000       → MAJOR
 *   HUMIDITY < 20    → MINOR
 */
@Data
@Entity
@Table(name = "alert_rules")
public class AlertRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Type de métrique ciblée (TEMPERATURE, CO2, ENERGY, HUMIDITY…) */
    @Column(name = "metric_type", nullable = false)
    private String metricType;

    /** Si null, la règle s'applique à tous les équipements */
    @Column(name = "equipment_id")
    private String equipmentId;

    /** Seuil minimum — alerte si value < thresholdMin */
    @Column(name = "threshold_min")
    private Double thresholdMin;

    /** Seuil maximum — alerte si value > thresholdMax */
    @Column(name = "threshold_max")
    private Double thresholdMax;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Severity severity;

    @Column(name = "message_template", nullable = false)
    private String messageTemplate;

    @Column(nullable = false)
    private Boolean enabled = true;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    // ------------------------------------------------------------------
    // Logique métier
    // ------------------------------------------------------------------

    /**
     * Vérifie si cette règle s'applique à l'event reçu.
     */
    public boolean matches(String eventEquipmentId, String eventMetricType, Double value) {
        // Filtre métrique
        if (!this.metricType.equalsIgnoreCase(eventMetricType)) return false;

        // Filtre équipement (si la règle est spécifique à un équipement)
        if (this.equipmentId != null && !this.equipmentId.equals(eventEquipmentId)) return false;

        // Vérification seuils
        if (thresholdMax != null && value > thresholdMax) return true;
        if (thresholdMin != null && value < thresholdMin) return true;

        return false;
    }

    /**
     * Génère le message de l'alerte en remplançant les variables dans le template.
     */
    public String buildMessage(String eqId, Double value) {
        return messageTemplate
            .replace("{value}", String.format("%.2f", value))
            .replace("{equipmentId}", eqId);
    }
}
