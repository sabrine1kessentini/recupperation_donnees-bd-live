package com.digitaltwin.building_service.dto;

import java.time.LocalDate;
import java.time.LocalTime;

public record ReservationDto(
        Long id,
        String ifcGlobalId,
        String roomName,
        String roomLongName,
        String storey,
        String location,
        LocalDate date,
        LocalTime startTime,
        LocalTime endTime,
        String reservedSlot,
        String reservedBy,
        String email,
        String phone
) {
}
