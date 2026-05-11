package com.digitaltwin.alert_service.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfig {

    @Value("${alert.kafka.topic}")
    private String topic;

    /**
     * S'assure que le topic existe au démarrage.
     * Si le topic est déjà créé par building-service, cette déclaration est ignorée.
     */
    @Bean
    public NewTopic sensorReadingsTopic() {
        return TopicBuilder.name(topic)
            .partitions(3)
            .replicas(1)
            .build();
    }
}
