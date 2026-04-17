package com.digitaltwin.building_service.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BuildingHierarchyDto {

    private Long buildingId;

    private String buildingName;

    private String globalId;

    private List<FloorDto> floors;

}
