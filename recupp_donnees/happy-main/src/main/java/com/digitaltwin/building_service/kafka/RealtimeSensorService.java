package com.digitaltwin.building_service.kafka;

import com.digitaltwin.building_service.dto.RealtimeMeasurementDto;
import com.digitaltwin.building_service.service.WaveonFusionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.stream.Collectors;

/**
 * Service de cache temps réel des lectures de capteurs.
 * 
 * Contrairement à SensorPollingScheduler qui publie seulement toutes les 5 minutes,
 * ce service maintient un cache actualisé toutes les X secondes (par défaut 2s)
 * et permet aux consommateurs d'obtenir les dernières valeurs sans attendre le prochain polling Kafka.
 * 
 * Ce service peut aussi être déclenché via l'API REST /api/realtime pour fournir
 * des données fraîches même si Kafka n'est pas configuré.
 */
@Component
public class RealtimeSensorService {

    private static final Logger log = LoggerFactory.getLogger(RealtimeSensorService.class);

    private final WaveonFusionService waveonFusionService;
    private final SensorDataProducer sensorDataProducer;

    // Cache des dernières lectures
    private final Map<String, RealtimeMeasurementDto> lastReadingsCache = new ConcurrentHashMap<>();
    private final Queue<RealtimeMeasurementDto> recentReadingsQueue = new ConcurrentLinkedQueue<>();

    @Value("${building.kafka.topic:building.sensor.readings}")
    private String topic;

    @Value("${building.realtime.cache-ttl-ms:2000}")
    private long cacheTtlMs;

    @Value("${building.kafka.polling-interval-ms:300000}")
    private long pollingIntervalMs;

    // Timestamp du dernier rafraîchissement
    private volatile long lastRefreshTimestamp = 0;

    public RealtimeSensorService(WaveonFusionService waveonFusionService, SensorDataProducer sensorDataProducer) {
        this.waveonFusionService = waveonFusionService;
        this.sensorDataProducer = sensorDataProducer;
    }

    @PostConstruct
    public void init() {
        log.info("RealtimeSensorService initialized with cache-ttl={}ms, kafka-polling={}ms",
                cacheTtlMs, pollingIntervalMs);
        // Chargement initial des capteurs configurés (même sans données)
        loadSensorDefinitions();
    }

    /**
     * Charge la liste des capteurs définis dans la configuration.
     * Utile pour initialiser le cache avec tous les capteurs connus.
     */
    private void loadSensorDefinitions() {
        try {
            // Appel indirect via WaveonFusionService pour charger les capteurs
            // On utilise getRealtime(null) mais on sait que ça peut renvoyer vide si l'API WaveOn n'est pas joignable
            List<RealtimeMeasurementDto> list = waveonFusionService.getRealtime(null);
            list.forEach(dto -> {
                lastReadingsCache.put(dto.sensorId(), dto);
                addToRecentQueue(dto);
            });
            log.info("Loaded {} sensor definitions into cache", list.size());
        } catch (Exception e) {
            log.warn("Could not load sensor definitions: {}", e.getMessage());
        }
    }

    /**
     * Tâche planifiée qui rafraîchit le cache périodiquement.
     * L'intervalle est configuré par building.realtime.cache-ttl-ms.
     */
    @Scheduled(fixedRateString = "${building.realtime.cache-ttl-ms:2000}")
    public void refreshCache() {
        long start = System.currentTimeMillis();
        try {
            List<RealtimeMeasurementDto> freshReadings = waveonFusionService.getRealtime(null);
            int newCount = 0;
            int updatedCount = 0;

            for (RealtimeMeasurementDto dto : freshReadings) {
                RealtimeMeasurementDto previous = lastReadingsCache.get(dto.sensorId());
                if (previous == null || !areEqual(previous, dto)) {
                    lastReadingsCache.put(dto.sensorId(), dto);
                    addToRecentQueue(dto);
                    if (previous == null) {
                        newCount++;
                    } else {
                        updatedCount++;
                    }
                }
            }

            lastRefreshTimestamp = System.currentTimeMillis();
            long elapsed = lastRefreshTimestamp - start;

            if (updatedCount > 0 || newCount > 0) {
                log.debug("Cache refreshed: {} new, {} updated, elapsed {}ms", newCount, updatedCount, elapsed);
            }
        } catch (Exception e) {
            log.error("Failed to refresh realtime cache: {}", e.getMessage());
        }
    }

