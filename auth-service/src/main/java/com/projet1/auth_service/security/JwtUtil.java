package com.projet1.auth_service.security;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.stereotype.Component;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
public class JwtUtil {

    private final RSAKey rsaJwk;
    private final RSAPrivateKey privateKey;
    private final RSAPublicKey publicKey;

    public JwtUtil() {
        try {
            KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
            kpg.initialize(2048);
            KeyPair kp = kpg.generateKeyPair();
            this.privateKey = (RSAPrivateKey) kp.getPrivate();
            this.publicKey = (RSAPublicKey) kp.getPublic();
            this.rsaJwk = new RSAKey.Builder(this.publicKey).privateKey(this.privateKey).keyID(UUID.randomUUID().toString()).build();
        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize JWT keys", e);
        }
    }

    public String generateToken(String username, Set<String> roles) {
        try {
            Instant now = Instant.now();
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .subject(username)
                    .issueTime(Date.from(now))
                    .expirationTime(Date.from(now.plusSeconds(60*60)))
                    .claim("roles", roles.stream().collect(Collectors.toList()))
                    .issuer("auth-service")
                    .build();

            JWSHeader header = new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(rsaJwk.getKeyID()).type(JOSEObjectType.JWT).build();
            SignedJWT signedJWT = new SignedJWT(header, claims);
            JWSSigner signer = new RSASSASigner(privateKey);
            signedJWT.sign(signer);
            return signedJWT.serialize();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public RSAPublicKey getPublicKey() { return publicKey; }
}
