package com.digitaltwin.alert_service.kafka;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SensorReadingEvent {

    @JsonProperty("sensorId")
    private String sensorId;

    @JsonProperty("sensorType")
    private String sensorType;

    @JsonProperty("label")
    private String label;

    @JsonProperty("ifcGlobalId")
    private String ifcGlobalId;

    @JsonProperty("roomName")
    private String roomName;

    @JsonProperty("unit")
    private String unit;

    @JsonProperty("value")
    private Double value;

    @JsonProperty("status")
    private String status;

    @JsonProperty("measuredAt")
    private Double measuredAt;

    // Méthodes utilitaires pour l'AlertEngine
    public String getEquipmentId() {
        return sensorId;
    }

    public String getMetricType() {
        return sensorType != null ? sensorType.toUpperCase() : null;
    }

    public Instant getTimestamp() {
        if (measuredAt == null) return Instant.now();
        return Instant.ofEpochSecond(measuredAt.longValue());
    }
}