    /**
     * Force un rafraîchissement immédiat du cache.
     * Utilisable via l'API REST.
     */
    public void forceRefresh() {
        try {
            refreshCache();
            log.info("Forced cache refresh completed");
        } catch (Exception e) {
            log.error("Forced cache refresh failed: {}", e.getMessage());
        }
    }

    /**
     * Récupère l'instant de la dernière mise à jour du cache.
     */
    public Instant getLastRefreshTime() {
        return lastRefreshTimestamp > 0 ? Instant.ofEpochMilli(lastRefreshTimestamp) : null;
    }

    /**
     * Récupère la dernière lecture pour un capteur donné.
     */
    public RealtimeMeasurementDto getLatestReading(String sensorId) {
        return lastReadingsCache.get(sensorId);
    }

    /**
     * Récupère la dernière lecture pour tous les capteurs.
     */
    public List<RealtimeMeasurementDto> getAllLatestReadings() {
        return new ArrayList<>(lastReadingsCache.values());
    }

    /**
     * Récupère les N lectures récentes (tous capteurs confondus).
     */
    public List<RealtimeMeasurementDto> getRecentReadings(int maxCount) {
        List<RealtimeMeasurementDto> recent = new ArrayList<>(recentReadingsQueue);
        int size = recent.size();
        if (size <= maxCount) {
            return recent;
        }
        return recent.subList(size - maxCount, size);
    }

    /**
     * Récupère toutes les lectures récentes pour un capteur spécifique.
     */
    public List<RealtimeMeasurementDto> getRecentReadingsForSensor(String sensorId, int maxCount) {
        return getRecentReadings(maxCount).stream()
                .filter(dto -> dto.sensorId().equals(sensorId))
                .collect(Collectors.toList());
    }

    /**
     * Déclenche manuellement l'envoi des données courantes vers Kafka.
     * Utile pour initier le flux Kafka même si le poller long n'a pas encore fonctionné.
     */
    public void publishCurrentToKafka() {
        int published = 0;
        for (RealtimeMeasurementDto dto : lastReadingsCache.values()) {
            if (dto.value() != null) {
                try {
                    sensorDataProducer.send(
                            new SensorReadingEvent(
                                    dto.sensorId(),
                                    dto.sensorType(),
                                    dto.label(),
                                    dto.ifcGlobalId(),
                                    dto.roomName(),
                                    dto.unit(),
                                    dto.value(),
                                    dto.status(),
                                    dto.timestamp() != null ? dto.timestamp() : Instant.now()
                            )
                    );
                    published++;
                } catch (Exception e) {
                    log.error("Failed to publish {} to Kafka: {}", dto.sensorId(), e.getMessage());
                }
            }
        }
        log.info("Published {} current readings to Kafka", published);
    }

    /**
     * Ajoute une lecture à la file des lectures récentes.
     * Garde seulement les 500 dernières entrées.
     */
    private void addToRecentQueue(RealtimeMeasurementDto dto) {
        recentReadingsQueue.offer(dto);
        // Garder seulement les 500 dernières
        while (recentReadingsQueue.size() > 500) {
            recentReadingsQueue.poll();
        }
    }

    /**
     * Compare deux DTOs de lecture.
     */
    private boolean areEqual(RealtimeMeasurementDto a, RealtimeMeasurementDto b) {
        if (a == b) return true;
        if (a == null || b == null) return false;
        return Objects.equals(a.value(), b.value()) &&
                Objects.equals(a.status(), b.status()) &&
                Objects.equals(a.timestamp(), b.timestamp());
    }

    /**
     * Métriques du cache pour monitoring.
     */
    public Map<String, Object> getCacheMetrics() {
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("cachedSensors", lastReadingsCache.size());
        metrics.put("recentReadings", recentReadingsQueue.size());
        metrics.put("lastRefresh", getLastRefreshTime());
        metrics.put("cacheTtlMs", cacheTtlMs);
        metrics.put("pollingIntervalMs", pollingIntervalMs);
        return metrics;
    }
}
