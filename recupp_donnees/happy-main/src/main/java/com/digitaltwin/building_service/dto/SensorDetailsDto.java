package com.digitaltwin.building_service.dto;

public record SensorDetailsDto(
        String id,
        String type,
        String label,
        Integer networkId,
        Integer unicastAddress,
        String ifcGlobalId,
        String ifcName,
        String ifcLongName,
        String storey,
        Double areaM2,
        Long zoneId,
        RealtimeMeasurementDto realtime
) {
}
