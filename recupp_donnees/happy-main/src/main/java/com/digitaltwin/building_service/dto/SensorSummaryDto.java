package com.digitaltwin.building_service.dto;

public record SensorSummaryDto(
        String id,
        String type,
        String label,
        Integer networkId,
        Integer unicastAddress
) {
}
