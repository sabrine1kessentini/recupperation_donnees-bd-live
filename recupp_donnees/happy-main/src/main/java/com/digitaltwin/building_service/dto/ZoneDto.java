package com.digitaltwin.building_service.dto;

import java.util.List;

public record ZoneDto(
        Long id,
        String name,
        String type,
        List<EquipmentDto> equipments
) {
}

