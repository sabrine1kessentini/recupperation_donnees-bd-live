package com.digitaltwin.building_service.service;

import com.digitaltwin.building_service.dto.IfcEnrichmentResultDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class IfcEnrichmentServiceTest {

    @Test
    void shouldGenerateEnrichedIfcFromMapping() throws Exception {
        IfcService ifcService = new IfcService();
        setField(ifcService, "ifcPath", "data/otc.ifc");

        IfcEnrichmentService enrichmentService = new IfcEnrichmentService(ifcService, new ObjectMapper());
        setField(enrichmentService, "defaultMappingPath", "data/mapping_final.json");

        Path outputFile = Files.createTempFile("otc-enriched-", ".ifc");
        setField(enrichmentService, "defaultOutputIfcPath", outputFile.toString());

        IfcEnrichmentResultDto result = enrichmentService.enrichIfc(null, null);

        assertTrue(result.sensorsCreated() > 0, "Le service doit creer au moins un capteur.");
        assertTrue(Files.size(outputFile) > 0, "Le fichier IFC enrichi doit etre ecrit.");

        String content = Files.readString(outputFile, StandardCharsets.UTF_8);
        assertTrue(content.contains("Pset_WaveonSensor"), "Le fichier enrichi doit contenir les property sets Waveon.");
        assertTrue(content.contains("IFCBUILDINGELEMENTPROXY"), "Le fichier enrichi doit contenir des capteurs IFC.");
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
