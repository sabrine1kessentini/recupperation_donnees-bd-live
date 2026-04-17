package com.digitaltwin.building_service.service;

import com.digitaltwin.building_service.domain.Zone;
import com.digitaltwin.building_service.dto.RealtimeMeasurementDto;
import com.digitaltwin.building_service.dto.SensorDetailsDto;
import com.digitaltwin.building_service.dto.SensorHistoryDto;
import com.digitaltwin.building_service.dto.SpaceSensorDto;
import com.digitaltwin.building_service.repository.ZoneRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.client.RestClient;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WaveonFusionServiceTest {

    @TempDir
    Path tempDir;

    @Test
    void shouldExposeMergedSpacesAndSensors() throws Exception {
        Path mappingFile = tempDir.resolve("mapping.json");
        Files.writeString(mappingFile, """
                [
                  {
                    "ifc_global_id": "space-001",
                    "ifc_name": "B118",
                    "ifc_long_name": "CONFERENCE ROOM 1",
                    "storey": "RDC",
                    "area_m2": 42.5,
                    "mapped": true,
                    "waveon": {
                      "id_network": 1,
                      "unicast_temperature": 12,
                      "unicast_humidity": 13,
                      "unicast_occupancy": null,
                      "unicast_luminosity": 14,
                      "unicast_energy": null,
                      "unicast_flow": null
                    }
                  }
                ]
                """);

        Zone zone = new Zone();
        zone.setId(99L);
        zone.setName("B118");

        ZoneRepository zoneRepository = mock(ZoneRepository.class);
        when(zoneRepository.findAll()).thenReturn(List.of(zone));

        WaveonFusionService service = new WaveonFusionService(
                new ObjectMapper(),
                zoneRepository,
                RestClient.builder().baseUrl("http://localhost").build(),
                mappingFile.toString(),   // mappingPath
                false,                    // remoteEnabled
                "/proxy/:81",             // proxyPrefix
                "https://iot.waveon.tn/WS_WAVEON", // authBaseUrl
                "/LoginClientService/",   // loginPath
                "",                       // email
                "",                       // password
                "building-service",       // deviceName
                "2019-10-01 01:01:01",    // defaultSyncTimestamp
                "tae",                    // energyParameter
                "flow_rate",              // flowParameter
                24,                       // realtimeLookbackHours
                0,                        // staticIdClient
                0,                        // staticIdUser
                ""                        // staticToken
        );

        List<SpaceSensorDto> spaces = service.getSpaces();
        SensorDetailsDto sensor = service.getSensor("space-001--temperature");
        List<RealtimeMeasurementDto> realtime = service.getRealtime(null);
        List<SensorHistoryDto> history = service.getHistory("space-001--temperature", 6, 6);

        assertThat(spaces).hasSize(1);
        assertThat(spaces.get(0).zoneId()).isEqualTo(99L);
        assertThat(spaces.get(0).sensors()).hasSize(3);
        assertThat(sensor.ifcName()).isEqualTo("B118");
        assertThat(sensor.unicastAddress()).isEqualTo(12);
        assertThat(realtime).hasSize(3);
        assertThat(history).hasSize(1);
        assertThat(history.get(0).points()).hasSize(6);
    }
}
