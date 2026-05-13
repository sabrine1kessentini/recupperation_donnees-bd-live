package com.digitaltwin.building_service.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class IfcParserService {

    @Value("${building.ifc.path}")
    private String ifcPath;

    /**
     * IFC entity data holder for extracted elements
     */
    public static class IfcElement {
        private final String entityRef;
        private final String globalId;
        private final String name;
        private final String longName;
        private final String ifcType;
        private String storey;

        public IfcElement(String globalId, String name, String ifcType) {
            this(null, globalId, name, null, ifcType);
        }

        public IfcElement(String entityRef, String globalId, String name, String longName, String ifcType) {
            this.entityRef = entityRef;
            this.globalId = globalId;
            this.name = name;
            this.longName = longName;
            this.ifcType = ifcType;
        }

        public String getEntityRef() { return entityRef; }
        public String getGlobalId() { return globalId; }
        public String getName() { return name; }
        public String getLongName() { return longName; }
        public String getIfcType() { return ifcType; }
        public String getStorey() { return storey; }
        public void setStorey(String storey) { this.storey = storey; }
    }

    /**
     * IFC Hierarchy structure
     */
    public static class IfcHierarchy {
        private final List<IfcElement> buildings = new ArrayList<>();
        private final List<IfcElement> floors = new ArrayList<>();
        private final List<IfcElement> spaces = new ArrayList<>();
        private final List<IfcElement> devices = new ArrayList<>();

        public List<IfcElement> getBuildings() { return buildings; }
        public List<IfcElement> getFloors() { return floors; }
        public List<IfcElement> getSpaces() { return spaces; }
        public List<IfcElement> getDevices() { return devices; }

        public void addBuilding(IfcElement e) { buildings.add(e); }
        public void addFloor(IfcElement e) { floors.add(e); }
        public void addSpace(IfcElement e) { spaces.add(e); }
        public void addDevice(IfcElement e) { devices.add(e); }
    }

    /**
     * Get the resolved IFC file path
     */
    private Path getResolvedPath() {
        Path path = Paths.get(ifcPath);
        // If path is relative, resolve against current working directory
        if (!path.isAbsolute()) {
            path = Paths.get(System.getProperty("user.dir"), ifcPath).normalize();
        }
        return path;
    }

    /**
     * Extract complete IFC hierarchy: Buildings → Floors → Spaces → Devices
     */
    public IfcHierarchy extractHierarchy() {
        IfcHierarchy hierarchy = new IfcHierarchy();
        Map<String, IfcElement> floorsByRef = new LinkedHashMap<>();
        Map<String, IfcElement> spacesByRef = new LinkedHashMap<>();
        Map<String, String> spaceToStoreyRef = new LinkedHashMap<>();
        Path path = getResolvedPath();

        System.out.println("IFC Parser: Reading file from: " + path.toAbsolutePath());

        try {
            List<String> lines = java.nio.file.Files.readAllLines(path);
            System.out.println("IFC Parser: Read " + lines.size() + " lines");

            for (String line : lines) {
                // Extract IFCBUILDING (Buildings)
                if (line.contains("IFCBUILDING") && !line.contains("IFCBUILDINGSTOREY")) {
                    IfcElement building = parseIfcElement(line, "IFCBUILDING");
                    if (building != null) {
                        hierarchy.addBuilding(building);
                    }
                }
                // Extract IFCBUILDINGSTOREY (Floors)
                else if (line.contains("IFCBUILDINGSTOREY")) {
                    IfcElement floor = parseIfcElement(line, "IFCBUILDINGSTOREY");
                    if (floor != null) {
                        hierarchy.addFloor(floor);
                        floorsByRef.put(floor.getEntityRef(), floor);
                    }
                }
                // Extract IFCSPACE (Rooms)
                else if (line.contains("IFCSPACE")) {
                    IfcElement space = parseIfcElement(line, "IFCSPACE");
                    if (space != null) {
                        hierarchy.addSpace(space);
                        spacesByRef.put(space.getEntityRef(), space);
                    }
                }
                else if (line.contains("IFCRELCONTAINEDINSPATIALSTRUCTURE")) {
                    collectSpatialRelation(line, spaceToStoreyRef);
                }
                else if (line.contains("IFCRELAGGREGATES")) {
                    collectAggregateRelation(line, spaceToStoreyRef);
                }
                // Extract IFCDEVICE (Equipment)
                else if (line.contains("IFCDEVICE")) {
                    IfcElement device = parseIfcElement(line, "IFCDEVICE");
                    if (device != null) {
                        hierarchy.addDevice(device);
                    }
                }
            }

            applyStoreys(spacesByRef, floorsByRef, spaceToStoreyRef);

            System.out.println("IFC Parser: Found " + hierarchy.getBuildings().size() + " buildings");
            System.out.println("IFC Parser: Found " + hierarchy.getFloors().size() + " floors");
            System.out.println("IFC Parser: Found " + hierarchy.getSpaces().size() + " spaces");
            System.out.println("IFC Parser: Found " + hierarchy.getDevices().size() + " devices");

        } catch (Exception e) {
            System.err.println("IFC Parser Error: " + e.getMessage());
            e.printStackTrace();
        }

        return hierarchy;
    }

    /**
     * Extract all Buildings (IFCBUILDING)
     */
    public List<IfcElement> extractBuildings() {
        IfcHierarchy hierarchy = extractHierarchy();
        return hierarchy.getBuildings();
    }

    /**
     * Extract all Floors (IFCBUILDINGSTOREY)
     */
    public List<IfcElement> extractFloors() {
        IfcHierarchy hierarchy = extractHierarchy();
        return hierarchy.getFloors();
    }

    /**
     * Extract all Spaces/Rooms (IFCSPACE)
     */
    public List<IfcElement> extractSpaces() {
        IfcHierarchy hierarchy = extractHierarchy();
        return hierarchy.getSpaces();
    }

    /**
     * Extract all Devices/Equipment (IFCDEVICE)
     */
    public List<IfcElement> extractDevices() {
        IfcHierarchy hierarchy = extractHierarchy();
        return hierarchy.getDevices();
    }

    /**
     * Parse IFC element from line
     * Format: #ID=IFCTYPE(GLOBALID,'Name',...)
     */
    private IfcElement parseIfcElement(String line, String ifcType) {
        try {
            String entityRef = extractEntityRef(line);
            List<String> args = extractArguments(line, ifcType);
            String globalId = args.size() > 0 ? stripIfcValue(args.get(0)) : extractGlobalId(line);
            String name = args.size() > 2 ? stripIfcValue(args.get(2)) : extractName(line);
            String longName = args.size() > 7 ? stripIfcValue(args.get(7)) : null;
            return new IfcElement(entityRef, globalId, cleanName(name), cleanName(longName), ifcType);
        } catch (Exception e) {
            return null;
        }
    }

    private void collectSpatialRelation(String line, Map<String, String> spaceToStoreyRef) {
        try {
            List<String> args = extractArguments(line, "IFCRELCONTAINEDINSPATIALSTRUCTURE");
            if (args.size() < 6) {
                return;
            }

            String relatedElements = args.get(4).trim();
            String relatingStructure = args.get(5).trim();
            for (String ref : extractRefs(relatedElements)) {
                spaceToStoreyRef.put(ref, relatingStructure);
            }
        } catch (Exception ignored) {
            // Keep the parser permissive: missing storey data should not hide rooms.
        }
    }

    private void collectAggregateRelation(String line, Map<String, String> spaceToStoreyRef) {
        try {
            List<String> args = extractArguments(line, "IFCRELAGGREGATES");
            if (args.size() < 6) {
                return;
            }

            String relatingObject = args.get(4).trim();
            String relatedObjects = args.get(5).trim();
            for (String ref : extractRefs(relatedObjects)) {
                spaceToStoreyRef.put(ref, relatingObject);
            }
        } catch (Exception ignored) {
            // IFC files are often noisy; bad aggregate relations should not block parsing.
        }
    }

    private void applyStoreys(Map<String, IfcElement> spacesByRef,
                              Map<String, IfcElement> floorsByRef,
                              Map<String, String> spaceToStoreyRef) {
        for (Map.Entry<String, String> entry : spaceToStoreyRef.entrySet()) {
            IfcElement space = spacesByRef.get(entry.getKey());
            IfcElement floor = floorsByRef.get(entry.getValue());
            if (space != null && floor != null) {
                space.setStorey(floor.getLongName() != null ? floor.getLongName() : floor.getName());
            }
        }
    }

    private String extractEntityRef(String line) {
        int start = line.indexOf("#");
        int end = line.indexOf("=");
        if (start == -1 || end == -1 || end <= start) {
            return null;
        }
        return line.substring(start, end).trim();
    }

    private List<String> extractArguments(String line, String ifcType) {
        int typeIndex = line.indexOf(ifcType);
        if (typeIndex == -1) {
            return List.of();
        }
        int start = line.indexOf("(", typeIndex);
        int end = line.lastIndexOf(")");
        if (start == -1 || end == -1 || end <= start) {
            return List.of();
        }
        return splitIfcArguments(line.substring(start + 1, end));
    }

    private List<String> splitIfcArguments(String raw) {
        List<String> args = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        int depth = 0;
        boolean inString = false;

        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            if (c == '\'') {
                current.append(c);
                if (inString && i + 1 < raw.length() && raw.charAt(i + 1) == '\'') {
                    current.append(raw.charAt(i + 1));
                    i++;
                } else {
                    inString = !inString;
                }
                continue;
            }
            if (!inString) {
                if (c == '(') depth++;
                if (c == ')') depth--;
                if (c == ',' && depth == 0) {
                    args.add(current.toString().trim());
                    current.setLength(0);
                    continue;
                }
            }
            current.append(c);
        }

        args.add(current.toString().trim());
        return args;
    }

    private List<String> extractRefs(String raw) {
        List<String> refs = new ArrayList<>();
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("#\\d+").matcher(raw);
        while (matcher.find()) {
            refs.add(matcher.group());
        }
        return refs;
    }

    private String stripIfcValue(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        if ("$".equals(trimmed) || "*".equals(trimmed)) return null;
        if (trimmed.length() >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
            return trimmed.substring(1, trimmed.length() - 1).replace("''", "'");
        }
        return trimmed;
    }

    private String cleanName(String value) {
        if (value == null || value.trim().isEmpty() || "$".equals(value.trim())) {
            return null;
        }
        return value.trim();
    }

    /**
     * Extract GlobalId from IFC line
     * Format: #ID=IFCTYPE('GlobalId','Name',...)
     */
    private String extractGlobalId(String line) {
        // Find the GlobalId pattern: 'XXXXXXXX' where X is alphanumeric
        int start = line.indexOf("'");
        if (start == -1) return "Unknown";

        int end = line.indexOf("'", start + 1);
        if (end == -1) return "Unknown";

        return line.substring(start + 1, end);
    }

    /**
     * Extract Name from IFC line
     * Format: IFCtype('GlobalId','Name',...) or IFCtype('GlobalId',$,...)
     */
    private String extractName(String line) {
        // Find second quoted string (Name)
        int firstQuote = line.indexOf("'");
        if (firstQuote == -1) return "Unknown";

        int secondQuote = line.indexOf("'", firstQuote + 1);
        if (secondQuote == -1) return "Unknown";

        int thirdQuote = line.indexOf("'", secondQuote + 1);
        if (thirdQuote == -1) return "Unknown";

        int fourthQuote = line.indexOf("'", thirdQuote + 1);
        if (fourthQuote == -1) return "Unknown";

        String name = line.substring(thirdQuote + 1, fourthQuote);

        // Handle $ (null in IFC) or empty name
        if (name.equals("$") || name.trim().isEmpty()) {
            return "Unnamed";
        }

        return name.replace("'", "");
    }

    /**
     * Legacy method for backward compatibility
     */
    public List<String> extractBuildingNames() {
        List<IfcElement> buildings = extractBuildings();
        List<String> names = new ArrayList<>();
        for (IfcElement building : buildings) {
            names.add(building.getName());
        }
        return names;
    }
}
