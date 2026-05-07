package com.projet1.auth_service.security;

import com.nimbusds.jose.JWSObject;
import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.security.interfaces.RSAPublicKey;
import java.text.ParseException;
import java.util.List;
import java.util.stream.Collectors;

public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final RSAPublicKey publicKey;

    public JwtAuthenticationFilter(RSAPublicKey publicKey) {
        this.publicKey = publicKey;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String h = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (StringUtils.hasText(h) && h.startsWith("Bearer ")) {
            String token = h.substring(7);
            try {
                SignedJWT signedJWT = SignedJWT.parse(token);
                JWSVerifier verifier = new RSASSAVerifier(publicKey);
                if (signedJWT.verify(verifier)) {
                    @SuppressWarnings("unchecked")
                    List<String> roles = (List<String>) signedJWT.getJWTClaimsSet().getClaim("roles");
                    List<SimpleGrantedAuthority> authorities = roles == null ? List.of() : roles.stream().map(SimpleGrantedAuthority::new).collect(Collectors.toList());
                    String username = signedJWT.getJWTClaimsSet().getSubject();
                    UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(username, null, authorities);
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (Exception e) {
                // ignore token errors -> unauthenticated
            }
        }
        filterChain.doFilter(request, response);
    }
}
