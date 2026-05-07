package com.digitaltwin.building_service.dto;

public record RoomEnergyConsumptionDto(
        String roomName,
        Double totalKwh
) {
}