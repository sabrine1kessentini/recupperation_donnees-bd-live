package com.digitaltwin.building_service.dto;

import java.time.LocalDate;
import java.time.LocalTime;

public record ReservationRequestDto(
        String ifcGlobalId,
        String firstName,
        String lastName,
        String country,
        String phone,
        String email,
        LocalDate date,
        LocalTime startTime,
        LocalTime endTime
) {
}
