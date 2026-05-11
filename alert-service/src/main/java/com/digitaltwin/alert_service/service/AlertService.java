package com.digitaltwin.alert_service.service;

import com.digitaltwin.alert_service.model.Alert;
import com.digitaltwin.alert_service.model.AlertStatus;
import com.digitaltwin.alert_service.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AlertService {

    private final AlertRepository alertRepository;

    /** Toutes les alertes ACTIVE */
    public List<Alert> getActiveAlerts() {
        return alertRepository.findByStatusOrderByTriggeredAtDesc(AlertStatus.ACTIVE);
    }

    /** Toutes les alertes (toutes statuts) */
    public List<Alert> getAllAlerts() {
        return alertRepository.findAll();
    }

    /** Alertes d'un équipement */
    public List<Alert> getAlertsByEquipment(String equipmentId) {
        return alertRepository.findByEquipmentIdOrderByTriggeredAtDesc(equipmentId);
    }

    /** Acquitter une alerte */
    @Transactional
    public Alert acknowledge(Long alertId) {
        Alert alert = alertRepository.findById(alertId)
            .orElseThrow(() -> new IllegalArgumentException("Alerte introuvable : " + alertId));
        alert.setStatus(AlertStatus.ACKNOWLEDGED);
        log.info("Alerte {} acquittée", alertId);
        return alertRepository.save(alert);
    }

    /** Résoudre une alerte */
    @Transactional
    public Alert resolve(Long alertId) {
        Alert alert = alertRepository.findById(alertId)
            .orElseThrow(() -> new IllegalArgumentException("Alerte introuvable : " + alertId));
        alert.setStatus(AlertStatus.RESOLVED);
        alert.setResolvedAt(Instant.now());
        log.info("Alerte {} résolue", alertId);
        return alertRepository.save(alert);
    }
}
