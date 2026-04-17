package com.digitaltwin.building_service.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FloorDto {

    private Long floorId;

    private String floorName;

    private String globalId;

    private List<RoomDto> rooms;
}
