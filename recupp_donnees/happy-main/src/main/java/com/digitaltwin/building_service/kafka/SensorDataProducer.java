package com.digitaltwin.building_service.kafka;

import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class SensorDataProducer {

    private final KafkaTemplate<String, SensorReadingEvent> kafkaTemplate;

    @Value("${building.kafka.topic:building.sensor.readings}")
    private String topic;

    public void send(SensorReadingEvent event) {
        // ✅ Clé unique = sensorId + timestamp → force un nouveau message
        String key = event.sensorId() + "_" + Instant.now().toEpochMilli();

        kafkaTemplate.send(topic, key, event)
            .whenComplete((result, ex) -> {
                if (ex != null) {
                    log.error("Kafka send failed: {}", ex.getMessage());
                } else {
                    log.info("✅ Kafka ack: partition={} offset={}",
                        result.getRecordMetadata().partition(),
                        result.getRecordMetadata().offset());
                }
            });
    }
}