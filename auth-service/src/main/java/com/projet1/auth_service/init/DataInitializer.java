package com.projet1.auth_service.init;

import com.projet1.auth_service.domain.Role;
import com.projet1.auth_service.domain.User;
import com.projet1.auth_service.repository.RoleRepository;
import com.projet1.auth_service.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
public class DataInitializer implements CommandLineRunner {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(RoleRepository roleRepository, UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.roleRepository = roleRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) throws Exception {
        // Initialize roles
        List<String> defaults = List.of("ROLE_EXPLOITANT", "ROLE_MAINTENANCE", "ROLE_DIRECTION", "ROLE_OCCUPANT");
        for (String r : defaults) {
            roleRepository.findByName(r).orElseGet(() -> roleRepository.save(new Role(r)));
        }

        // Create test user matching the API specification example
        if (!userRepository.findByEmail("amal.waly@etudiant-isi.utm.tn").isPresent()) {
            User testUser = new User();
            testUser.setUsername("guest");
            testUser.setEmail("amal.waly@etudiant-isi.utm.tn");
            testUser.setPassword(passwordEncoder.encode("123456"));
            testUser.setClientname("amal");
            testUser.setEnabled(true);
            testUser.setActive(0);
            testUser.setNumberofphones(11);
            testUser.setIsgateway(0);
            testUser.setUnicastadress("0001");
            testUser.setIsadmin(0);
            testUser.setUnicastlowadress("0001");
            testUser.setUnicasthighadress(0);
            testUser.setGrouplowadress(0);
            testUser.setGrouphighadress(0);
            testUser.setScenelowadress(0);
            testUser.setScenehighadress(0);
            testUser.setSequencenumber(0);
            testUser.setIvindex(0);
            testUser.setDatabaseIP("iot.waveon.tn/WS_WAVEON/proxy/");
            testUser.setDatabasePORT("81");
            testUser.setDatabaseUserName("");
            testUser.setDatabasePassKey("");
            testUser.setSubscriptionType(0);
            testUser.setMaxUserReached(0);

            // Assign ROLE_OCCUPANT
            Role occupantRole = roleRepository.findByName("ROLE_OCCUPANT")
                .orElseGet(() -> roleRepository.save(new Role("ROLE_OCCUPANT")));
            Set<Role> roles = new HashSet<>();
            roles.add(occupantRole);
            testUser.setRoles(roles);

            userRepository.save(testUser);
            System.out.println("Test user created: amal.waly@etudiant-isi.utm.tn / 123456");
        }
    }
}
