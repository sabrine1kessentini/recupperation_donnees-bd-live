package com.digitaltwin.alert_service.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Alerte déclenchée et stockée en base.
 */
@Data
@Entity
@Table(name = "alerts")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Alert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "equipment_id", nullable = false)
    private String equipmentId;

    @Column(name = "metric_type", nullable = false)
    private String metricType;

    @Column(nullable = false)
    private Double value;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Severity severity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private AlertStatus status = AlertStatus.ACTIVE;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "rule_id")
    private Long ruleId;

    @Column(name = "triggered_at", nullable = false)
    @Builder.Default
    private Instant triggeredAt = Instant.now();

    @Column(name = "resolved_at")
    private Instant resolvedAt;
}
