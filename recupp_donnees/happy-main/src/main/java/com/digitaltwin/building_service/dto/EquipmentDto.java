package com.digitaltwin.building_service.dto;

public record EquipmentDto(
        Long id,
        String name,
        String category,
        String ifcGlobalId
) {
}

