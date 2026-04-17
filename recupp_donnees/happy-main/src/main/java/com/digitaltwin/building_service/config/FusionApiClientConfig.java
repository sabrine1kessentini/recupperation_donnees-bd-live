package com.digitaltwin.building_service.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class FusionApiClientConfig {

    @Bean
    public RestClient fusionApiRestClient(
            @Value("${building.fusion-api.base-url}") String baseUrl,
            @Value("${building.fusion-api.connect-timeout-ms:10000}") int connectTimeoutMs,
            @Value("${building.fusion-api.read-timeout-ms:30000}") int readTimeoutMs) {

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(connectTimeoutMs));
        requestFactory.setReadTimeout(Duration.ofMillis(readTimeoutMs));

        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
    }
}
