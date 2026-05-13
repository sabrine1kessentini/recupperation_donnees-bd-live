package com.digitaltwin.building_service.service;

import com.digitaltwin.building_service.domain.RoomReservation;
import com.digitaltwin.building_service.dto.ReservationDto;
import com.digitaltwin.building_service.dto.ReservationRequestDto;
import com.digitaltwin.building_service.dto.ReservationRoomDto;
import com.digitaltwin.building_service.repository.RoomReservationRepository;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReservationService {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    private final RoomReservationRepository reservationRepository;
    private final IfcParserService ifcParserService;
    private final ObjectMapper objectMapper;

    @Value("${building.mapping.path}")
    private String mappingPath;

    @Transactional(readOnly = true)
    public List<ReservationRoomDto> getReservationRooms() {
        LocalDate today = LocalDate.now();
        List<RoomReservation> currentReservations = reservationRepository.findAll()
                .stream()
                .filter(r -> !r.getReservationDate().isBefore(today.minusDays(1)))
                .toList();

        List<IfcParserService.IfcElement> spaces = ifcParserService.extractSpaces();
        List<MappingRoom> mappings = loadMappings();
        Map<String, MappingRoom> mappingsByGlobalId = mappings.stream()
                .filter(room -> room.ifcGlobalId != null)
                .collect(Collectors.toMap(room -> room.ifcGlobalId, room -> room, (a, b) -> a, LinkedHashMap::new));
        Map<String, MappingRoom> mappingsByName = mappings.stream()
                .filter(room -> room.ifcName != null)
                .collect(Collectors.toMap(room -> normalize(room.ifcName), room -> room, (a, b) -> a, LinkedHashMap::new));

        Map<String, List<ReservationDto>> reservationsByRoom = currentReservations.stream()
                .map(this::toDto)
                .collect(Collectors.groupingBy(ReservationDto::ifcGlobalId));

        return spaces.stream()
                .collect(Collectors.toMap(
                        IfcParserService.IfcElement::getName,
                        space -> {
                            String ifcGlobalId = space.getGlobalId();
                            MappingRoom mapping = mappingsByGlobalId.get(ifcGlobalId);
                            if (mapping == null) {
                                mapping = mappingsByName.get(normalize(space.getName()));
                            }
                            List<ReservationDto> roomReservations = reservationsByRoom.getOrDefault(ifcGlobalId, List.of());

                            ReservationDto currentReservation = roomReservations.stream()
                                    .filter(r -> r.date().equals(today) || r.date().isAfter(today.minusDays(1)))
                                    .max(Comparator.comparing(ReservationDto::startTime))
                                    .orElse(null);

                            String status = currentReservation != null ? "reserved" : "available";

                            String reservedSlot = currentReservation != null
                                    ? currentReservation.startTime().format(TIME_FORMATTER) + "-" + currentReservation.endTime().format(TIME_FORMATTER)
                                    : null;

                            return new ReservationRoomDto(
                                    ifcGlobalId,
                                    space.getName(),
                                    space.getLongName(),
                                    space.getStorey(),
                                    null,
                                    mapping != null ? mapping.areaM2 : null,
                                    status,
                                    reservedSlot,
                                    currentReservation,
                                    roomReservations
                            );
                        },
                        (existing, replacement) -> existing,
                        LinkedHashMap::new
                ))
                .values()
                .stream()
                .sorted(Comparator.comparing(ReservationRoomDto::name))
                .toList();
    }

    public ReservationDto createReservation(ReservationRequestDto request) {
        List<RoomReservation> overlapping = reservationRepository.findOverlappingReservations(
                request.ifcGlobalId(),
                request.date(),
                request.startTime(),
                request.endTime()
        );

        if (!overlapping.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Time slot already reserved");
        }

        RoomReservation entity = new RoomReservation();
        entity.setIfcGlobalId(request.ifcGlobalId());
        entity.setReservationDate(request.date());
        entity.setStartTime(request.startTime());
        entity.setEndTime(request.endTime());
        entity.setFirstName(request.firstName());
        entity.setLastName(request.lastName());
        entity.setCountry(request.country());
        entity.setPhone(request.phone());
        entity.setEmail(request.email());
        entity.setCreatedAt(LocalDateTime.now());

        IfcParserService.IfcElement space = ifcParserService.extractSpaces().stream()
                .filter(s -> s.getGlobalId().equals(request.ifcGlobalId()))
                .findFirst()
                .orElse(null);

        if (space != null) {
            entity.setRoomName(space.getName());
            entity.setRoomLongName(space.getLongName());
            entity.setStorey(space.getStorey());
        }

        RoomReservation saved = reservationRepository.save(entity);
        return toDto(saved);
    }

    private ReservationDto toDto(RoomReservation r) {
        return new ReservationDto(
                r.getId(),
                r.getIfcGlobalId(),
                r.getRoomName(),
                r.getRoomLongName(),
                r.getStorey(),
                r.getLocation(),
                r.getReservationDate(),
                r.getStartTime(),
                r.getEndTime(),
                r.getStartTime().format(TIME_FORMATTER) + "-" + r.getEndTime().format(TIME_FORMATTER),
                r.getFirstName() + " " + r.getLastName(),
                r.getEmail(),
                r.getPhone()
        );
    }

    private List<MappingRoom> loadMappings() {
        try {
            return Arrays.asList(objectMapper.readValue(resolvePath(mappingPath).toFile(), MappingRoom[].class));
        } catch (IOException e) {
            log.warn("Unable to read room mapping file for reservation areas: {}", e.getMessage());
            return List.of();
        }
    }

    private Path resolvePath(String configuredPath) {
        Path path = Paths.get(configuredPath);
        return path.isAbsolute() ? path.normalize() : Paths.get(System.getProperty("user.dir"), configuredPath).normalize();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class MappingRoom {
        @JsonProperty("ifc_global_id")
        public String ifcGlobalId;

        @JsonProperty("ifc_name")
        public String ifcName;

        @JsonProperty("area_m2")
        public Double areaM2;
    }
}
