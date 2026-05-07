package com.digitaltwin.building_service.service;

import com.digitaltwin.building_service.domain.BuildingStructure;
import com.digitaltwin.building_service.domain.Floor;
import com.digitaltwin.building_service.domain.RoomReservation;
import com.digitaltwin.building_service.domain.Site;
import com.digitaltwin.building_service.domain.Zone;
import com.digitaltwin.building_service.dto.ReservationDto;
import com.digitaltwin.building_service.dto.ReservationRequestDto;
import com.digitaltwin.building_service.dto.ReservationRoomDto;
import com.digitaltwin.building_service.dto.SpaceSensorDto;
import com.digitaltwin.building_service.repository.RoomReservationRepository;
import com.digitaltwin.building_service.repository.ZoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReservationService {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");
    private static final long ROOM_CACHE_TTL_MS = 60_000;

    private final RoomReservationRepository reservationRepository;
    private final WaveonFusionService waveonFusionService;
    private final IfcParserService ifcParserService;
    private final ZoneRepository zoneRepository;
    private List<ReservationRoomSource> cachedRoomSources;
    private long cachedRoomSourcesAt;

    @Transactional(readOnly = true)
    public List<ReservationRoomDto> getReservationRooms() {
        List<ReservationRoomSource> rooms = getIfcRooms();
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();

        return rooms.stream()
                .sorted(Comparator.comparing(room -> valueOrDefault(room.name(), "")))
                .map(room -> toReservationRoom(room, today, now))
                .toList();
    }

    @Transactional
    public ReservationDto createReservation(ReservationRequestDto request) {
        validateRequest(request);
        ReservationRoomSource room = findRoom(request.ifcGlobalId());

        List<RoomReservation> overlaps = reservationRepository.findOverlappingReservations(
                request.ifcGlobalId(),
                request.date(),
                request.startTime(),
                request.endTime()
        );
        if (!overlaps.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette salle est deja reservee sur ce creneau.");
        }

        RoomReservation reservation = new RoomReservation();
        reservation.setIfcGlobalId(room.ifcGlobalId());
        reservation.setRoomName(valueOrDefault(room.name(), room.ifcGlobalId()));
        reservation.setRoomLongName(room.longName());
        reservation.setStorey(room.storey());
        reservation.setLocation(room.location());
        reservation.setReservationDate(request.date());
        reservation.setStartTime(request.startTime());
        reservation.setEndTime(request.endTime());
        reservation.setFirstName(trimToNull(request.firstName()));
        reservation.setLastName(trimToNull(request.lastName()));
        reservation.setCountry(trimToNull(request.country()));
        reservation.setPhone(trimToNull(request.phone()));
        reservation.setEmail(trimToNull(request.email()));
        reservation.setCreatedAt(LocalDateTime.now());

        return toDto(reservationRepository.save(reservation));
    }

    @Transactional(readOnly = true)
    public List<ReservationDto> getReservations(String ifcGlobalId) {
        if (isBlank(ifcGlobalId)) {
            return reservationRepository.findAll().stream()
                    .sorted(Comparator
                            .comparing(RoomReservation::getReservationDate)
                            .thenComparing(RoomReservation::getStartTime))
                    .map(this::toDto)
                    .toList();
        }

        return reservationRepository.findByIfcGlobalIdOrderByReservationDateAscStartTimeAsc(ifcGlobalId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    private ReservationRoomDto toReservationRoom(ReservationRoomSource room, LocalDate today, LocalTime now) {
        List<ReservationDto> reservations = reservationRepository
                .findByIfcGlobalIdOrderByReservationDateAscStartTimeAsc(room.ifcGlobalId())
                .stream()
                .map(this::toDto)
                .toList();

        ReservationDto current = reservations.stream()
                .filter(reservation -> isCurrentOrFuture(reservation, today, now))
                .findFirst()
                .orElse(null);

        return new ReservationRoomDto(
                room.ifcGlobalId(),
                valueOrDefault(room.name(), room.ifcGlobalId()),
                room.longName(),
                room.storey(),
                room.location(),
                room.areaM2(),
                current == null ? "available" : "reserved",
                current == null ? null : current.reservedSlot(),
                current,
                reservations
        );
    }

    private boolean isCurrentOrFuture(ReservationDto reservation, LocalDate today, LocalTime now) {
        if (reservation.date().isAfter(today)) {
            return true;
        }
        return reservation.date().isEqual(today) && reservation.endTime().isAfter(now);
    }

    private ReservationRoomSource findRoom(String ifcGlobalId) {
        return getIfcRooms().stream()
                .filter(room -> room.ifcGlobalId().equals(ifcGlobalId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Salle IFC introuvable."));
    }

    private List<ReservationRoomSource> getIfcRooms() {
        long now = System.currentTimeMillis();
        if (cachedRoomSources != null && now - cachedRoomSourcesAt < ROOM_CACHE_TTL_MS) {
            return cachedRoomSources;
        }

        List<ReservationRoomSource> rooms = loadRoomSources();
        cachedRoomSources = rooms;
        cachedRoomSourcesAt = now;
        return rooms;
    }

    private List<ReservationRoomSource> loadRoomSources() {
        Map<String, SpaceSensorDto> mappedSpaces = getMappedSpacesByGlobalId();
        Map<String, DbRoomInfo> dbRoomsByName = getDbRoomsByName();

        List<ReservationRoomSource> rooms = ifcParserService.extractSpaces().stream()
                .filter(space -> !isBlank(space.getGlobalId()))
                .map(space -> {
                    SpaceSensorDto mapped = mappedSpaces.get(space.getGlobalId());
                    String name = valueOrDefault(
                            mapped != null ? mapped.ifcName() : null,
                            valueOrDefault(space.getName(), space.getGlobalId())
                    );
                    DbRoomInfo dbRoom = dbRoomsByName.get(normalize(name));
                    String longName = valueOrDefault(
                            mapped != null ? mapped.ifcLongName() : null,
                            space.getLongName()
                    );
                    String storey = valueOrDefault(
                            cleanStorey(mapped != null ? mapped.storey() : null),
                            valueOrDefault(cleanStorey(space.getStorey()), dbRoom != null ? dbRoom.floorName() : null)
                    );
                    String location = dbRoom != null && hasUsefulDbLocation(dbRoom.location())
                            ? dbRoom.location()
                            : buildLocation(storey);
                    Double areaM2 = mapped != null ? mapped.areaM2() : null;

                    return new ReservationRoomSource(
                            space.getGlobalId(),
                            name,
                            longName,
                            storey,
                            location,
                            areaM2
                    );
                })
                .collect(Collectors.toMap(
                        room -> normalize(room.name()),
                        Function.identity(),
                        this::chooseBetterRoomSource,
                        LinkedHashMap::new
                ))
                .values()
                .stream()
                .toList();

        if (!rooms.isEmpty()) {
            return rooms;
        }

        return mappedSpaces.values().stream()
                .map(space -> new ReservationRoomSource(
                        space.ifcGlobalId(),
                        valueOrDefault(space.ifcName(), space.ifcGlobalId()),
                        space.ifcLongName(),
                        cleanStorey(space.storey()),
                        buildLocation(cleanStorey(space.storey())),
                        space.areaM2()
                ))
                .toList();
    }

    private ReservationRoomSource chooseBetterRoomSource(ReservationRoomSource current, ReservationRoomSource candidate) {
        if (isBlank(current.longName()) && !isBlank(candidate.longName())) {
            return candidate;
        }
        if (isBlank(current.storey()) && !isBlank(candidate.storey())) {
            return candidate;
        }
        if (current.areaM2() == null && candidate.areaM2() != null) {
            return candidate;
        }
        return current;
    }

    private Map<String, SpaceSensorDto> getMappedSpacesByGlobalId() {
        try {
            return waveonFusionService.getSpaces().stream()
                    .filter(space -> !isBlank(space.ifcGlobalId()))
                    .collect(Collectors.toMap(
                            SpaceSensorDto::ifcGlobalId,
                            Function.identity(),
                            (a, b) -> a,
                            LinkedHashMap::new
                    ));
        } catch (RuntimeException ignored) {
            return Map.of();
        }
    }

    private Map<String, DbRoomInfo> getDbRoomsByName() {
        return zoneRepository.findAll().stream()
                .filter(zone -> !isBlank(zone.getName()))
                .map(this::toDbRoomInfo)
                .filter(Objects::nonNull)
                .collect(Collectors.toMap(
                        room -> normalize(room.roomName()),
                        Function.identity(),
                        this::chooseBetterDbRoom,
                        LinkedHashMap::new
                ));
    }

    private DbRoomInfo toDbRoomInfo(Zone zone) {
        Floor floor = zone.getFloor();
        BuildingStructure building = floor != null ? floor.getBuilding() : null;
        Site site = building != null ? building.getSite() : null;

        String floorName = floor != null ? cleanStorey(floor.getName()) : null;
        String location = buildDbLocation(site, building, floorName);

        return new DbRoomInfo(zone.getName(), floorName, location);
    }

    private DbRoomInfo chooseBetterDbRoom(DbRoomInfo current, DbRoomInfo candidate) {
        if (isBlank(current.floorName()) && !isBlank(candidate.floorName())) {
            return candidate;
        }
        if (isBlank(current.location()) && !isBlank(candidate.location())) {
            return candidate;
        }
        return current;
    }

    private void validateRequest(ReservationRequestDto request) {
        if (request == null || isBlank(request.ifcGlobalId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selectionnez une salle.");
        }
        if (request.date() == null || request.startTime() == null || request.endTime() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choisissez la date et les heures de debut/fin.");
        }
        if (!request.endTime().isAfter(request.startTime())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "L heure de fin doit etre apres l heure de debut.");
        }
    }

    private ReservationDto toDto(RoomReservation reservation) {
        String reservedBy = String.join(" ",
                valueOrDefault(reservation.getFirstName(), ""),
                valueOrDefault(reservation.getLastName(), "")
        ).trim();

        return new ReservationDto(
                reservation.getId(),
                reservation.getIfcGlobalId(),
                reservation.getRoomName(),
                reservation.getRoomLongName(),
                reservation.getStorey(),
                reservation.getLocation(),
                reservation.getReservationDate(),
                reservation.getStartTime(),
                reservation.getEndTime(),
                formatSlot(reservation.getReservationDate(), reservation.getStartTime(), reservation.getEndTime()),
                reservedBy.isBlank() ? null : reservedBy,
                reservation.getEmail(),
                reservation.getPhone()
        );
    }

    private String buildLocation(String storey) {
        if (isBlank(storey)) {
            return "IFC";
        }
        return "IFC - " + storey;
    }

    private String buildDbLocation(Site site, BuildingStructure building, String floorName) {
        return List.of(
                        site != null ? site.getName() : null,
                        site != null ? site.getLocation() : null,
                        building != null && isUsefulBuildingName(building.getName()) ? building.getName() : null,
                        floorName
                )
                .stream()
                .filter(value -> !isBlank(value))
                .distinct()
                .collect(Collectors.joining(" - "));
    }

    private boolean hasUsefulDbLocation(String location) {
        return !isBlank(location)
                && !"IFC Site - Extracted from IFC".equals(location)
                && !"IFC Site".equals(location)
                && !"Extracted from IFC".equals(location);
    }

    private boolean isUsefulBuildingName(String value) {
        return !isBlank(value) && !value.contains(":");
    }

    private String formatSlot(LocalDate date, LocalTime startTime, LocalTime endTime) {
        return date + " " + startTime.format(TIME_FORMATTER) + " - " + endTime.format(TIME_FORMATTER);
    }

    private String valueOrDefault(String value, String fallback) {
        return isBlank(value) ? fallback : value;
    }

    private String trimToNull(String value) {
        if (isBlank(value)) {
            return null;
        }
        return value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String normalize(String value) {
        return isBlank(value) ? "" : value.trim().toLowerCase();
    }

    private String cleanStorey(String value) {
        if (isBlank(value) || Objects.equals(value.trim(), "?")) {
            return null;
        }
        return value.trim();
    }

    private record ReservationRoomSource(
            String ifcGlobalId,
            String name,
            String longName,
            String storey,
            String location,
            Double areaM2
    ) {
    }

    private record DbRoomInfo(
            String roomName,
            String floorName,
            String location
    ) {
    }
}
