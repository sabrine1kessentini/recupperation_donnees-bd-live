package com.digitaltwin.building_service.dto;

import java.time.Instant;

public record RealtimeMeasurementDto(
        String sensorId,
        String sensorType,
        String label,
        Instant timestamp,
        Double value,
        String unit,
        String status,
        String ifcGlobalId,
        String roomName
) {
}
