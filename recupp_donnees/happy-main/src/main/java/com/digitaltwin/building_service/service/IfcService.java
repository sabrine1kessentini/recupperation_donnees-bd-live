package com.digitaltwin.building_service.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;

@Service
public class IfcService {

    @Value("${building.ifc.path}")
    private String ifcPath;

    public String getConfiguredPath() {
        return ifcPath;
    }

    public Path getIfcPath() {
        Path configured = Paths.get(ifcPath).toAbsolutePath().normalize();

        if (Files.isDirectory(configured)) {
            return resolveIfcFromDirectory(configured).orElse(configured);
        }

        return configured;
    }

    public Resource getIfcFileAsResource() {
        return new FileSystemResource(getIfcPath());
    }

    public byte[] getIfcBytes() throws Exception {
        return Files.readAllBytes(getIfcPath());
    }

    public boolean exists() {
        return Files.exists(getIfcPath());
    }

    public boolean readable() {
        return Files.isReadable(getIfcPath());
    }

    public long sizeBytes() throws Exception {
        return Files.size(getIfcPath());
    }

    private Optional<Path> resolveIfcFromDirectory(Path dir) {
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(dir, "*.ifc")) {
            return streamToLargestFile(stream);
        } catch (IOException ignored) {
            return Optional.empty();
        }
    }

    private Optional<Path> streamToLargestFile(DirectoryStream<Path> stream) {
        Path best = null;
        long bestSize = -1;

        for (Path p : stream) {
            try {
                if (!Files.isRegularFile(p)) continue;
                long size = Files.size(p);
                if (size > bestSize) {
                    bestSize = size;
                    best = p;
                }
            } catch (IOException ignored) {
                // skip unreadable entries
            }
        }

        return Optional.ofNullable(best);
    }
}

