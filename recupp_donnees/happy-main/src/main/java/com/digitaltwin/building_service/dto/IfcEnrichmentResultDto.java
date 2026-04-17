package com.digitaltwin.building_service.dto;

import java.util.List;

public record IfcEnrichmentResultDto(
        String sourceIfcPath,
        String mappingPath,
        String outputIfcPath,
        int mappedRoomsProcessed,
        int roomsMatchedInIfc,
        int sensorsCreated,
        int roomsSkipped,
        List<String> warnings
) {
}
