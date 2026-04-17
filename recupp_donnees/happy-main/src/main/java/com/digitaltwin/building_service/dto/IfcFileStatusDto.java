package com.digitaltwin.building_service.dto;

public record IfcFileStatusDto(
        String configuredPath,
        String resolvedPath,
        boolean exists,
        boolean readable,
        Long sizeBytes,
        String error
) {
}

