package com.digitaltwin.building_service.dto;

import java.util.List;

public record SpaceSensorDto(
        Long zoneId,
        String ifcGlobalId,
        String ifcName,
        String ifcLongName,
        String storey,
        Double areaM2,
        boolean mapped,
        Integer networkId,
        List<SensorSummaryDto> sensors
) {
}
