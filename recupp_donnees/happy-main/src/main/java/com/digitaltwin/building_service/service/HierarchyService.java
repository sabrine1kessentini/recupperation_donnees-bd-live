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
    private final FloorRepository floorRepository;
    private final ZoneRepository zoneRepository;
    private final EquipmentRepository equipmentRepository;

    public SiteHierarchyDto getHierarchy() {
        List<Site> sites = siteRepository.findAll();
        SiteHierarchyDto siteDto = new SiteHierarchyDto();
        if (!sites.isEmpty()) {
            Site first = sites.get(0);
            siteDto.setId(first.getId());
            siteDto.setName(first.getName());
            siteDto.setLocation(first.getLocation());
        } else {
            siteDto.setName("IFC Site");
            siteDto.setLocation("");
        }

        List<BuildingHierarchyDto> buildingDtos = new ArrayList<>();

        for (Site site : sites) {
            for (BuildingStructure building : site.getBuildings()) {
                BuildingHierarchyDto buildingDto = new BuildingHierarchyDto();
                buildingDto.setId(building.getId());
                buildingDto.setName(building.getName());
                buildingDto.setCode(building.getCode());

                List<FloorDto> floorDtos = new ArrayList<>();
                for (Floor floor : building.getFloors()) {
                    FloorDto floorDto = new FloorDto();
                    floorDto.setId(floor.getId());
                    floorDto.setName(floor.getName());
                    floorDto.setLevelIndex(floor.getLevelIndex());

                    List<ZoneDto> zoneDtos = new ArrayList<>();
                    for (Zone zone : floor.getZones()) {
                        ZoneDto zoneDto = new ZoneDto(
                                zone.getId(),
                                zone.getName(),
                                zone.getType(),
                                zone.getEquipments().stream()
                                        .map(eq -> new EquipmentDto(
                                                eq.getId(),
                                                eq.getName(),
                                                eq.getCategory(),
                                                eq.getIfcGlobalId()
                                        ))
                                        .toList()
                        );
                        zoneDtos.add(zoneDto);
                    }

                    floorDto.setZones(zoneDtos);
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
                dto.setId(building.getId());
                dto.setName(building.getName());
                dto.setCode(building.getCode());
                dto.setFloors(new ArrayList<>()); // empty list since floors not loaded
                buildings.add(dto);
            }
        }

        return buildings;
    }

    public List<FloorDto> getFloors() {
        List<FloorDto> floors = new ArrayList<>();
        
        for (Floor floor : floorRepository.findAll()) {
            FloorDto dto = new FloorDto();
            dto.setId(floor.getId());
            dto.setName(floor.getName());
            dto.setLevelIndex(floor.getLevelIndex());
            dto.setZones(new ArrayList<>()); // zones not loaded in this endpoint
            floors.add(dto);
        }

        return floors;
    }

    public List<RoomDto> getRooms() {
        List<RoomDto> rooms = new ArrayList<>();
        
        for (Zone zone : zoneRepository.findAll()) {
            List<EquipmentDto> equipmentDtos = zone.getEquipments().stream()
                    .map(eq -> new EquipmentDto(
                            eq.getId(),
                            eq.getName(),
                            eq.getCategory(),
                            eq.getIfcGlobalId()
                    ))
                    .toList();
            
            RoomDto dto = new RoomDto(
                    zone.getId(),
                    zone.getName(),
                    "IFCSPACE", // globalId placeholder (IFC space identifier)
                    zone.getType(),
                    equipmentDtos
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