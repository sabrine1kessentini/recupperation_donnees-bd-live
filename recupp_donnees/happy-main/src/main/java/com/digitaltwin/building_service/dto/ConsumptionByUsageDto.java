package com.digitaltwin.building_service.dto;

public record ConsumptionByUsageDto(
    double cvcKwh,
    double lightingKwh,
    double equipmentKwh,
    double otherKwh
) {}
