package com.digitaltwin.building_service.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

public record SensorDataDto(
        @JsonProperty("sensor_id")
        String sensorId,
        
        @JsonProperty("sensor_type")
        String sensorType,
        
        @JsonProperty("label")
        String label,
        
        @JsonProperty("timestamp")
        Instant timestamp,
        
        @JsonProperty("value")
        Double value,
        
        @JsonProperty("unit")
        String unit,
        
        @JsonProperty("status")
        String status,
        
        @JsonProperty("ifc_global_id")
        String ifcGlobalId,
        
        @JsonProperty("ifc_name")
        String ifcName,
        
        @JsonProperty("network_id")
        Integer networkId,
        
        @JsonProperty("unicast_address")
        Integer unicastAddress
) {
}