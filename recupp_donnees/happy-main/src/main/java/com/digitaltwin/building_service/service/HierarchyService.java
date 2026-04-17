package com.digitaltwin.building_service.service;

import com.digitaltwin.building_service.domain.*;
import com.digitaltwin.building_service.dto.*;
import com.digitaltwin.building_service.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class HierarchyService {

    private final SiteRepository siteRepository;
    private final BuildingStructureRepository buildingStructureRepository;
    private final FloorRepository floorRepository;
    private final ZoneRepository zoneRepository;
    private final EquipmentRepository equipmentRepository;

    public SiteHierarchyDto getHierarchy() {
        SiteHierarchyDto siteDto = new SiteHierarchyDto();
        siteDto.setSiteName("IFC Site");

        List<Site> sites = siteRepository.findAll();
        if (sites.isEmpty()) {
            return siteDto;
        }

        List<BuildingHierarchyDto> buildingDtos = new ArrayList<>();

        for (Site site : sites) {
            siteDto.setSiteName(site.getName());
            
            for (BuildingStructure building : site.getBuildings()) {
                BuildingHierarchyDto buildingDto = new BuildingHierarchyDto();
                buildingDto.setBuildingId(building.getId());
                buildingDto.setBuildingName(building.getName());
                buildingDto.setGlobalId(building.getCode());

                List<FloorDto> floorDtos = new ArrayList<>();
                for (Floor floor : building.getFloors()) {
                    FloorDto floorDto = new FloorDto();
                    floorDto.setFloorId(floor.getId());
                    floorDto.setFloorName(floor.getName());
                    floorDto.setGlobalId(String.valueOf(floor.getLevelIndex()));

                    List<RoomDto> roomDtos = new ArrayList<>();
                    for (Zone zone : floor.getZones()) {
                        RoomDto roomDto = new RoomDto(
                                zone.getId(),
                                zone.getName(),
                                zone.getType(),
                                "IFCSPACE",
                                new ArrayList<>()
                        );

                        List<EquipmentDto> equipmentDtos = new ArrayList<>();
                        for (Equipment equipment : zone.getEquipments()) {
                            EquipmentDto equipmentDto = new EquipmentDto(
                                    equipment.getId(),
                                    equipment.getName(),
                                    equipment.getCategory(),
                                    equipment.getIfcGlobalId()
                            );
                            equipmentDtos.add(equipmentDto);
                        }

                        roomDto = new RoomDto(
                                roomDto.id(),
                                roomDto.name(),
                                roomDto.globalId(),
                                roomDto.type(),
                                equipmentDtos
                        );
                        roomDtos.add(roomDto);
                    }

                    floorDto.setRooms(roomDtos);
                    floorDtos.add(floorDto);
                }

                buildingDto.setFloors(floorDtos);
                buildingDtos.add(buildingDto);
            }
        }

        siteDto.setBuildings(buildingDtos);
        return siteDto;
    }

    public List<BuildingHierarchyDto> getBuildings() {
        List<BuildingHierarchyDto> buildings = new ArrayList<>();
        
        for (Site site : siteRepository.findAll()) {
            for (BuildingStructure building : site.getBuildings()) {
                BuildingHierarchyDto dto = new BuildingHierarchyDto();
                dto.setBuildingId(building.getId());
                dto.setBuildingName(building.getName());
                dto.setGlobalId(building.getCode());
                buildings.add(dto);
            }
        }

        return buildings;
    }

    public List<FloorDto> getFloors() {
        List<FloorDto> floors = new ArrayList<>();
        
        for (Floor floor : floorRepository.findAll()) {
            FloorDto dto = new FloorDto();
            dto.setFloorId(floor.getId());
            dto.setFloorName(floor.getName());
            dto.setGlobalId(String.valueOf(floor.getLevelIndex()));
            floors.add(dto);
        }

        return floors;
    }

    public List<RoomDto> getRooms() {
        List<RoomDto> rooms = new ArrayList<>();
        
        for (Zone zone : zoneRepository.findAll()) {
            RoomDto dto = new RoomDto(
                    zone.getId(),
                    zone.getName(),
                    zone.getType(),
                    "IFCSPACE",
                    new ArrayList<>()
            );
            rooms.add(dto);
        }

        return rooms;
    }

    public List<EquipmentDto> getEquipment() {
        List<EquipmentDto> equipment = new ArrayList<>();
        
        for (Equipment eq : equipmentRepository.findAll()) {
            EquipmentDto dto = new EquipmentDto(
                    eq.getId(),
                    eq.getName(),
                    eq.getCategory(),
                    eq.getIfcGlobalId()
            );
            equipment.add(dto);
        }

        return equipment;
    }
}