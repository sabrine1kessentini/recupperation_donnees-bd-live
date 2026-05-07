package com.digitaltwin.building_service.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "room_reservations")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoomReservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String ifcGlobalId;

    @Column(nullable = false)
    private String roomName;

    private String roomLongName;
    private String storey;
    private String location;

    @Column(nullable = false)
    private LocalDate reservationDate;

    @Column(nullable = false)
    private LocalTime startTime;

    @Column(nullable = false)
    private LocalTime endTime;

    private String firstName;
    private String lastName;
    private String country;
    private String phone;
    private String email;

    @Column(nullable = false)
    private LocalDateTime createdAt;
}
