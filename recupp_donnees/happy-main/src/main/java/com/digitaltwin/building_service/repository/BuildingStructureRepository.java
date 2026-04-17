package com.digitaltwin.building_service.repository;

import com.digitaltwin.building_service.domain.BuildingStructure;
import com.digitaltwin.building_service.domain.Site;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BuildingStructureRepository extends JpaRepository<BuildingStructure, Long> {

    List<BuildingStructure> findBySite(Site site);
}

