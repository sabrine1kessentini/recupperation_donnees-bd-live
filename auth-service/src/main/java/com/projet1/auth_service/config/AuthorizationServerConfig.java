package com.projet1.auth_service.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.client.InMemoryRegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import java.util.UUID;

@Configuration
public class AuthorizationServerConfig {

    @Bean
    public RegisteredClientRepository registeredClientRepository() {
        // Client pour User-Service
        RegisteredClient userServiceClient = RegisteredClient.withId(UUID.randomUUID().toString())
                .clientId("user-service")
                .clientSecret("{noop}user-service-secret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
                .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .redirectUri("http://localhost:8081/login/oauth2/code/user-service")
                .scope("openid")
                .scope("profile")
                .scope("users:read")
                .scope("users:write")
                .build();

        // Client pour IoT-Service
        RegisteredClient iotServiceClient = RegisteredClient.withId(UUID.randomUUID().toString())
                .clientId("iot-service")
                .clientSecret("{noop}iot-service-secret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
                .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .redirectUri("http://localhost:8082/login/oauth2/code/iot-service")
                .scope("openid")
                .scope("profile")
                .scope("devices:read")
                .scope("devices:write")
                .build();

        // Client SPA Frontend
        RegisteredClient spaClient = RegisteredClient.withId(UUID.randomUUID().toString())
                .clientId("web-frontend")
                .clientSecret("{noop}web-frontend-secret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .redirectUri("http://localhost:3000/callback")
                .redirectUri("http://localhost:3000/login/oauth2/code/web-frontend")
                .scope("openid")
                .scope("profile")
                .scope("email")
                .build();

        return new InMemoryRegisteredClientRepository(userServiceClient, iotServiceClient, spaClient);
    }

    @Bean
    public AuthorizationServerSettings authorizationServerSettings() {
        return AuthorizationServerSettings.builder()
                .issuer("http://localhost:8080")
                .authorizationEndpoint("/oauth2/authorize")
                .tokenEndpoint("/oauth2/token")
                .tokenRevocationEndpoint("/oauth2/revoke")
                .jwkSetEndpoint("/.well-known/jwks.json")
                .oidcUserInfoEndpoint("/oauth2/userinfo")
                .oidcClientRegistrationEndpoint("/oauth2/register")
                .build();
    }
}
