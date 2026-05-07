package com.digitaltwin.building_service.dto;

public record EnergyComparisonDto(
        Double currentTotalKwh,
        Double previousTotalKwh,
        Double percentageChange,
        Long currentTotalRaw,
        Long previousTotalRaw,
        Double currentPeakValue,
        Double previousPeakValue,
        Double peakPercentageChange
) {
}
