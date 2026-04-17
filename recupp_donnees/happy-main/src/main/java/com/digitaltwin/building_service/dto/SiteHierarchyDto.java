package com.digitaltwin.building_service.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SiteHierarchyDto {

    private Long siteId;

    private String siteName;

    private String code;

    private List<BuildingHierarchyDto> buildings;

}