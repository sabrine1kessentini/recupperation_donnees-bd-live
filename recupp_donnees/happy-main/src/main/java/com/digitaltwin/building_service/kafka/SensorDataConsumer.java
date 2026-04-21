package com.digitaltwin.building_service.kafka;

import com.digitaltwin.building_service.domain.SensorMeasurement;
import com.digitaltwin.building_service.repository.SensorMeasurementRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Kafka consumer: persists every SensorReadingEvent to the sensor_measurements table.
 * Also broadcasts to WebSocket clients.
 */
@Component
public class SensorDataConsumer {

    private static final Logger log = LoggerFactory.getLogger(SensorDataConsumer.class);

    private final SensorMeasurementRepository repository;
    private final SimpMessagingTemplate messagingTemplate;

    public SensorDataConsumer(SensorMeasurementRepository repository, SimpMessagingTemplate messagingTemplate) {
        this.repository = repository;
        this.messagingTemplate = messagingTemplate;
    }

    @KafkaListener(
            topics = "${building.kafka.topic:building.sensor.readings}",
            groupId = "${spring.kafka.consumer.group-id:building-service-group}"
    )
    public void consume(SensorReadingEvent event) {
        log.debug("Received sensor reading: sensorId={}, type={}, value={}",
                event.sensorId(), event.sensorType(), event.value());
        try {
            SensorMeasurement measurement = new SensorMeasurement(
                    event.sensorId(),
                    event.sensorType(),
                    event.label(),
                    event.ifcGlobalId(),
                    event.roomName(),
                    event.unit(),
                    event.value(),
                    event.status(),
                    event.measuredAt(),
                    Instant.now()
            );
            repository.save(measurement);

            // Broadcast to WebSocket
            messagingTemplate.convertAndSend("/topic/sensor-readings", event);
            log.debug("Broadcast sensor reading via WebSocket: sensorId={}", event.sensorId());
        } catch (Exception e) {
            log.error("Failed to persist sensor measurement sensorId={}: {}", event.sensorId(), e.getMessage());
        }
    }
}
