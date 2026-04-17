package com.digitaltwin.building_service.kafka;

import com.digitaltwin.building_service.dto.RealtimeMeasurementDto;
import com.digitaltwin.building_service.service.WaveonFusionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/**
 * Scheduled poller: every N minutes, fetches the latest sensor readings
 * from the WaveOn API and publishes them to the Kafka topic.
 *
 * Only active when building.fusion-api.enabled=true.
 */
@Component
@ConditionalOnProperty(name = "building.fusion-api.enabled", havingValue = "true")
public class SensorPollingScheduler {

    private static final Logger log = LoggerFactory.getLogger(SensorPollingScheduler.class);

    private final WaveonFusionService fusionService;
    private final SensorDataProducer producer;

    public SensorPollingScheduler(WaveonFusionService fusionService, SensorDataProducer producer) {
        this.fusionService = fusionService;
        this.producer = producer;
    }

    @Scheduled(
            fixedDelayString = "${building.kafka.polling-interval-ms:300000}",
            initialDelayString = "${building.kafka.initial-delay-ms:15000}"
    )
    public void pollAndPublish() {
        log.info("Polling WaveOn sensor data...");
        try {
            // getRealtime(null) fetches the latest reading for every mapped sensor
            List<RealtimeMeasurementDto> measurements = fusionService.getRealtime(null);

            int published = 0;
            for (RealtimeMeasurementDto m : measurements) {
                if (m.value() == null) {
                    continue;
                }
                Instant measuredAt = m.timestamp() != null ? m.timestamp() : Instant.now();
                producer.send(new SensorReadingEvent(
                        m.sensorId(),
                        m.sensorType(),
                        m.label(),
                        m.ifcGlobalId(),
                        m.roomName(),
                        m.unit(),
                        m.value(),
                        m.status(),
                        measuredAt
                ));
                published++;
            }
            log.info("Published {}/{} sensor readings to Kafka", published, measurements.size());
        } catch (Exception e) {
            log.error("Polling failed: {}", e.getMessage());
        }
    }
}
