package com.digitaltwin.alert_service.kafka;

import com.digitaltwin.alert_service.engine.AlertEngine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Consumer Kafka — groupe : alert-service-group
 * Chaque message reçu déclenche immédiatement l'évaluation des règles d'alerte.
 * Le polling est géré par Spring Kafka, pas par un scheduler manuel.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AlertConsumer {

    private final AlertEngine alertEngine;

    @KafkaListener(
        topics  = "${alert.kafka.topic}",
        groupId = "alert-service-group"
    )
    public void onSensorReading(SensorReadingEvent event) {
        log.debug("Event reçu → equipmentId={} | metricType={} | value={} {}",
                  event.getEquipmentId(),
                  event.getMetricType(),
                  event.getValue(),
                  event.getUnit());

        if (event.getEquipmentId() == null || event.getMetricType() == null || event.getValue() == null) {
            log.warn("Event invalide ignoré : {}", event);
            return;
        }

        alertEngine.evaluate(event);
    }
}
