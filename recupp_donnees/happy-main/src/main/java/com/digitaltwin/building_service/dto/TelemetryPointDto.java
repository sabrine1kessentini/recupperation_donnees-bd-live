package com.digitaltwin.building_service.dto;

import java.time.Instant;

public record TelemetryPointDto(
        Instant timestamp,
        Double value
) {
}
