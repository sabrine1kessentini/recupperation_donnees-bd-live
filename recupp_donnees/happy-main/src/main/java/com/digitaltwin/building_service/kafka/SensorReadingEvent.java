package com.digitaltwin.building_service.kafka;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

/**
 * Kafka message published for each sensor reading polled from the WaveOn API.
 * Topic: building.sensor.readings
 */
@JsonIgnoreProperties(ignoreUnknown = true)
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
    private Instant measuredAt;

    public SensorReadingEvent() {
    }

    public SensorReadingEvent(String sensorId, String sensorType, String label, String ifcGlobalId,
                              String roomName, String unit, Double value, String status, Instant measuredAt) {
        this.sensorId = sensorId;
        this.sensorType = sensorType;
        this.label = label;
        this.ifcGlobalId = ifcGlobalId;
        this.roomName = roomName;
        this.unit = unit;
        this.value = value;
        this.status = status;
        this.measuredAt = measuredAt;
    }

    public String sensorId() { return sensorId; }
    public String sensorType() { return sensorType; }
    public String label() { return label; }
    public String ifcGlobalId() { return ifcGlobalId; }
    public String roomName() { return roomName; }
    public String unit() { return unit; }
    public Double value() { return value; }
    public String status() { return status; }
    public Instant measuredAt() { return measuredAt; }
}
