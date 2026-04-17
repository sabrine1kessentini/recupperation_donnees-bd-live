package com.digitaltwin.building_service.dto;

import java.util.List;

public record SensorHistoryDto(
        String sensorId,
        String sensorType,
        String label,
        String unit,
        String ifcGlobalId,
        String roomName,
        List<TelemetryPointDto> points
) {
}
