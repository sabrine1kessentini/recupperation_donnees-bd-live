package com.digitaltwin.alert_service.repository;

import com.digitaltwin.alert_service.model.Alert;
import com.digitaltwin.alert_service.model.AlertStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AlertRepository extends JpaRepository<Alert, Long> {

    /**
     * Cooldown : dernière alerte ACTIVE pour un équipement + règle donnée.
     * Permet d'éviter le spam d'alertes répétées.
     */
    Optional<Alert> findTopByEquipmentIdAndRuleIdAndStatusOrderByTriggeredAtDesc(
        String equipmentId,
        Long ruleId,
        AlertStatus status
    );

    /** Toutes les alertes actives — pour le dashboard */
    List<Alert> findByStatusOrderByTriggeredAtDesc(AlertStatus status);

    /** Alertes d'un équipement précis */
    List<Alert> findByEquipmentIdOrderByTriggeredAtDesc(String equipmentId);
}
