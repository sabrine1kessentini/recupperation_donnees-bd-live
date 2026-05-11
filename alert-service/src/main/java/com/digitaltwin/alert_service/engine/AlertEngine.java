package com.digitaltwin.alert_service.engine;

import com.digitaltwin.alert_service.kafka.SensorReadingEvent;
import com.digitaltwin.alert_service.model.*;
import com.digitaltwin.alert_service.repository.AlertRepository;
import com.digitaltwin.alert_service.repository.AlertRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Moteur d'évaluation des alertes.
 *
 * Flux :
 *   SensorReadingEvent (Kafka)
 *       → charger les règles actives pour ce metricType
 *       → pour chaque règle : vérifier si le seuil est dépassé
 *       → vérifier le cooldown (anti-spam)
 *       → créer et sauvegarder l'alerte
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AlertEngine {

    private final AlertRuleRepository ruleRepository;
    private final AlertRepository     alertRepository;

    @Value("${alert.cooldown.ms:600000}")
    private long cooldownMs;

    /**
     * Point d'entrée : évalue un event capteur contre toutes les règles actives.
     */
    @Transactional
    public void evaluate(SensorReadingEvent event) {
        List<AlertRule> rules =
            ruleRepository.findByMetricTypeIgnoreCaseAndEnabledTrue(event.getMetricType());

        if (rules.isEmpty()) {
            log.debug("Aucune règle active pour metricType={}", event.getMetricType());
            return;
        }

        for (AlertRule rule : rules) {
            if (rule.matches(event.getEquipmentId(), event.getMetricType(), event.getValue())) {

                if (isInCooldown(event.getEquipmentId(), rule.getId())) {
                    log.debug("Cooldown actif — alerte ignorée pour equipment={} ruleId={}",
                              event.getEquipmentId(), rule.getId());
                    continue;
                }

                createAlert(event, rule);
            }
        }
    }

    // ------------------------------------------------------------------
    // Privé
    // ------------------------------------------------------------------

    /**
     * Vérifie si une alerte similaire a déjà été créée récemment (cooldown).
     * Evite le spam : 1 alerte max par (equipmentId + ruleId) pendant cooldownMs.
     */
    private boolean isInCooldown(String equipmentId, Long ruleId) {
        return alertRepository
            .findTopByEquipmentIdAndRuleIdAndStatusOrderByTriggeredAtDesc(
                equipmentId, ruleId, AlertStatus.ACTIVE)
            .map(lastAlert -> {
                long elapsedMs = Instant.now().toEpochMilli()
                               - lastAlert.getTriggeredAt().toEpochMilli();
                return elapsedMs < cooldownMs;
            })
            .orElse(false);
    }

    /**
     * Crée, persiste et log l'alerte déclenchée.
     */
    private void createAlert(SensorReadingEvent event, AlertRule rule) {
        Alert alert = Alert.builder()
            .equipmentId(event.getEquipmentId())
            .metricType(event.getMetricType())
            .value(event.getValue())
            .severity(rule.getSeverity())
            .message(rule.buildMessage(event.getEquipmentId(), event.getValue()))
            .ruleId(rule.getId())
            .triggeredAt(Instant.now())
            .status(AlertStatus.ACTIVE)
            .build();

        alertRepository.save(alert);

        log.warn("🚨 ALERTE [{}] equipment={} | {}={} {} | {}",
                 alert.getSeverity(),
                 alert.getEquipmentId(),
                 alert.getMetricType(),
                 alert.getValue(),
                 event.getUnit() != null ? event.getUnit() : "",
                 alert.getMessage());
    }
}
