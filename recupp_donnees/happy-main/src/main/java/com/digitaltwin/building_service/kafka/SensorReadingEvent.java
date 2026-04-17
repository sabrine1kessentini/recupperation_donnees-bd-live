package com.digitaltwin.building_service.kafka;

import java.time.Instant;

/**
 * Kafka message published for each sensor reading polled from the WaveOn API.
 * Topic: building.sensor.readings
 */
public record SensorReadingEvent(
        String sensorId,
        String sensorType,
        String label,
        String ifcGlobalId,
        String roomName,
        String unit,
        Double value,
        String status,
        Instant measuredAt
) {
}
