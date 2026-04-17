package com.digitaltwin.building_service.service;

import com.digitaltwin.building_service.dto.IfcEnrichmentResultDto;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class IfcEnrichmentService {

    private static final Pattern ENTITY_ID_PATTERN = Pattern.compile("^#(\\d+)\\s*=");
    private static final Pattern IFC_SPACE_PATTERN = Pattern.compile("^#(\\d+)\\s*=\\s*IFCSPACE\\((.*)\\);$", Pattern.CASE_INSENSITIVE);
    private static final String IFC_GUID_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
    private static final List<SensorDescriptor> SENSOR_TYPES = List.of(
            new SensorDescriptor("temperature", "Temperature Sensor", "WaveonTemperatureSensor"),
            new SensorDescriptor("humidity", "Humidity Sensor", "WaveonHumiditySensor"),
            new SensorDescriptor("occupancy", "Occupancy Sensor", "WaveonOccupancySensor"),
            new SensorDescriptor("luminosity", "Luminosity Sensor", "WaveonLuminositySensor"),
            new SensorDescriptor("energy", "Energy Sensor", "WaveonEnergySensor"),
            new SensorDescriptor("flow", "Flow Sensor", "WaveonFlowSensor")
    );

    private final IfcService ifcService;
    private final ObjectMapper objectMapper;

    @Value("${building.mapping.path}")
    private String defaultMappingPath;

    @Value("${building.ifc.enriched.path}")
    private String defaultOutputIfcPath;

    public IfcEnrichmentService(IfcService ifcService, ObjectMapper objectMapper) {
        this.ifcService = ifcService;
        this.objectMapper = objectMapper;
    }

    public IfcEnrichmentResultDto enrichIfc(String mappingPathOverride, String outputPathOverride) throws IOException {
        Path sourceIfc = ifcService.getIfcPath();
        Path mappingPath = resolvePath(mappingPathOverride != null && !mappingPathOverride.isBlank()
                ? mappingPathOverride
                : defaultMappingPath);
        Path outputPath = resolvePath(outputPathOverride != null && !outputPathOverride.isBlank()
                ? outputPathOverride
                : defaultOutputIfcPath);

        List<String> lines = Files.readAllLines(sourceIfc, StandardCharsets.UTF_8);
        List<MappingRoom> mappingRooms = List.of(objectMapper.readValue(mappingPath.toFile(), MappingRoom[].class));
        Map<String, SpaceInfo> spacesByGlobalId = extractSpaces(lines);
        List<String> warnings = new ArrayList<>();
        List<String> appendedEntities = new ArrayList<>();

        int nextEntityId = findMaxEntityId(lines) + 1;
        int mappedRoomsProcessed = 0;
        int roomsMatched = 0;
        int roomsSkipped = 0;
        int sensorsCreated = 0;

        for (MappingRoom room : mappingRooms) {
            if (room == null || !Boolean.TRUE.equals(room.mapped) || room.waveon == null || isBlank(room.ifcGlobalId)) {
                roomsSkipped++;
                continue;
            }

            mappedRoomsProcessed++;
            SpaceInfo space = spacesByGlobalId.get(room.ifcGlobalId);
            if (space == null) {
                warnings.add("Piece introuvable dans l'IFC pour GlobalId=" + room.ifcGlobalId);
                roomsSkipped++;
                continue;
            }

            roomsMatched++;
            List<String> roomSensorRefs = new ArrayList<>();
            int sensorIndex = 0;

            for (SensorDescriptor descriptor : SENSOR_TYPES) {
                Integer unicast = room.waveon.getUnicast(descriptor.mappingKey);
                if (unicast == null) {
                    continue;
                }

                double offsetX = 0.40 + (sensorIndex % 3) * 0.35;
                double offsetY = 0.40 + (sensorIndex / 3) * 0.35;
                sensorIndex++;

                String cartesianPoint = ref(nextEntityId++);
                appendedEntities.add(cartesianPoint + "= IFCCARTESIANPOINT((" + formatDouble(offsetX) + "," + formatDouble(offsetY) + ",2.2000));");

                String axisPlacement = ref(nextEntityId++);
                appendedEntities.add(axisPlacement + "= IFCAXIS2PLACEMENT3D(" + cartesianPoint + ",$,$);");

                String localPlacement = ref(nextEntityId++);
                appendedEntities.add(localPlacement + "= IFCLOCALPLACEMENT(" + space.objectPlacementRef + "," + axisPlacement + ");");

                String proxyRef = ref(nextEntityId++);
                String sensorName = escapeIfcString(descriptor.label + " - " + valueOrDefault(room.ifcName, room.ifcGlobalId));
                String sensorObjectType = escapeIfcString(descriptor.objectType);
                String sensorTag = escapeIfcString(descriptor.mappingKey.toUpperCase(Locale.ROOT) + "-" + unicast);
                appendedEntities.add(proxyRef + "= IFCBUILDINGELEMENTPROXY('"
                        + createIfcGuid() + "',#42,'" + sensorName + "',$,'" + sensorObjectType + "',"
                        + localPlacement + ",$,'" + sensorTag + "',.NOTDEFINED.);");

                List<String> propertyRefs = new ArrayList<>();
                propertyRefs.add(createTextProperty(ref(nextEntityId++), "SensorType", descriptor.mappingKey, appendedEntities));
                propertyRefs.add(createIntegerProperty(ref(nextEntityId++), "NetworkId", room.waveon.idNetwork, appendedEntities));
                propertyRefs.add(createIntegerProperty(ref(nextEntityId++), "UnicastAddress", unicast, appendedEntities));
                propertyRefs.add(createTextProperty(ref(nextEntityId++), "RoomGlobalId", room.ifcGlobalId, appendedEntities));
                propertyRefs.add(createTextProperty(ref(nextEntityId++), "RoomName", room.ifcName, appendedEntities));
                propertyRefs.add(createTextProperty(ref(nextEntityId++), "RoomLongName", room.ifcLongName, appendedEntities));

                String propertySetRef = ref(nextEntityId++);
                appendedEntities.add(propertySetRef + "= IFCPROPERTYSET('"
                        + createIfcGuid() + "',#42,'Pset_WaveonSensor',$,(" + String.join(",", propertyRefs) + "));");

                String definesRef = ref(nextEntityId++);
                appendedEntities.add(definesRef + "= IFCRELDEFINESBYPROPERTIES('"
                        + createIfcGuid() + "',#42,$,$,(" + proxyRef + ")," + propertySetRef + ");");

                roomSensorRefs.add(proxyRef);
                sensorsCreated++;
            }

            if (!roomSensorRefs.isEmpty()) {
                String relContainedRef = ref(nextEntityId++);
                appendedEntities.add(relContainedRef + "= IFCRELCONTAINEDINSPATIALSTRUCTURE('"
                        + createIfcGuid() + "',#42,$,$,(" + String.join(",", roomSensorRefs) + ")," + space.entityRef + ");");
            } else {
                warnings.add("Aucun capteur cree pour la piece " + room.ifcGlobalId + " car toutes les adresses etaient nulles.");
            }
        }

        String enrichedContent = injectBeforeEndsec(lines, appendedEntities);
        Path parent = outputPath.getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
        Files.writeString(outputPath, enrichedContent, StandardCharsets.UTF_8);

        return new IfcEnrichmentResultDto(
                sourceIfc.toString(),
                mappingPath.toString(),
                outputPath.toString(),
                mappedRoomsProcessed,
                roomsMatched,
                sensorsCreated,
                roomsSkipped,
                warnings
        );
    }

    public Path getDefaultOutputPath() {
        return resolvePath(defaultOutputIfcPath);
    }

    public Path resolveOutputPath(String outputPathOverride) {
        return resolvePath(outputPathOverride != null && !outputPathOverride.isBlank()
                ? outputPathOverride
                : defaultOutputIfcPath);
    }

    private String createTextProperty(String ref, String name, String value, List<String> appendedEntities) {
        appendedEntities.add(ref + "= IFCPROPERTYSINGLEVALUE('"
                + escapeIfcString(name) + "',$,IFCTEXT('" + escapeIfcString(valueOrDefault(value, "")) + "'),$);");
        return ref;
    }

    private String createIntegerProperty(String ref, String name, Integer value, List<String> appendedEntities) {
        appendedEntities.add(ref + "= IFCPROPERTYSINGLEVALUE('"
                + escapeIfcString(name) + "',$,IFCINTEGER(" + Objects.requireNonNullElse(value, 0) + "),$);");
        return ref;
    }

    private Map<String, SpaceInfo> extractSpaces(List<String> lines) {
        Map<String, SpaceInfo> spaces = new LinkedHashMap<>();

        for (String line : lines) {
            Matcher matcher = IFC_SPACE_PATTERN.matcher(line.trim());
            if (!matcher.matches()) {
                continue;
            }

            String entityRef = "#" + matcher.group(1);
            List<String> args = splitIfcArguments(matcher.group(2));
            if (args.size() < 6) {
                continue;
            }

            String globalId = stripQuoted(args.get(0));
            String name = stripQuoted(args.get(2));
            String objectPlacementRef = args.get(5).trim();

            spaces.put(globalId, new SpaceInfo(entityRef, globalId, name, objectPlacementRef));
        }

        return spaces;
    }

    private int findMaxEntityId(List<String> lines) {
        int max = 0;

        for (String line : lines) {
            Matcher matcher = ENTITY_ID_PATTERN.matcher(line.trim());
            if (matcher.find()) {
                max = Math.max(max, Integer.parseInt(matcher.group(1)));
            }
        }

        return max;
    }

    private String injectBeforeEndsec(List<String> lines, List<String> appendedEntities) {
        StringBuilder builder = new StringBuilder();
        boolean inserted = false;

        for (String line : lines) {
            if (!inserted && "ENDSEC;".equals(line.trim())) {
                for (String entityLine : appendedEntities) {
                    builder.append(entityLine).append(System.lineSeparator());
                }
                inserted = true;
            }

            builder.append(line).append(System.lineSeparator());
        }

        return builder.toString();
    }

    private List<String> splitIfcArguments(String argsRaw) {
        List<String> args = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        int depth = 0;
        boolean inString = false;

        for (int i = 0; i < argsRaw.length(); i++) {
            char c = argsRaw.charAt(i);

            if (c == '\'') {
                current.append(c);
                if (inString && i + 1 < argsRaw.length() && argsRaw.charAt(i + 1) == '\'') {
                    current.append(argsRaw.charAt(i + 1));
                    i++;
                } else {
                    inString = !inString;
                }
                continue;
            }

            if (!inString) {
                if (c == '(') {
                    depth++;
                } else if (c == ')') {
                    depth--;
                } else if (c == ',' && depth == 0) {
                    args.add(current.toString().trim());
                    current.setLength(0);
                    continue;
                }
            }

            current.append(c);
        }

        if (!current.isEmpty()) {
            args.add(current.toString().trim());
        }

        return args;
    }

    private Path resolvePath(String configuredPath) {
        Path path = Paths.get(configuredPath);
        if (!path.isAbsolute()) {
            path = Paths.get(System.getProperty("user.dir"), configuredPath);
        }
        return path.normalize();
    }

    private String stripQuoted(String token) {
        String trimmed = token == null ? "" : token.trim();
        if (trimmed.length() >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
            return trimmed.substring(1, trimmed.length() - 1).replace("''", "'");
        }
        return trimmed;
    }

    private String createIfcGuid() {
        String raw = UUID.randomUUID().toString().replace("-", "");
        StringBuilder builder = new StringBuilder(22);

        for (int i = 0; i < 22; i++) {
            int first = Character.digit(raw.charAt((i * 2) % raw.length()), 16);
            int second = Character.digit(raw.charAt((i * 2 + 1) % raw.length()), 16);
            int index = (first * 16 + second) % IFC_GUID_CHARS.length();
            builder.append(IFC_GUID_CHARS.charAt(index));
        }

        return builder.toString();
    }

    private String escapeIfcString(String value) {
        return value == null ? "" : value.replace("'", "''");
    }

    private String valueOrDefault(String value, String fallback) {
        return isBlank(value) ? fallback : value;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String ref(int entityId) {
        return "#" + entityId;
    }

    private String formatDouble(double value) {
        return String.format(Locale.US, "%.4f", value);
    }

    private record SpaceInfo(String entityRef, String globalId, String name, String objectPlacementRef) {
    }

    private record SensorDescriptor(String mappingKey, String label, String objectType) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class MappingRoom {
        @JsonProperty("ifc_global_id")
        public String ifcGlobalId;
        @JsonProperty("ifc_name")
        public String ifcName;
        @JsonProperty("ifc_long_name")
        public String ifcLongName;
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
