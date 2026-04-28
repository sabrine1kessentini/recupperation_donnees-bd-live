package com.digitaltwin.building_service.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig {

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {

            @Override
            public void addCorsMappings(CorsRegistry registry) {

                registry.addMapping("/api/**")
                        // ✅ autorise tous les ports localhost (5173, 3000, etc.)
                        .allowedOriginPatterns("http://localhost:*")

                        // méthodes autorisées
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")

                        // headers
                        .allowedHeaders("*")

                        // ⚠️ si tu veux cookies / auth → mettre true
                        .allowCredentials(false);
            }
        };
    }
}