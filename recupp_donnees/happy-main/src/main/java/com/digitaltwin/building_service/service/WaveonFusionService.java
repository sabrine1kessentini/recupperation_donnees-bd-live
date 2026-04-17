package com.digitaltwin.building_service.service;

import com.digitaltwin.building_service.domain.Zone;
import com.digitaltwin.building_service.dto.RealtimeMeasurementDto;
import com.digitaltwin.building_service.dto.SensorDetailsDto;
import com.digitaltwin.building_service.dto.SensorHistoryDto;
import com.digitaltwin.building_service.dto.SensorSummaryDto;
import com.digitaltwin.building_service.dto.SpaceSensorDto;
import com.digitaltwin.building_service.dto.TelemetryPointDto;
import com.digitaltwin.building_service.repository.ZoneRepository;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class WaveonFusionService {

    private static final Logger log = LoggerFactory.getLogger(WaveonFusionService.class);

    private static final DateTimeFormatter HISTORY_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");
    private static final DateTimeFormatter ENERGY_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm");

    private static final List<SensorDefinition> SENSOR_DEFINITIONS = List.of(
            new SensorDefinition("temperature", "Temperature Sensor", "degC"),
            new SensorDefinition("humidity", "Humidity Sensor", "%"),
            new SensorDefinition("occupancy", "Occupancy Sensor", "presence"),
            new SensorDefinition("luminosity", "Luminosity Sensor", "%"),
            new SensorDefinition("energy", "Energy Sensor", "kWh"),
            new SensorDefinition("flow", "Flow Sensor", "L/min")
    );

    private final ObjectMapper objectMapper;
    private final ZoneRepository zoneRepository;
    private final RestClient restClient;
    private final String mappingPath;
    private final boolean remoteEnabled;
    private final String proxyPrefix;
    private final String authBaseUrl;
    private final String loginPath;
    private final String email;
    private final String password;
    private final String deviceName;
    private final String defaultSyncTimestamp;
    private final String energyParameter;
    private final String flowParameter;
    private final int realtimeLookbackHours;

    // Session statique optionnelle (court-circuite le login)
    private final int staticIdClient;
    private final int staticIdUser;
    private final String staticToken;

    private final Map<String, SmartController> controllerCache = new ConcurrentHashMap<>();
    private volatile WaveonSession cachedSession;

    public WaveonFusionService(
            ObjectMapper objectMapper,
            ZoneRepository zoneRepository,
            RestClient restClient,
            @Value("${building.mapping.path}") String mappingPath,
            @Value("${building.fusion-api.enabled:false}") boolean remoteEnabled,
            @Value("${building.fusion-api.proxy-prefix:/proxy/:81}") String proxyPrefix,
            @Value("${building.fusion-api.auth-base-url:https://iot.waveon.tn/WS_WAVEON}") String authBaseUrl,
            @Value("${building.fusion-api.login-path:/LoginClientService/}") String loginPath,
            @Value("${building.fusion-api.email:}") String email,
            @Value("${building.fusion-api.password:}") String password,
            @Value("${building.fusion-api.device-name:building-service}") String deviceName,
            @Value("${building.fusion-api.default-sync-timestamp:2019-10-01 01:01:01}") String defaultSyncTimestamp,
            @Value("${building.fusion-api.energy-parameter:tae}") String energyParameter,
            @Value("${building.fusion-api.flow-parameter:flow_rate}") String flowParameter,
            @Value("${building.fusion-api.realtime-lookback-hours:24}") int realtimeLookbackHours,
            @Value("${building.fusion-api.static-id-client:0}") int staticIdClient,
            @Value("${building.fusion-api.static-id-user:0}") int staticIdUser,
            @Value("${building.fusion-api.static-token:}") String staticToken) {
        this.objectMapper = objectMapper;
        this.zoneRepository = zoneRepository;
        this.restClient = restClient;
        this.mappingPath = mappingPath;
        this.remoteEnabled = remoteEnabled;
        this.proxyPrefix = proxyPrefix;
        this.authBaseUrl = authBaseUrl;
        this.loginPath = loginPath;
        this.email = email;
        this.password = password;
        this.deviceName = deviceName;
        this.defaultSyncTimestamp = defaultSyncTimestamp;
        this.energyParameter = energyParameter;
        this.flowParameter = flowParameter;
        this.realtimeLookbackHours = realtimeLookbackHours;
        this.staticIdClient = staticIdClient;
        this.staticIdUser = staticIdUser;
        this.staticToken = staticToken;
    }

    /**
     * Endpoint de diagnostic : retourne les infos de session WaveOn sans exposer le token complet.
     */
    public Map<String, Object> getSessionInfo() {
        try {
            WaveonSession session = getSession();
            Map<String, Object> info = new LinkedHashMap<>();
            info.put("status", "OK");
            info.put("idclient", session.idClient());
            info.put("iduser", session.idUser());
            String t = session.token();
            info.put("token", t.length() > 4 ? "****" + t.substring(t.length() - 4) : "****");
            info.put("mode", (staticIdClient > 0 && StringUtils.hasText(staticToken)) ? "STATIC" : "DYNAMIC_LOGIN");
            return info;
        } catch (Exception e) {
            return Map.of("status", "ERROR", "message", e.getMessage());
        }
    }
    public List<SpaceSensorDto> getSpaces() {
        Map<String, Zone> zonesByName = zoneRepository.findAll().stream()
                .collect(Collectors.toMap(zone -> normalize(zone.getName()), zone -> zone, (a, b) -> a, LinkedHashMap::new));

        return loadMappings().stream()
                .map(room -> toSpaceDto(room, zonesByName))
                .sorted(Comparator.comparing(SpaceSensorDto::ifcName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();
    }

    public SensorDetailsDto getSensor(String sensorId) {
        SensorView sensor = getRequiredSensor(sensorId);
        return new SensorDetailsDto(
                sensor.id(),
                sensor.type(),
                sensor.label(),
                sensor.networkId(),
                sensor.unicastAddress(),
                sensor.ifcGlobalId(),
                sensor.ifcName(),
                sensor.ifcLongName(),
                sensor.storey(),
                sensor.areaM2(),
                sensor.zoneId(),
                resolveRealtime(sensor, true)
        );
    }

    public List<RealtimeMeasurementDto> getRealtime(String sensorId) {
        return resolveSensors(sensorId).stream()
                .map(sensor -> resolveRealtime(sensor, true))
                .toList();
    }

    public List<SensorHistoryDto> getHistory(String sensorId, Integer hours, Integer points) {
        int effectiveHours = hours == null || hours < 1 ? 24 : Math.min(hours, 24 * 30);
        int effectivePoints = points == null || points < 2 ? 24 : Math.min(points, 500);

        return resolveSensors(sensorId).stream()
                .map(sensor -> resolveHistory(sensor, effectiveHours, effectivePoints, true))
                .toList();
    }

    private List<SensorView> resolveSensors(String sensorId) {
        return StringUtils.hasText(sensorId) ? List.of(getRequiredSensor(sensorId)) : loadSensors();
    }

    private RealtimeMeasurementDto resolveRealtime(SensorView sensor, boolean lenient) {
        if (!remoteEnabled) {
            Instant now = Instant.now();
            double value = computeLocalValue(sensor, now);
            return realtimeDto(sensor, now, value, sensor.unit(), statusFor(sensor.type(), value));
        }

        try {
            SensorHistoryDto history = fetchRemoteHistory(sensor, realtimeLookbackHours, 120);
            TelemetryPointDto last = history.points().isEmpty() ? null : history.points().get(history.points().size() - 1);
            if (last == null) {
                return realtimeDto(sensor, null, null, history.unit(), "NO_DATA");
            }
            return realtimeDto(sensor, last.timestamp(), last.value(), history.unit(), statusFor(sensor.type(), last.value()));
        } catch (RuntimeException e) {
            if (lenient) {
                return realtimeDto(sensor, null, null, sensor.unit(), "UNAVAILABLE");
            }
            throw e;
        }
    }

    private SensorHistoryDto resolveHistory(SensorView sensor, int hours, int points, boolean lenient) {
        if (!remoteEnabled) {
            return localHistory(sensor, hours, points);
        }
        try {
            return fetchRemoteHistory(sensor, hours, points);
        } catch (RuntimeException e) {
            if (lenient) {
                return new SensorHistoryDto(sensor.id(), sensor.type(), sensor.label(), sensor.unit(), sensor.ifcGlobalId(), sensor.ifcName(), List.of());
            }
            throw e;
        }
    }

    private List<SensorView> loadSensors() {
        Map<String, Zone> zonesByName = zoneRepository.findAll().stream()
                .collect(Collectors.toMap(zone -> normalize(zone.getName()), zone -> zone, (a, b) -> a, LinkedHashMap::new));
        List<SensorView> sensors = new ArrayList<>();

        for (MappingRoom room : loadMappings()) {
            Zone zone = zonesByName.get(normalize(room.ifcName));
            for (SensorDefinition definition : SENSOR_DEFINITIONS) {
                Integer unicast = room.waveon == null ? null : room.waveon.getUnicast(definition.type());
                if (unicast == null) {
                    continue;
                }
                sensors.add(new SensorView(
                        sensorId(room.ifcGlobalId, definition.type()),
                        definition.type(),
                        definition.label(),
                        room.waveon.idNetwork,
                        unicast,
                        room.ifcGlobalId,
                        room.ifcName,
                        room.ifcLongName,
                        room.storey,
                        room.areaM2,
                        zone != null ? zone.getId() : null,
                        definition.unit()
                ));
            }
        }

        sensors.sort(Comparator.comparing(SensorView::id));
        return sensors;
    }

    private SensorView getRequiredSensor(String sensorId) {
        return loadSensors().stream()
                .filter(sensor -> sensor.id().equals(sensorId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sensor not found: " + sensorId));
    }

    private SpaceSensorDto toSpaceDto(MappingRoom room, Map<String, Zone> zonesByName) {
        Zone zone = zonesByName.get(normalize(room.ifcName));
        List<SensorSummaryDto> sensors = SENSOR_DEFINITIONS.stream()
                .map(definition -> {
                    Integer unicast = room.waveon == null ? null : room.waveon.getUnicast(definition.type());
                    return unicast == null ? null : new SensorSummaryDto(
                            sensorId(room.ifcGlobalId, definition.type()),
                            definition.type(),
                            definition.label(),
                            room.waveon.idNetwork,
                            unicast
                    );
                })
                .filter(Objects::nonNull)
                .toList();

        return new SpaceSensorDto(
                zone != null ? zone.getId() : null,
                room.ifcGlobalId,
                room.ifcName,
                room.ifcLongName,
                room.storey,
                room.areaM2,
                Boolean.TRUE.equals(room.mapped),
                room.waveon != null ? room.waveon.idNetwork : null,
                sensors
        );
    }

    private RealtimeMeasurementDto realtimeDto(SensorView sensor, Instant timestamp, Double value, String unit, String status) {
        return new RealtimeMeasurementDto(
                sensor.id(),
                sensor.type(),
                sensor.label(),
                timestamp,
                value,
                unit,
                status,
                sensor.ifcGlobalId(),
                sensor.ifcName()
        );
    }

    private SensorHistoryDto localHistory(SensorView sensor, int hours, int points) {
        Instant end = Instant.now();
        long stepMinutes = Math.max(1, (hours * 60L) / Math.max(points - 1, 1));
        List<TelemetryPointDto> data = new ArrayList<>();
        for (int i = points - 1; i >= 0; i--) {
            Instant ts = end.minus(stepMinutes * i, ChronoUnit.MINUTES);
            data.add(new TelemetryPointDto(ts, computeLocalValue(sensor, ts)));
        }
        return new SensorHistoryDto(sensor.id(), sensor.type(), sensor.label(), sensor.unit(), sensor.ifcGlobalId(), sensor.ifcName(), data);
    }

    private SensorHistoryDto fetchRemoteHistory(SensorView sensor, int hours, int points) {
        Instant end = Instant.now().truncatedTo(ChronoUnit.MINUTES);
        Instant start = end.minus(hours, ChronoUnit.HOURS);
        WaveonSession session = getSession();

        return isGenericSensor(sensor.type())
                ? fetchGenericHistory(sensor, session, start, end, points)
                : fetchEnvironmentalHistory(sensor, session, start, end, points);
    }

    private SensorHistoryDto fetchEnvironmentalHistory(SensorView sensor, WaveonSession session, Instant start, Instant end, int points) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("unicast", sensor.unicastAddress());
        body.put("id_client", session.idClient());
        body.put("id_network", sensor.networkId());
        body.put("id_user", session.idUser());
        body.put("token", session.token());
        body.put("start_timestamp", HISTORY_FORMAT.format(start.atOffset(ZoneOffset.UTC)));
        body.put("end_timestamp", HISTORY_FORMAT.format(end.atOffset(ZoneOffset.UTC)));

        JsonNode root = post(fullPath(true, endpointFor(sensor.type())), body, true);
        List<TelemetryPointDto> data = extractEnvironmentalPoints(root, sensor.type());
        return new SensorHistoryDto(
                sensor.id(),
                sensor.type(),
                sensor.label(),
                unitFor(sensor, null),
                sensor.ifcGlobalId(),
                sensor.ifcName(),
                downsample(data, points)
        );
    }

    private SensorHistoryDto fetchGenericHistory(SensorView sensor, WaveonSession session, Instant start, Instant end, int points) {
        String parameter = parameterFor(sensor.type());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("unicast", sensor.unicastAddress());
        body.put("id_client", session.idClient());
        body.put("id_network", sensor.networkId());
        body.put("id_user", session.idUser());
        body.put("token", session.token());
        body.put("start_time", ENERGY_FORMAT.format(start.atOffset(ZoneOffset.UTC)));
        body.put("end_time", ENERGY_FORMAT.format(end.atOffset(ZoneOffset.UTC)));

        JsonNode root = post(fullPath(true, "/GetClientGenericEnergyValue/" + parameter), body, true);
        MetricInfo metric = metricInfo(sensor, parameter, session);
        List<TelemetryPointDto> data = new ArrayList<>();
        JsonNode history = root.path("history");
        if (history.isArray()) {
            for (JsonNode entry : history) {
                data.add(new TelemetryPointDto(
                        parseTimestamp(entry.path("timestamp").asText(null)),
                        convertGenericValue(entry.path("value"), sensor.type(), metric)
                ));
            }
        }

        return new SensorHistoryDto(
                sensor.id(),
                sensor.type(),
                sensor.label(),
                unitFor(sensor, metric),
                sensor.ifcGlobalId(),
                sensor.ifcName(),
                downsample(data, points)
        );
    }

    private WaveonSession getSession() {
        WaveonSession current = cachedSession;
        if (current != null) {
            return current;
        }
        synchronized (this) {
            if (cachedSession != null) {
                return cachedSession;
            }

            if (staticIdClient > 0 && staticIdUser > 0 && StringUtils.hasText(staticToken)) {
                cachedSession = new WaveonSession(staticIdClient, staticIdUser, staticToken.trim());
                return cachedSession;
            }

            if (!StringUtils.hasText(email) || !StringUtils.hasText(password)) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "WaveOn credentials are missing. Configure building.fusion-api.email and " +
                        "building.fusion-api.password (or use static-id-client / static-id-user / static-token).");
            }
            log.info("WaveOn login → POST {}", loginUrl());
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("email", email);
            body.put("password", password);
            body.put("devicename", StringUtils.hasText(deviceName) ? deviceName : "building-service");
            JsonNode root = post(loginUrl(), body, false);
            int idClient = root.path("idclient").asInt();
            int idUser = root.path("iduser").asInt();
            String token = root.path("token").asText("").trim();
            if (idClient == 0 || !StringUtils.hasText(token)) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "WaveOn login succeeded but returned an invalid session (idclient=" + idClient + ").");
            }
            log.info("WaveOn login OK → idclient={}, iduser={}, token=****{}", idClient, idUser,
                    token.length() > 4 ? token.substring(token.length() - 4) : "****");
            cachedSession = new WaveonSession(idClient, idUser, token);
            controllerCache.clear();
            return cachedSession;
        }
    }
    private JsonNode post(String path, Object body, boolean retryOn403) {
        log.debug("WaveOn POST {}", path);
        try {
            String json = restClient.post()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);
            if (!StringUtils.hasText(json)) {
                return objectMapper.nullNode();
            }
            return objectMapper.readTree(json);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            log.error("WaveOn response parse error at {}: {}", path, e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "WaveOn response parse error: " + e.getMessage(), e);
        } catch (RestClientResponseException e) {
            if (retryOn403 && e.getStatusCode() == HttpStatus.FORBIDDEN) {
                log.warn("WaveOn 403 sur {} → invalidation session et re-login", path);
                synchronized (this) {
                    cachedSession = null;
                    controllerCache.clear();
                }
                WaveonSession newSession = getSession();
                Object newBody = injectNewToken(body, newSession);
                return post(path, newBody, false);
            }
            log.error("WaveOn API error for path {}: HTTP {} - {}", path,
                    e.getStatusCode().value(), e.getResponseBodyAsString());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "WaveOn API error for path " + path + ": HTTP "
                    + e.getStatusCode().value() + " - " + e.getResponseBodyAsString(), e);
        } catch (ResourceAccessException e) {
            log.error("WaveOn API unreachable at {}: {}", path, e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "WaveOn API unreachable: " + e.getMessage(), e);
        } catch (RestClientException e) {
            log.error("WaveOn API call failed at {}: {}", path, e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "WaveOn API call failed: " + e.getMessage(), e);
        }
    }

    /**
     * Injecte le token de la nouvelle session dans le body de la requête.
     * Le body est une Map<String, Object> dans tous les cas d'usage.
     */
    @SuppressWarnings("unchecked")
    private Object injectNewToken(Object body, WaveonSession session) {
        if (body instanceof Map) {
            Map<String, Object> newBody = new LinkedHashMap<>((Map<String, Object>) body);
            newBody.put("token", session.token());
            newBody.put("id_client", session.idClient());
            newBody.put("id_user", session.idUser());
            // clés alternatives utilisées par certains endpoints
            if (newBody.containsKey("idclient")) newBody.put("idclient", session.idClient());
            if (newBody.containsKey("iduser"))   newBody.put("iduser",   session.idUser());
            return newBody;
        }
        return body;
    }

    private SmartController getSmartController(SensorView sensor, WaveonSession session) {
        String key = sensor.networkId() + ":" + sensor.unicastAddress();
        SmartController cached = controllerCache.get(key);
        if (cached != null) {
            return cached;
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("idclient", session.idClient());
        body.put("iduser", session.idUser());
        body.put("idNetwork", sensor.networkId());
        body.put("token", session.token());
        body.put("lastUpdate", defaultSyncTimestamp);
        body.put("commandLastId", 0);
        body.put("permissionsLastUpdate", defaultSyncTimestamp);
        body.put("roomsLastUpdate", defaultSyncTimestamp);
        body.put("automationLastUpdate", defaultSyncTimestamp);

        JsonNode root = post(fullPath(false, "/ClientGetAllSmartControllerService/"), body, true);
        JsonNode controllers = root.path("controllers");
        if (controllers.isArray()) {
            for (JsonNode controllerNode : controllers) {
                SmartController controller = new SmartController(
                        controllerNode.path("idNetwork").asInt(),
                        controllerNode.path("unicast").asInt(),
                        controllerNode.path("meterConfig").asText(null)
                );
                controllerCache.put(controller.idNetwork() + ":" + controller.unicast(), controller);
            }
        }
        return controllerCache.get(key);
    }

    private MetricInfo metricInfo(SensorView sensor, String parameter, WaveonSession session) {
        SmartController controller = getSmartController(sensor, session);
        if (controller == null || !StringUtils.hasText(controller.meterConfig())) {
            return null;
        }
        try {
            JsonNode config = objectMapper.readTree(controller.meterConfig());
            JsonNode metric = config.path(parameter);
            if (metric.isMissingNode() || metric.isNull()) {
                return null;
            }
            return new MetricInfo(
                    metric.path("unit").asText(null),
                    metric.path("scale").asDouble(1.0),
                    metric.path("offset").asDouble(0.0)
            );
        } catch (IOException e) {
            return null;
        }
    }

    private List<TelemetryPointDto> extractEnvironmentalPoints(JsonNode root, String sensorType) {
        String arrayKey = switch (sensorType) {
            case "temperature" -> "temperature_history";
            case "humidity" -> "humidity_history";
            case "luminosity" -> "luminosity_history";
            case "occupancy" -> "occupancy_history";
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported sensor type: " + sensorType);
        };
        String valueKey = switch (sensorType) {
            case "temperature" -> "temperature";
            case "humidity" -> "humidity";
            case "luminosity" -> "luminosity";
            case "occupancy" -> "occupancy";
            default -> "value";
        };
        List<TelemetryPointDto> data = new ArrayList<>();
        JsonNode history = root.path(arrayKey);
        if (history.isArray()) {
            for (JsonNode entry : history) {
                data.add(new TelemetryPointDto(
                        parseTimestamp(entry.path("timestamp").asText(null)),
                        convertEnvironmentalValue(entry.path(valueKey), sensorType)
                ));
            }
        }
        return data;
    }

    private Double convertEnvironmentalValue(JsonNode raw, String sensorType) {
        if (raw == null || raw.isMissingNode() || raw.isNull()) {
            return null;
        }
        double value = raw.asDouble();
        if ("temperature".equals(sensorType) || "humidity".equals(sensorType)) {
            return round(value / 100.0);
        }
        return round(value);
    }

    private Double convertGenericValue(JsonNode raw, String sensorType, MetricInfo metric) {
        if (raw == null || raw.isMissingNode() || raw.isNull()) {
            return null;
        }
        double value = raw.asDouble();
        if (metric == null) {
            return round(value);
        }
        return round((value / Math.max(metric.scale(), 1.0)) + metric.offset());
    }

    private String unitFor(SensorView sensor, MetricInfo metric) {
        return metric != null && StringUtils.hasText(metric.unit()) ? metric.unit() : sensor.unit();
    }

    private boolean isGenericSensor(String type) {
        return "energy".equals(type) || "flow".equals(type);
    }

    private String endpointFor(String type) {
        return switch (type) {
            case "temperature" -> "/getTempHistory/";
            case "humidity" -> "/getHumHistory/";
            case "luminosity" -> "/getLumHistory/";
            case "occupancy" -> "/getOccupancyHistory/";
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No endpoint for sensor type: " + type);
        };
    }

    private String parameterFor(String type) {
        return switch (type) {
            case "energy" -> energyParameter;
            case "flow" -> flowParameter;
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No generic parameter for sensor type: " + type);
        };
    }

    private String statusFor(String type, Double value) {
        if (value == null) {
            return "UNAVAILABLE";
        }
        if (!"occupancy".equals(type)) {
            return "OK";
        }
        return value >= 0.5 ? "OCCUPIED" : "VACANT";
    }

    private String fullPath(boolean proxy, String path) {
        String p = path.startsWith("/") ? path : "/" + path;
        if (!proxy) {
            return p;
        }
        String prefix = proxyPrefix.startsWith("/") ? proxyPrefix : "/" + proxyPrefix;
        return prefix.endsWith("/") ? prefix.substring(0, prefix.length() - 1) + p : prefix + p;
    }

    private String loginUrl() {
        String normalizedBase = authBaseUrl.endsWith("/") ? authBaseUrl.substring(0, authBaseUrl.length() - 1) : authBaseUrl;
        String normalizedPath = loginPath.startsWith("/") ? loginPath : "/" + loginPath;
        return normalizedBase + normalizedPath;
    }
    private List<TelemetryPointDto> downsample(List<TelemetryPointDto> points, int maxPoints) {
        if (points.size() <= maxPoints || maxPoints < 2) {
            return points;
        }
        List<TelemetryPointDto> sampled = new ArrayList<>();
        double step = (double) (points.size() - 1) / (maxPoints - 1);
        for (int i = 0; i < maxPoints; i++) {
            int index = Math.min((int) Math.round(i * step), points.size() - 1);
            sampled.add(points.get(index));
        }
        return sampled;
    }

    private double computeLocalValue(SensorView sensor, Instant timestamp) {
        long minuteBucket = timestamp.truncatedTo(ChronoUnit.MINUTES).getEpochSecond() / 60;
        double normalized = (Math.abs(Objects.hash(sensor.id(), minuteBucket)) % 1000) / 999.0;
        if ("occupancy".equals(sensor.type())) {
            return normalized >= 0.55 ? 1.0 : 0.0;
        }
        double min = switch (sensor.type()) {
            case "temperature" -> 19.0;
            case "humidity" -> 35.0;
            case "luminosity" -> 5.0;
            case "energy" -> 5.0;
            case "flow" -> 0.5;
            default -> 0.0;
        };
        double max = switch (sensor.type()) {
            case "temperature" -> 26.0;
            case "humidity" -> 65.0;
            case "luminosity" -> 95.0;
            case "energy" -> 40.0;
            case "flow" -> 8.0;
            default -> 1.0;
        };
        return round(min + normalized * (max - min));
    }

    private List<MappingRoom> loadMappings() {
        try {
            return List.of(objectMapper.readValue(resolvePath(mappingPath).toFile(), MappingRoom[].class));
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to read WaveOn mapping file: " + resolvePath(mappingPath), e);
        }
    }

    private Path resolvePath(String configuredPath) {
        Path path = Paths.get(configuredPath);
        return path.isAbsolute() ? path.normalize() : Paths.get(System.getProperty("user.dir"), configuredPath).normalize();
    }

    private String sensorId(String ifcGlobalId, String type) {
        return ifcGlobalId + "--" + type;
    }

    private Instant parseTimestamp(String text) {
        return StringUtils.hasText(text) ? LocalDateTime.parse(text, HISTORY_FORMAT).toInstant(ZoneOffset.UTC) : null;
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private record SensorDefinition(String type, String label, String unit) {
    }

    private record SensorView(
            String id,
            String type,
            String label,
            Integer networkId,
            Integer unicastAddress,
            String ifcGlobalId,
            String ifcName,
            String ifcLongName,
            String storey,
            Double areaM2,
            Long zoneId,
            String unit
    ) {
    }

    private record WaveonSession(Integer idClient, Integer idUser, String token) {
    }


    private record MetricInfo(String unit, double scale, double offset) {
    }

    private record SmartController(Integer idNetwork, Integer unicast, String meterConfig) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class MappingRoom {
        @JsonProperty("ifc_global_id")
        public String ifcGlobalId;
        @JsonProperty("ifc_name")
        public String ifcName;
        @JsonProperty("ifc_long_name")
        public String ifcLongName;
        public String storey;
        @JsonProperty("area_m2")
        public Double areaM2;
        public Boolean mapped;
        public WaveonMapping waveon;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class WaveonMapping {
        @JsonProperty("id_network")
        public Integer idNetwork;
        @JsonProperty("unicast_temperature")
        public Integer unicastTemperature;
        @JsonProperty("unicast_humidity")
        public Integer unicastHumidity;
        @JsonProperty("unicast_occupancy")
        public Integer unicastOccupancy;
        @JsonProperty("unicast_luminosity")
        public Integer unicastLuminosity;
        @JsonProperty("unicast_energy")
        public Integer unicastEnergy;
        @JsonProperty("unicast_flow")
        public Integer unicastFlow;

        public Integer getUnicast(String sensorKey) {
            return switch (sensorKey) {
                case "temperature" -> unicastTemperature;
                case "humidity" -> unicastHumidity;
                case "occupancy" -> unicastOccupancy;
                case "luminosity" -> unicastLuminosity;
                case "energy" -> unicastEnergy;
                case "flow" -> unicastFlow;
                default -> null;
            };
        }
    }
}

