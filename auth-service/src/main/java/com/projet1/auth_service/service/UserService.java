package com.projet1.auth_service.service;

import com.projet1.auth_service.domain.Role;
import com.projet1.auth_service.domain.User;
import com.projet1.auth_service.repository.RoleRepository;
import com.projet1.auth_service.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandom secureRandom = new SecureRandom();

    public UserService(UserRepository userRepository, RoleRepository roleRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public User register(String username, String email, String rawPassword, Set<String> roleNames) {
        if (userRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("username exists");
        }

        User u = new User();
        u.setUsername(username);
        u.setEmail(email);
        u.setPassword(passwordEncoder.encode(rawPassword));
        u.setClientname(username); // Use username as clientname by default
        u.setEnabled(true);
        
        // Initialize all required fields with default values
        u.setActive(0);
        u.setNumberofphones(0);
        u.setIsgateway(0);
        u.setUnicastadress("0001");
        u.setIsadmin(0);
        u.setUnicastlowadress("0001");
        u.setUnicasthighadress(0);
        u.setGrouplowadress(0);
        u.setGrouphighadress(0);
        u.setScenelowadress(0);
        u.setScenehighadress(0);
        u.setSequencenumber(0);
        u.setIvindex(0);
        u.setDatabaseIP("iot.waveon.tn/WS_WAVEON/proxy/");
        u.setDatabasePORT("81");
        u.setDatabaseUserName("");
        u.setDatabasePassKey("");
        u.setSubscriptionType(0);
        u.setMaxUserReached(0);

        Set<Role> roles = new HashSet<>();
        for (String rn : roleNames) {
            Role r = roleRepository.findByName(rn).orElseGet(() -> roleRepository.save(new Role(rn)));
            roles.add(r);
        }
        u.setRoles(roles);
        return userRepository.save(u);
    }

    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    @Transactional
    public User authenticateByEmail(String email, String rawPassword, String devicename) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

        if (!passwordEncoder.matches(rawPassword, user.getPassword())) {
            throw new IllegalArgumentException("Invalid email or password");
        }

        // Generate new token for this session
        String newToken = generateToken();
        
        // Update device name if provided
        if (devicename != null && !devicename.isEmpty()) {
            user.setDevicename(devicename);
        }

        // Save user with new token (in a real scenario, you might want to store tokens separately)
        return userRepository.save(user);
    }

    /**
     * Generate a random token for authentication
     * Format similar to the example: "YDCY8stdZrJvKc9S9kew"
     */
    private String generateToken() {
        byte[] randomBytes = new byte[15];
        secureRandom.nextBytes(randomBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
    }
}
