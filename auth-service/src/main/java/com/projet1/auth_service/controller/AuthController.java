package com.projet1.auth_service.controller;

import com.projet1.auth_service.domain.User;
import com.projet1.auth_service.dto.LoginClientRequest;
import com.projet1.auth_service.dto.LoginClientResponse;
import com.projet1.auth_service.security.JwtUtil;
import com.projet1.auth_service.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    record SignupRequest(String username, String email, String password, Set<String> roles) {}
    record LoginRequest(String username, String password) {}

    private final UserService userService;
    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final RestTemplate restTemplate;
    private static final String USER_SERVICE_URL = "http://localhost:8081/api/profiles";

    public AuthController(UserService userService, AuthenticationManager authenticationManager, 
                         JwtUtil jwtUtil, RestTemplate restTemplate) {
        this.userService = userService;
        this.authenticationManager = authenticationManager;
        this.jwtUtil = jwtUtil;
        this.restTemplate = restTemplate;
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@Valid @RequestBody SignupRequest req) {
        Set<String> roles = req.roles == null || req.roles.isEmpty() ? Set.of("ROLE_OCCUPANT") : req.roles.stream().map(r -> r.startsWith("ROLE_")? r : "ROLE_"+r.toUpperCase()).collect(Collectors.toSet());
        User u = userService.register(req.username, req.email, req.password, roles);

        // Appel user-service pour créer automatiquement le profil et l'utilisateur dans userdb
        try {
            Map<String, Object> profileData = new HashMap<>();
            profileData.put("username", u.getUsername());
            profileData.put("email", u.getEmail());
            profileData.put("firstName", "");
            profileData.put("lastName", "");
            profileData.put("phone", "");
            profileData.put("address", "");
            profileData.put("roles", new ArrayList<>(roles));
            
            logger.info("Création du profil et de l'utilisateur dans user-service pour: {}", u.getUsername());
            restTemplate.postForEntity(USER_SERVICE_URL, profileData, Object.class);
            logger.info("Profil et utilisateur créés avec succès dans user-service pour: {}", u.getUsername());
        } catch (RestClientException e) {
            logger.error("Erreur lors de la création du profil dans user-service pour {}: {}", u.getUsername(), e.getMessage());
            // On continue quand même car l'utilisateur est créé dans auth-service
            // Dans un environnement de production, on pourrait vouloir rollback la transaction
        } catch (Exception e) {
            logger.error("Erreur inattendue lors de l'appel à user-service pour {}: {}", u.getUsername(), e.getMessage(), e);
        }

        return ResponseEntity.ok(Map.of("id", u.getId(), "username", u.getUsername()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req, HttpServletRequest request) {
        try {
            String username = req.username;
            if (userService.findByEmail(req.username).isPresent()) {
                username = userService.findByEmail(req.username).get().getUsername();
            }
            Authentication auth = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(username, req.password));
            var user = (org.springframework.security.core.userdetails.User) auth.getPrincipal();
            Set<String> roles = user.getAuthorities().stream().map(a -> a.getAuthority()).collect(Collectors.toSet());
            String token = jwtUtil.generateToken(user.getUsername(), roles);
            return ResponseEntity.ok(Map.of("access_token", token, "token_type", "bearer", "roles", roles));
        } catch (Exception e) {
            logger.error("Login error for user {}: {}", req.username, e.getMessage());
            return ResponseEntity.status(401).body(Map.of("error", "Authentication failed: " + e.getMessage()));
        }
    }

    /**
     * LoginClientService endpoint - Compatible with external API specification
     * Authenticates user by email and password, returns complete user session data
     */
    @PostMapping("/LoginClientService")
    public ResponseEntity<LoginClientResponse> loginClientService(@Valid @RequestBody LoginClientRequest request) {
        try {
            logger.info("LoginClientService called for email: {}", request.getEmail());
            
            // Authenticate user by email
            User user = userService.authenticateByEmail(
                request.getEmail(), 
                request.getPassword(), 
                request.getDevicename()
            );

            // Generate new JWT token for this session
            Set<String> roles = user.getRoles().stream()
                .map(role -> role.getName())
                .collect(Collectors.toSet());
            String jwtToken = jwtUtil.generateToken(user.getUsername(), roles);

            // Build response matching the external API format
            LoginClientResponse response = new LoginClientResponse();
            response.setIdclient(user.getId());
            response.setClientname(user.getClientname() != null ? user.getClientname() : user.getUsername());
            response.setEmail(user.getEmail());
            response.setUsername(user.getUsername());
            response.setPassword(user.getPassword()); // Encrypted password
            response.setCountry(user.getCountry());
            response.setCity(user.getCity());
            response.setActive(user.getActive());
            response.setPhonenumber(user.getPhonenumber());
            response.setNumberofphones(user.getNumberofphones());
            response.setJasonpath(user.getJasonpath());
            response.setRegiscode(user.getRegiscode());
            response.setLastedate(user.getLastedate());
            response.setResetpasswordtoken(user.getResetpasswordtoken());
            response.setIsgateway(user.getIsgateway());
            response.setPasskey(user.getPasskey());
            response.setUnicastadress(user.getUnicastadress());
            response.setIsadmin(user.getIsadmin());
            response.setToken(jwtToken); // Use JWT token
            response.setIduser(user.getId());
            response.setDevicename(user.getDevicename());
            response.setUnicastlowadress(user.getUnicastlowadress());
            response.setUnicasthighadress(user.getUnicasthighadress());
            response.setGrouplowadress(user.getGrouplowadress());
            response.setGrouphighadress(user.getGrouphighadress());
            response.setScenelowadress(user.getScenelowadress());
            response.setScenehighadress(user.getScenehighadress());
            response.setSequencenumber(user.getSequencenumber());
            response.setIvindex(user.getIvindex());
            response.setMqttClientCreated(user.getMqttClientCreated());
            response.setMqttClientModified(user.getMqttClientModified());
            response.setSetUserAdminToken(user.getSetUserAdminToken());
            response.setSetUserGatewayToken(user.getSetUserGatewayToken());
            response.setMqttIP(user.getMqttIP());
            response.setMqttPORT(user.getMqttPORT());
            response.setDatabaseIP(user.getDatabaseIP());
            response.setDatabasePORT(user.getDatabasePORT());
            response.setDatabaseUserName(user.getDatabaseUserName());
            response.setDatabasePassKey(user.getDatabasePassKey());
            response.setSubscriptionType(user.getSubscriptionType());
            response.setMaxUserReached(user.getMaxUserReached());

            logger.info("LoginClientService successful for user: {}", user.getEmail());
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            logger.error("Authentication failed: {}", e.getMessage());
            throw e;
        } catch (Exception e) {
            logger.error("Unexpected error during LoginClientService: {}", e.getMessage(), e);
            throw new RuntimeException("Authentication failed", e);
        }
    }
}
