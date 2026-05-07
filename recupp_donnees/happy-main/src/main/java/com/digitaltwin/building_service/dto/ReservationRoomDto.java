package com.digitaltwin.building_service.dto;

import java.util.List;

public record ReservationRoomDto(
        String ifcGlobalId,
        String name,
        String longName,
        String storey,
        String location,
        Double areaM2,
        String status,
        String reservedSlot,
        ReservationDto currentReservation,
        List<ReservationDto> reservations
) {
}
