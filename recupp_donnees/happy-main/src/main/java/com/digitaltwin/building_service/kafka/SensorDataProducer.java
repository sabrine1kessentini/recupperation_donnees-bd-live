package com.digitaltwin.building_service.kafka;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class SensorDataProducer {

    private static final Logger log = LoggerFactory.getLogger(SensorDataProducer.class);

    private final KafkaTemplate<String, SensorReadingEvent> kafkaTemplate;
    private final String topic;

    public SensorDataProducer(KafkaTemplate<String, SensorReadingEvent> kafkaTemplate,
                               @Value("${building.kafka.topic:building.sensor.readings}") String topic) {
        this.kafkaTemplate = kafkaTemplate;
        this.topic = topic;
    }

    public void send(SensorReadingEvent event) {
        kafkaTemplate.send(topic, event.sensorId(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to publish sensor reading sensorId={}: {}", event.sensorId(), ex.getMessage());
                    } else {
                        log.debug("Published sensor reading: sensorId={}, type={}, value={}",
                                event.sensorId(), event.sensorType(), event.value());
                    }
                });
    }
}
