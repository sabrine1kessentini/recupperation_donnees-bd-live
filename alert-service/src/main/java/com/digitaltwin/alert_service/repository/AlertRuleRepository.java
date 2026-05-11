package com.digitaltwin.alert_service.repository;

import com.digitaltwin.alert_service.model.AlertRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AlertRuleRepository extends JpaRepository<AlertRule, Long> {

    /**
     * Récupère toutes les règles actives pour un type de métrique donné.
     * Utilisé par AlertEngine pour évaluer un event entrant.
     */
    List<AlertRule> findByMetricTypeIgnoreCaseAndEnabledTrue(String metricType);
}
