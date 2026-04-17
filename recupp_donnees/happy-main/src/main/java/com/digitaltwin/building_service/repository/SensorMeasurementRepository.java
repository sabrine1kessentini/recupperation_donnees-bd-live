package com.digitaltwin.building_service.repository;

import com.digitaltwin.building_service.domain.SensorMeasurement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface SensorMeasurementRepository extends JpaRepository<SensorMeasurement, Long> {

    List<SensorMeasurement> findBySensorIdAndMeasuredAtBetweenOrderByMeasuredAtAsc(
            String sensorId, Instant start, Instant end);

    List<SensorMeasurement> findBySensorTypeAndMeasuredAtBetweenOrderByMeasuredAtAsc(
            String sensorType, Instant start, Instant end);

    List<SensorMeasurement> findTop500ByOrderByRecordedAtDesc();
}
