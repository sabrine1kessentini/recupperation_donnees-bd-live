# Guide d'Ajout d'Utilisateurs

Il existe plusieurs méthodes pour ajouter de nouveaux utilisateurs au système.

---

## Méthode 1: Via l'endpoint /auth/signup (Recommandé)

### Avec Postman:

1. **Méthode**: `POST`
2. **URL**: `http://localhost:8080/auth/signup`
3. **Headers**: 
   - Key: `Content-Type`
   - Value: `application/json`
4. **Body** (raw JSON):

```json
{
  "username": "nouvel_utilisateur",
  "email": "nouveau@example.com",
  "password": "motdepasse123",
  "roles": ["OCCUPANT"]
}
```

### Paramètres:
- **username**: Nom d'utilisateur unique (obligatoire)
- **email**: Adresse email unique (obligatoire)
- **password**: Mot de passe (obligatoire)
- **roles**: Liste des rôles (optionnel, par défaut: ["OCCUPANT"])

### Rôles disponibles:
- `OCCUPANT` - Utilisateur standard
- `EXPLOITANT` - Exploitant du bâtiment
- `MAINTENANCE` - Personnel de maintenance
- `DIRECTION` - Direction/Management

### Exemple de réponse (200 OK):
```json
{
  "id": 2,
  "username": "nouvel_utilisateur"
}
```

### Avec curl:
```bash
curl -X POST http://localhost:8080/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "nouvel_utilisateur",
    "email": "nouveau@example.com",
    "password": "motdepasse123",
    "roles": ["OCCUPANT"]
  }'
```

---

## Méthode 2: Ajouter directement dans DataInitializer

Pour créer des utilisateurs au démarrage de l'application:

### Éditer le fichier:
`auth-service/src/main/java/com/projet1/auth_service/init/DataInitializer.java`

### Ajouter un nouvel utilisateur:

```java
// Après la création de l'utilisateur test existant, ajoutez:

// Créer un deuxième utilisateur
if (!userRepository.findByEmail("john.doe@example.com").isPresent()) {
    User newUser = new User();
    newUser.setUsername("johndoe");
    newUser.setEmail("john.doe@example.com");
    newUser.setPassword(passwordEncoder.encode("password123"));
    newUser.setClientname("John");
    newUser.setEnabled(true);
    newUser.setActive(0);
    newUser.setNumberofphones(5);
    newUser.setIsgateway(0);
    newUser.setUnicastadress("0002");
    newUser.setIsadmin(0);
    newUser.setUnicastlowadress("0002");
    newUser.setUnicasthighadress(0);
    newUser.setGrouplowadress(0);
    newUser.setGrouphighadress(0);
    newUser.setScenelowadress(0);
    newUser.setScenehighadress(0);
    newUser.setSequencenumber(0);
    newUser.setIvindex(0);
    newUser.setDatabaseIP("iot.waveon.tn/WS_WAVEON/proxy/");
    newUser.setDatabasePORT("81");
    newUser.setDatabaseUserName("");
    newUser.setDatabasePassKey("");
    newUser.setSubscriptionType(0);
    newUser.setMaxUserReached(0);

    // Assigner le rôle EXPLOITANT
    Role exploitantRole = roleRepository.findByName("ROLE_EXPLOITANT")
        .orElseGet(() -> roleRepository.save(new Role("ROLE_EXPLOITANT")));
    Set<Role> roles = new HashSet<>();
    roles.add(exploitantRole);
    newUser.setRoles(roles);

    userRepository.save(newUser);
    System.out.println("User created: john.doe@example.com / password123");
}
```

Ensuite, redémarrez l'application:
```bash
cd auth-service
mvn spring-boot:run
```

---

## Méthode 3: Directement dans la base de données

### Via SQL (si vous utilisez H2, MySQL, PostgreSQL, etc.):

**Note**: Le mot de passe doit être hashé avec BCrypt. Utilisez un générateur en ligne ou l'endpoint signup.

