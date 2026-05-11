package com.digitaltwin.building_service.controller;

import com.digitaltwin.building_service.domain.SensorMeasurement;
import com.digitaltwin.building_service.dto.*;
import com.digitaltwin.building_service.repository.SensorMeasurementRepository;
import com.digitaltwin.building_service.service.IfcEnrichmentService;
import com.digitaltwin.building_service.service.HierarchyService;
import com.digitaltwin.building_service.service.IfcService;
import com.digitaltwin.building_service.service.ReservationService;
import com.digitaltwin.building_service.service.WaveonFusionService;
import com.digitaltwin.building_service.kafka.SensorDataProducer;
import com.digitaltwin.building_service.kafka.SensorReadingEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.util.StringUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.DayOfWeek;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class BuildingController {

     private final SensorMeasurementRepository sensorMeasurementRepository;
     private final IfcService ifcService;
     private final IfcEnrichmentService ifcEnrichmentService;
     private final HierarchyService hierarchyService;
     private final WaveonFusionService waveonFusionService;
     private final SensorDataProducer sensorDataProducer;
     private final ReservationService reservationService;
     private static final Logger log = LoggerFactory.getLogger(BuildingController.class);

    // ← Le constructeur manuel a été supprimé, @RequiredArgsConstructor s'en charge

    @GetMapping("/building/ifc")
    public ResponseEntity<Resource> downloadIfc() {
        Path path = ifcService.getIfcPath();
        if (!Files.exists(path) || !Files.isReadable(path)) {
            return ResponseEntity.notFound().build();
        }
        Resource resource = new FileSystemResource(path.toFile());
        String filename = path.getFileName() != null ? path.getFileName().toString() : "model.ifc";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(resource);
    }

    @GetMapping("/building/ifc/status")
    public ResponseEntity<IfcFileStatusDto> ifcStatus() {
        try {
            Long size = null;
            if (ifcService.exists()) {
                size = ifcService.sizeBytes();
            }
            return ResponseEntity.ok(new IfcFileStatusDto(
                    ifcService.getConfiguredPath(),
                    ifcService.getIfcPath().toString(),
                    ifcService.exists(),
                    ifcService.readable(),
                    size,
                    null
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(new IfcFileStatusDto(
                    ifcService.getConfiguredPath(),
                    ifcService.getIfcPath().toString(),
                    ifcService.exists(),
                    ifcService.readable(),
                    null,
                    e.getClass().getSimpleName() + ": " + e.getMessage()
            ));
        }
    }

    @PostMapping("/building/ifc/enrich")
    public ResponseEntity<IfcEnrichmentResultDto> enrichIfc(
            @RequestParam(required = false) String mappingPath,
            @RequestParam(required = false) String outputPath) {
        try {
            return ResponseEntity.ok(ifcEnrichmentService.enrichIfc(mappingPath, outputPath));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new IfcEnrichmentResultDto(
                    ifcService.getIfcPath().toString(),
                    mappingPath,
                    outputPath,
                    0, 0, 0, 0,
                    List.of(e.getClass().getSimpleName() + ": " + e.getMessage())
            ));
        }
    }

    @GetMapping("/building/ifc/enriched")
    public ResponseEntity<Resource> downloadEnrichedIfc(@RequestParam(required = false) String outputPath) {
        Path path = ifcEnrichmentService.resolveOutputPath(outputPath);
        if (!Files.exists(path) || !Files.isReadable(path)) {
            return ResponseEntity.notFound().build();
        }
        Resource resource = new FileSystemResource(path.toFile());
        String filename = path.getFileName() != null ? path.getFileName().toString() : "model.enriched.ifc";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(resource);
    }

    @GetMapping("/buildings/hierarchy")
    public ResponseEntity<SiteHierarchyDto> getHierarchy() {
        return ResponseEntity.ok(hierarchyService.getHierarchy());
    }

    @GetMapping("/buildings")
    public ResponseEntity<List<BuildingHierarchyDto>> getBuildings() {
        return ResponseEntity.ok(hierarchyService.getBuildings());
    }

    @GetMapping("/floors")
    public ResponseEntity<List<FloorDto>> getFloors() {
        return ResponseEntity.ok(hierarchyService.getFloors());
    }

    @GetMapping("/rooms")
    public ResponseEntity<List<RoomDto>> getRooms() {
        return ResponseEntity.ok(hierarchyService.getRooms());
    }

    @GetMapping("/reservations/rooms")
    public ResponseEntity<List<ReservationRoomDto>> getReservationRooms() {
        return ResponseEntity.ok(reservationService.getReservationRooms());
    }

    @GetMapping("/equipment")
    public ResponseEntity<List<EquipmentDto>> getEquipment() {
        return ResponseEntity.ok(hierarchyService.getEquipment());
    }

    @GetMapping("/spaces")
    public ResponseEntity<List<SpaceSensorDto>> getSpaces() {
        return ResponseEntity.ok(waveonFusionService.getSpaces());
    }

    @GetMapping("/sensors/{id}")
    public ResponseEntity<SensorDetailsDto> getSensor(@PathVariable("id") String id) {
        return ResponseEntity.ok(waveonFusionService.getSensor(id));
    }

    @GetMapping("/realtime")
    public ResponseEntity<List<RealtimeMeasurementDto>> getRealtime(
            @RequestParam(required = false) String sensorId) {
        return ResponseEntity.ok(waveonFusionService.getRealtime(sensorId));
    }

    @GetMapping("/history")
    public ResponseEntity<List<SensorHistoryDto>> getHistory(
            @RequestParam(required = false) String sensorId,
            @RequestParam(required = false) Integer hours,
            @RequestParam(required = false) Integer points) {
        return ResponseEntity.ok(waveonFusionService.getHistory(sensorId, hours, points));
    }

    @GetMapping("/waveon/test-session")
    public ResponseEntity<java.util.Map<String, Object>> testSession() {
        java.util.Map<String, Object> info = waveonFusionService.getSessionInfo();
        return ResponseEntity.ok(info);
    }

    @GetMapping("/measurements/recent")
    public ResponseEntity<List<SensorMeasurement>> getRecentMeasurements() {
        return ResponseEntity.ok(sensorMeasurementRepository.findTop500ByOrderByRecordedAtDesc());
    }

    @GetMapping("/measurements/energy-comparison")
    public ResponseEntity<EnergyComparisonDto> getEnergyComparison() {
        try {
            Instant now = Instant.now();
            ZoneId zone = ZoneId.systemDefault();
            LocalDate today = LocalDate.ofInstant(now, zone);
            LocalDate mondayThisWeek = today.with(DayOfWeek.MONDAY);
            Instant weekStart = mondayThisWeek.atStartOfDay(zone).toInstant();

            // Période comparable la semaine dernière : lundi à même jour/heure
            Instant lastWeekSameDay = now.minus(7, java.time.temporal.ChronoUnit.DAYS);
            LocalDate lastWeekDate = LocalDate.ofInstant(lastWeekSameDay, zone);
            LocalDate mondayLastWeek = lastWeekDate.with(DayOfWeek.MONDAY);
            Instant lastWeekStart = mondayLastWeek.atStartOfDay(zone).toInstant();

            Double currentTotal = sensorMeasurementRepository.sumValueBySensorTypeAndMeasuredAtBetween(
                    "energy", weekStart, now);
            Double previousTotal = sensorMeasurementRepository.sumValueBySensorTypeAndMeasuredAtBetween(
                    "energy", lastWeekStart, lastWeekSameDay);

            currentTotal = currentTotal != null ? currentTotal : 0.0;
            previousTotal = previousTotal != null ? previousTotal : 0.0;

            double percentageChange = 0.0;
            if (previousTotal > 0) {
                percentageChange = ((currentTotal - previousTotal) / previousTotal) * 100.0;
            } else if (currentTotal > 0) {
                percentageChange = 100.0;
            }

            percentageChange = Math.round(percentageChange * 10.0) / 10.0;

            Double currentPeak = sensorMeasurementRepository.findMaxDailyEnergyConsumption(
                    "energy", weekStart, now);
            Double previousPeak = sensorMeasurementRepository.findMaxDailyEnergyConsumption(
                    "energy", lastWeekStart, lastWeekSameDay);

            currentPeak = currentPeak != null ? currentPeak : 0.0;
            previousPeak = previousPeak != null ? previousPeak : 0.0;

            double peakPercentageChange = 0.0;
            if (previousPeak > 0) {
                peakPercentageChange = ((currentPeak - previousPeak) / previousPeak) * 100.0;
            } else if (currentPeak > 0) {
                peakPercentageChange = 100.0;
            }
            peakPercentageChange = Math.round(peakPercentageChange * 10.0) / 10.0;

            EnergyComparisonDto dto = new EnergyComparisonDto(
                    currentTotal / 1000.0,
                    previousTotal / 1000.0,
                    percentageChange,
                    currentTotal.longValue(),
                    previousTotal.longValue(),
                    currentPeak / 1000.0,
                    previousPeak / 1000.0,
                    peakPercentageChange
            );
            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            log.error("Error in getEnergyComparison: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(null);
        }
    }

    @GetMapping("/measurements/energy-by-room")
    public ResponseEntity<List<RoomEnergyConsumptionDto>> getEnergyByRoom() {
        Instant now = Instant.now();
        ZoneId zone = ZoneId.systemDefault();
        LocalDate today = LocalDate.ofInstant(now, zone);
        LocalDate mondayThisWeek = today.with(DayOfWeek.MONDAY);
        Instant weekStart = mondayThisWeek.atStartOfDay(zone).toInstant();

        List<Object[]> results = sensorMeasurementRepository.sumValueByRoomAndSensorTypeBetween(
                "energy", weekStart, now);

        List<RoomEnergyConsumptionDto> roomConsumption = results.stream()
                .map(row -> new RoomEnergyConsumptionDto(
                        (String) row[0],
                        ((Number) row[1]).doubleValue() / 1000.0  // Convert Wh to kWh
                ))
                .toList();

         return ResponseEntity.ok(roomConsumption);
     }

    @GetMapping("/measurements/active-rooms-count")
    public ResponseEntity<Long> getActiveRoomsCount() {
        Instant now = Instant.now();
        ZoneId zone = ZoneId.systemDefault();
        LocalDate today = LocalDate.ofInstant(now, zone);
        LocalDate mondayThisWeek = today.with(DayOfWeek.MONDAY);
        Instant weekStart = mondayThisWeek.atStartOfDay(zone).toInstant();

        Long count = sensorMeasurementRepository.countDistinctRoomsBySensorTypeBetween(
                "energy", weekStart, now);
        return ResponseEntity.ok(count != null ? count : 0L);
    }

    @GetMapping("/measurements/active-sensors-count")
    public ResponseEntity<Long> getActiveSensorsCount() {
        Instant now = Instant.now();
        ZoneId zone = ZoneId.systemDefault();
        LocalDate today = LocalDate.ofInstant(now, zone);
        LocalDate mondayThisWeek = today.with(DayOfWeek.MONDAY);
        Instant weekStart = mondayThisWeek.atStartOfDay(zone).toInstant();

        Long count = sensorMeasurementRepository.countDistinctSensorsBySensorTypeBetween(
                "energy", weekStart, now);
        return ResponseEntity.ok(count != null ? count : 0L);
    }

    @GetMapping("/measurements/consumption-by-usage")
    public ResponseEntity<ConsumptionByUsageDto> getConsumptionByUsage() {
        Instant now = Instant.now();
        ZoneId zone = ZoneId.systemDefault();
        LocalDate today = LocalDate.ofInstant(now, zone);
        LocalDate mondayThisWeek = today.with(DayOfWeek.MONDAY);
        Instant weekStart = mondayThisWeek.atStartOfDay(zone).toInstant();

        List<Object[]> results = sensorMeasurementRepository.sumValueBySensorIdAndLabelBetween(weekStart, now);
        
        double cvc = 0, lighting = 0, equipment = 0, other = 0;
        for (Object[] row : results) {
            String sensorId = (String) row[0];
            String label = (String) row[1];
            Double value = (Double) row[2];
            if (value == null) continue;
            double kwh = value / 1000.0;
            String combined = ((sensorId != null ? sensorId : "") + " " + (label != null ? label : "")).toLowerCase();
            if (combined.contains("cvc") || combined.contains("hvac") || combined.contains("ventilation") || 
                combined.contains("chauffage") || combined.contains("clim") || combined.contains("air") || 
                combined.contains("heat") || combined.contains("cool") || combined.contains("temp") || combined.contains("thermostat")) {
                cvc += kwh;
            } else if (combined.contains("light") || combined.contains("lamp") || combined.contains("eclairage") || 
                       combined.contains("éclairage") || combined.contains("luminaire") || combined.contains("led")) {
                lighting += kwh;
            } else if (combined.contains("equip") || combined.contains("pc") || combined.contains("computer") || 
                       combined.contains("printer") || combined.contains("screen") || combined.contains("monitor") || 
                       combined.contains("device") || combined.contains("machine") || combined.contains("outlet") || 
                       combined.contains("prise") || combined.contains("socket")) {
                equipment += kwh;
            } else {
                other += kwh;
            }
        }
        
        return ResponseEntity.ok(new ConsumptionByUsageDto(cvc, lighting, equipment, other));
    }

    /**
     * Déclenche manuellement la récupération des données WaveOn et leur envoi dans Kafka.
     * Les données seront ensuite consommées par SensorDataConsumer et persistées en BDD.
     */
    @PostMapping("/ingest/poll")
    public ResponseEntity<Map<String, Object>> triggerPolling() {
        try {
            List<RealtimeMeasurementDto> measurements = waveonFusionService.getRealtime(null);
            int sent = 0;
            for (RealtimeMeasurementDto m : measurements) {
                if (m.value() == null) {
                    continue;
                }
                Instant measuredAt = m.timestamp() != null ? m.timestamp() : Instant.now();
                SensorReadingEvent event = new SensorReadingEvent(
                        m.sensorId(),
                        m.sensorType(),
                        m.label(),
                        m.ifcGlobalId(),
                        m.roomName(),
                        m.unit(),
                        m.value(),
                        m.status(),
                        measuredAt
                );
                sensorDataProducer.send(event);
                sent++;
            }
            log.info("Manually triggered ingestion: {} measurements sent to Kafka", sent);
            return ResponseEntity.ok(Map.of(
                "status", "OK",
                "sensors_fetched", measurements.size(),
                "measurements_sent", sent
            ));
        } catch (Exception e) {
            log.error("Manual ingestion failed: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "ERROR",
                "message", e.getMessage()
            ));
        }
    }

    /**
     * Récupère les données WaveOn et les insère DIRECTEMENT en BDD (sans Kafka).
     * Utile si Kafka n'est pas disponible ou pour une initialisation rapide.
     */
    @PostMapping("/ingest/direct")
    public ResponseEntity<Map<String, Object>> triggerDirectIngestion() {
        try {
            List<RealtimeMeasurementDto> measurements = waveonFusionService.getRealtime(null);
            int saved = 0;
            for (RealtimeMeasurementDto m : measurements) {
                if (m.value() == null) {
                    continue;
                }
                Instant measuredAt = m.timestamp() != null ? m.timestamp() : Instant.now();
                SensorMeasurement measurement = new SensorMeasurement(
                        m.sensorId(),
                        m.sensorType(),
                        m.label(),
                        m.ifcGlobalId(),
                        m.roomName(),
                        m.unit(),
                        m.value(),
                        m.status(),
                        measuredAt,
                        Instant.now()
                );
                sensorMeasurementRepository.save(measurement);
                saved++;
            }
            log.info("Direct ingestion: {} measurements saved to database", saved);
            return ResponseEntity.ok(Map.of(
                "status", "OK",
                "sensors_fetched", measurements.size(),
                "measurements_saved", saved
            ));
        } catch (Exception e) {
            log.error("Direct ingestion failed: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "ERROR",
                "message", e.getMessage()
            ));
        }
    }
}
