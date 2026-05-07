package com.digitaltwin.building_service.repository;

import com.digitaltwin.building_service.domain.SensorMeasurement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public interface SensorMeasurementRepository extends JpaRepository<SensorMeasurement, Long> {

    List<SensorMeasurement> findBySensorIdAndMeasuredAtBetweenOrderByMeasuredAtAsc(
            String sensorId, Instant start, Instant end);

    List<SensorMeasurement> findBySensorTypeAndMeasuredAtBetweenOrderByMeasuredAtAsc(
            String sensorType, Instant start, Instant end);

    List<SensorMeasurement> findTop500ByOrderByRecordedAtDesc();

    @Query("SELECT SUM(sm.value) FROM SensorMeasurement sm WHERE sm.sensorType = :sensorType AND sm.measuredAt BETWEEN :start AND :end")
    Double sumValueBySensorTypeAndMeasuredAtBetween(
            @Param("sensorType") String sensorType,
            @Param("start") Instant start,
            @Param("end") Instant end);

    @Query("SELECT MAX(sm.value) FROM SensorMeasurement sm WHERE sm.sensorType = :sensorType AND sm.measuredAt BETWEEN :start AND :end")
    Double findMaxValueBySensorTypeAndMeasuredAtBetween(
            @Param("sensorType") String sensorType,
            @Param("start") Instant start,
            @Param("end") Instant end);

    @Query("SELECT sm.roomName, SUM(sm.value) FROM SensorMeasurement sm WHERE sm.sensorType = :sensorType AND sm.measuredAt BETWEEN :start AND :end GROUP BY sm.roomName ORDER BY SUM(sm.value) DESC")
    List<Object[]> sumValueByRoomAndSensorTypeBetween(
            @Param("sensorType") String sensorType,
            @Param("start") Instant start,
            @Param("end") Instant end);

    default Double findMaxDailyEnergyConsumption(String sensorType, Instant start, Instant end) {
        List<SensorMeasurement> measurements = findBySensorTypeAndMeasuredAtBetweenOrderByMeasuredAtAsc(sensorType, start, end);
        if (measurements.isEmpty()) {
            return 0.0;
        }
        Map<LocalDate, Double> dailyTotals = measurements.stream()
                .collect(Collectors.groupingBy(
                        m -> m.getMeasuredAt().atZone(ZoneId.systemDefault()).toLocalDate(),
                        Collectors.summingDouble(SensorMeasurement::getValue)
                ));
        return dailyTotals.values().stream()
                .max(Double::compare)
                .orElse(0.0);
    }
}
