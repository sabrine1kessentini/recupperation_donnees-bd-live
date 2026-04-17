package com.digitaltwin.building_service.init;

import com.digitaltwin.building_service.domain.*;
import com.digitaltwin.building_service.repository.*;
import com.digitaltwin.building_service.service.IfcParserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final SiteRepository siteRepository;
    private final BuildingStructureRepository buildingStructureRepository;
    private final FloorRepository floorRepository;
    private final ZoneRepository zoneRepository;
    private final EquipmentRepository equipmentRepository;
    private final IfcParserService ifcParserService;

    @Override
    @Transactional
    public void run(String... args) {
        if (siteRepository.count() > 0) {
            log.info("Database already initialized, skipping IFC import");
            return;
        }

        log.info("Starting IFC hierarchy import to database...");

        IfcParserService.IfcHierarchy hierarchy = ifcParserService.extractHierarchy();

        Site site = new Site();
        site.setName("IFC Site");
        site.setLocation("Extracted from IFC");

        List<IfcParserService.IfcElement> buildings = hierarchy.getBuildings();
        if (buildings.isEmpty()) {
            log.warn("No buildings found in IFC file");
            site.setName("Default Site");
            siteRepository.save(site);
            return;
        }

        for (IfcParserService.IfcElement buildingElem : buildings) {
            BuildingStructure building = new BuildingStructure();
            building.setName(buildingElem.getName());
            building.setCode(buildingElem.getGlobalId());
            building.setSite(site);
            site.getBuildings().add(building);

            for (IfcParserService.IfcElement floorElem : hierarchy.getFloors()) {
                Floor floor = new Floor();
                floor.setName(floorElem.getName());
                floor.setLevelIndex(0);
                floor.setBuilding(building);
                building.getFloors().add(floor);

                for (IfcParserService.IfcElement spaceElem : hierarchy.getSpaces()) {
                    Zone zone = new Zone();
                    zone.setName(spaceElem.getName());
                    zone.setType("IFCSPACE");
                    zone.setFloor(floor);
                    floor.getZones().add(zone);

                    for (IfcParserService.IfcElement deviceElem : hierarchy.getDevices()) {
                        Equipment equipment = new Equipment();
                        equipment.setName(deviceElem.getName());
                        equipment.setCategory(deviceElem.getIfcType());
                        equipment.setIfcGlobalId(deviceElem.getGlobalId());
                        equipment.setZone(zone);
                        zone.getEquipments().add(equipment);
                    }
                }
            }
        }

        siteRepository.save(site);
        log.info("IFC hierarchy imported successfully: {} buildings, {} floors, {} zones, {} equipment",
                site.getBuildings().size(),
                site.getBuildings().stream().mapToInt(b -> b.getFloors().size()).sum(),
                site.getBuildings().stream().flatMap(b -> b.getFloors().stream())
                        .flatMap(f -> f.getZones().size() > 0 ? f.getZones().stream() : java.util.stream.Stream.empty())
                        .mapToInt(z -> z.getEquipments().size()).sum(),
                site.getBuildings().stream().flatMap(b -> b.getFloors().stream())
                        .flatMap(f -> f.getZones().stream())
                        .mapToInt(z -> z.getEquipments().size()).sum()
        );
    }
}