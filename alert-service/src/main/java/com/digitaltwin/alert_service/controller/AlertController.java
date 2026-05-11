package com.digitaltwin.alert_service.controller;

import com.digitaltwin.alert_service.model.Alert;
import com.digitaltwin.alert_service.service.AlertService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * API REST pour consulter et gérer les alertes.
 *
 * GET  /api/alerts              → toutes les alertes actives
 * GET  /api/alerts/all          → toutes les alertes (tous statuts)
 * GET  /api/alerts/equipment/{id} → alertes d'un équipement
 * PUT  /api/alerts/{id}/acknowledge → acquitter
 * PUT  /api/alerts/{id}/resolve     → résoudre
 */
@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class AlertController {

    private final AlertService alertService;

    @GetMapping
    public ResponseEntity<List<Alert>> getActiveAlerts() {
        return ResponseEntity.ok(alertService.getActiveAlerts());
    }

    @GetMapping("/all")
    public ResponseEntity<List<Alert>> getAllAlerts() {
        return ResponseEntity.ok(alertService.getAllAlerts());
    }

    @GetMapping("/equipment/{equipmentId}")
    public ResponseEntity<List<Alert>> getByEquipment(@PathVariable String equipmentId) {
        return ResponseEntity.ok(alertService.getAlertsByEquipment(equipmentId));
    }

    @PutMapping("/{id}/acknowledge")
    public ResponseEntity<Alert> acknowledge(@PathVariable Long id) {
        return ResponseEntity.ok(alertService.acknowledge(id));
    }

    @PutMapping("/{id}/resolve")
    public ResponseEntity<Alert> resolve(@PathVariable Long id) {
        return ResponseEntity.ok(alertService.resolve(id));
    }
}
