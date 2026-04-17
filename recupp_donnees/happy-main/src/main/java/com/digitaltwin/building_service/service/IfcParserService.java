package com.digitaltwin.building_service.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class IfcParserService {

    @Value("${building.ifc.path}")
    private String ifcPath;

    /**
     * IFC entity data holder for extracted elements
     */
    public static class IfcElement {
        private final String globalId;
        private final String name;
        private final String ifcType;

        public IfcElement(String globalId, String name, String ifcType) {
            this.globalId = globalId;
            this.name = name;
            this.ifcType = ifcType;
        }

        public String getGlobalId() { return globalId; }
        public String getName() { return name; }
        public String getIfcType() { return ifcType; }
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
                    }
                }
                // Extract IFCSPACE (Rooms)
                else if (line.contains("IFCSPACE")) {
                    IfcElement space = parseIfcElement(line, "IFCSPACE");
                    if (space != null) {
                        hierarchy.addSpace(space);
                    }
                }
                // Extract IFCDEVICE (Equipment)
                else if (line.contains("IFCDEVICE")) {
                    IfcElement device = parseIfcElement(line, "IFCDEVICE");
                    if (device != null) {
                        hierarchy.addDevice(device);
                    }
                }
            }

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
            String globalId = extractGlobalId(line);
            String name = extractName(line);
            return new IfcElement(globalId, name, ifcType);
        } catch (Exception e) {
            return null;
        }
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
