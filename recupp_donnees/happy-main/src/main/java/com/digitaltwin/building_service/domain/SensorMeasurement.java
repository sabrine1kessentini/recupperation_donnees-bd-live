package com.digitaltwin.building_service.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "sensor_measurements", indexes = {
        @Index(name = "idx_sm_sensor_id", columnList = "sensorId"),
        @Index(name = "idx_sm_measured_at", columnList = "measuredAt"),
        @Index(name = "idx_sm_sensor_measured", columnList = "sensorId,measuredAt")
})
public class SensorMeasurement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String sensorId;

    @Column(nullable = false)
    private String sensorType;

    private String label;
    private String ifcGlobalId;
    private String roomName;
    private String unit;
    private Double value;
    private String status;

    @Column(nullable = false)
    private Instant measuredAt;

    @Column(nullable = false)
    private Instant recordedAt;

    public SensorMeasurement() {
    }

    public SensorMeasurement(String sensorId, String sensorType, String label,
                              String ifcGlobalId, String roomName, String unit,
                              Double value, String status, Instant measuredAt, Instant recordedAt) {
        this.sensorId = sensorId;
        this.sensorType = sensorType;
        this.label = label;
        this.ifcGlobalId = ifcGlobalId;
        this.roomName = roomName;
        this.unit = unit;
        this.value = value;
        this.status = status;
        this.measuredAt = measuredAt;
        this.recordedAt = recordedAt;
    }

    public Long getId() { return id; }
    public String getSensorId() { return sensorId; }
    public String getSensorType() { return sensorType; }
    public String getLabel() { return label; }
    public String getIfcGlobalId() { return ifcGlobalId; }
    public String getRoomName() { return roomName; }
    public String getUnit() { return unit; }
    public Double getValue() { return value; }
    public String getStatus() { return status; }
    public Instant getMeasuredAt() { return measuredAt; }
    public Instant getRecordedAt() { return recordedAt; }
}