```sql
-- Insérer un utilisateur
INSERT INTO users (username, email, password, enabled, clientname, active, numberofphones, 
                   isgateway, unicastadress, isadmin, unicastlowadress, unicasthighadress,
                   grouplowadress, grouphighadress, scenelowadress, scenehighadress,
                   sequencenumber, ivindex, database_ip, database_port, database_user_name,
                   database_pass_key, subscription_type, max_user_reached)
VALUES ('testuser', 'test@example.com', '$2a$10$...', true, 'Test User', 0, 0,
        0, '0003', 0, '0003', 0, 0, 0, 0, 0, 0, 0,
        'iot.waveon.tn/WS_WAVEON/proxy/', '81', '', '', 0, 0);

-- Récupérer l'ID de l'utilisateur créé
SELECT id FROM users WHERE email = 'test@example.com';

-- Assigner un rôle (remplacer 3 par l'ID de l'utilisateur et 1 par l'ID du rôle)
INSERT INTO user_roles (user_id, role_id) VALUES (3, 1);
```

---

## Exemples complets avec Postman

### Exemple 1: Créer un utilisateur OCCUPANT
```json
{
  "username": "marie_dupont",
  "email": "marie.dupont@example.com",
  "password": "secure123",
  "roles": ["OCCUPANT"]
}
```

### Exemple 2: Créer un utilisateur EXPLOITANT
```json
{
  "username": "pierre_martin",
  "email": "pierre.martin@example.com",
  "password": "admin456",
  "roles": ["EXPLOITANT"]
}
```

### Exemple 3: Créer un utilisateur avec plusieurs rôles
```json
{
  "username": "admin_user",
  "email": "admin@example.com",
  "password": "superadmin789",
  "roles": ["EXPLOITANT", "DIRECTION"]
}
```

### Exemple 4: Créer un utilisateur sans spécifier de rôle (OCCUPANT par défaut)
```json
{
  "username": "simple_user",
  "email": "simple@example.com",
  "password": "password123"
}
```

---

## Tester la connexion du nouvel utilisateur

Après avoir créé un utilisateur, testez la connexion avec LoginClientService:

**POST** `http://localhost:8080/auth/LoginClientService`

```json
{
  "email": "nouveau@example.com",
  "password": "motdepasse123",
  "devicename": "test_device"
}
```

Si la création a réussi, vous recevrez une réponse 200 OK avec toutes les informations de l'utilisateur et un token JWT.

---

## Vérifier les utilisateurs existants

### Via les logs au démarrage:
Regardez les logs de l'application au démarrage pour voir les utilisateurs créés:
```
Test user created: amal.waly@etudiant-isi.utm.tn / 123456
User created: john.doe@example.com / password123
```

### Via la console H2 (si vous utilisez H2):
1. Accédez à: `http://localhost:8080/h2-console`
2. JDBC URL: `jdbc:h2:mem:authdb` (vérifiez dans application.properties)
3. Username: `sa`
4. Password: (vide)
5. Exécutez: `SELECT * FROM users;`

---

## Erreurs courantes

### Erreur: "username exists"
**Cause**: Le nom d'utilisateur est déjà utilisé
**Solution**: Choisissez un autre username

### Erreur: "Duplicate entry for key 'email'"
**Cause**: L'email est déjà utilisé
**Solution**: Utilisez une autre adresse email

### Erreur: "400 Bad Request"
**Cause**: Format JSON invalide ou champs manquants
**Solution**: Vérifiez que username, email et password sont présents

---

## Script de création d'utilisateurs multiples

Créez un fichier `create-users.sh`:

```bash
#!/bin/bash

# Créer plusieurs utilisateurs
curl -X POST http://localhost:8080/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"user1","email":"user1@example.com","password":"pass123","roles":["OCCUPANT"]}'

curl -X POST http://localhost:8080/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"user2","email":"user2@example.com","password":"pass123","roles":["OCCUPANT"]}'

curl -X POST http://localhost:8080/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin1","email":"admin1@example.com","password":"admin123","roles":["EXPLOITANT"]}'

echo "Utilisateurs créés avec succès!"
```

Exécutez:
```bash
chmod +x create-users.sh
./create-users.sh
```

---

## Résumé

| Méthode | Avantages | Quand l'utiliser |
|---------|-----------|------------------|
| `/auth/signup` | Simple, via API, validation automatique | Production, création dynamique |
| `DataInitializer` | Automatique au démarrage | Utilisateurs de test, démo |
| Base de données | Accès direct | Migration de données, correction |

**Recommandation**: Utilisez l'endpoint `/auth/signup` pour la plupart des cas d'usage.
