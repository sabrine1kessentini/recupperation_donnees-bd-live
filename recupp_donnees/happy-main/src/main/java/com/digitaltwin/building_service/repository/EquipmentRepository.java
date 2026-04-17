package com.digitaltwin.building_service.repository;

import com.digitaltwin.building_service.domain.Equipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EquipmentRepository extends JpaRepository<Equipment, Long> {
    List<Equipment> findByZoneId(Long zoneId);
}