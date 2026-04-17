package com.digitaltwin.building_service.repository;

import com.digitaltwin.building_service.domain.Site;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SiteRepository extends JpaRepository<Site, Long> {
}

