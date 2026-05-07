package com.projet1.auth_service.controller;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.security.interfaces.RSAPublicKey;
import java.util.UUID;

@RestController
public class JwkController {

    private final RSAPublicKey publicKey;

    public JwkController(com.projet1.auth_service.security.JwtUtil jwtUtil) {
        this.publicKey = jwtUtil.getPublicKey();
    }

    @GetMapping("/.well-known/jwks.json")
    public JWKSet jwks() {
        RSAKey rsaKey = new RSAKey.Builder(publicKey)
                .keyID(UUID.randomUUID().toString())
                .build();
        return new JWKSet(rsaKey);
    }
}
