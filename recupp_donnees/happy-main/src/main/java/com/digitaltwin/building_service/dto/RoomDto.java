package com.digitaltwin.building_service.dto;

import java.util.List;

public record RoomDto(
        Long id,
        String name,
        String globalId,
        String type,
        List<EquipmentDto> equipments
) {
}
