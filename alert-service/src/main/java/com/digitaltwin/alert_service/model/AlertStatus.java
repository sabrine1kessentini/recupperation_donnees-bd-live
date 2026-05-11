package com.digitaltwin.alert_service.model;

public enum AlertStatus {
    ACTIVE,         // Alerte en cours, non traitée
    ACKNOWLEDGED,   // Vue et prise en charge par un opérateur
    RESOLVED        // Problème résolu
}
