package com.digitaltwin.building_service.repository;

import com.digitaltwin.building_service.domain.RoomReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Repository
public interface RoomReservationRepository extends JpaRepository<RoomReservation, Long> {

    List<RoomReservation> findByIfcGlobalIdOrderByReservationDateAscStartTimeAsc(String ifcGlobalId);

    @Query("""
            select r from RoomReservation r
            where r.ifcGlobalId = :ifcGlobalId
              and r.reservationDate = :reservationDate
              and r.startTime < :endTime
              and r.endTime > :startTime
            """)
    List<RoomReservation> findOverlappingReservations(
            @Param("ifcGlobalId") String ifcGlobalId,
            @Param("reservationDate") LocalDate reservationDate,
            @Param("startTime") LocalTime startTime,
            @Param("endTime") LocalTime endTime
    );
}
