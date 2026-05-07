package com.digitaltwin.building_service.repository;

import com.digitaltwin.building_service.domain.SensorMeasurement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

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
}
