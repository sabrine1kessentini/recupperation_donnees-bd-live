package com.digitaltwin.building_service.repository;

import com.digitaltwin.building_service.domain.Zone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ZoneRepository extends JpaRepository<Zone, Long> {
    List<Zone> findByFloorId(Long floorId);
}