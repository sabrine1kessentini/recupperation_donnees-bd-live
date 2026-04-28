package com.digitaltwin.building_service;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.kafka.annotation.EnableKafka;

@SpringBootApplication
@EnableScheduling
@EnableKafka
public class BuildingServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(BuildingServiceApplication.class, args);
    }
}

