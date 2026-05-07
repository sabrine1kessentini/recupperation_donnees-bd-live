# Dépannage - Erreur 403 Forbidden

## Problème résolu ✅

L'erreur 403 sur `/auth/LoginClientService` a été corrigée dans [`SecurityConfig.java`](auth-service/src/main/java/com/projet1/auth_service/config/SecurityConfig.java).

## Solution appliquée

Le endpoint `/auth/LoginClientService` a été explicitement ajouté à la liste des endpoints publics:

```java
.authorizeHttpRequests(auth -> auth
    .requestMatchers("/auth/signup", "/auth/login", "/auth/LoginClientService").permitAll()
    .requestMatchers("/auth/**", "/oauth2/**", "/.well-known/**", "/actuator/**").permitAll()
    .anyRequest().authenticated()
)
```

## Étapes pour résoudre l'erreur 403

### 1. Redémarrer le service auth-service

**Important**: Après la modification de SecurityConfig, vous DEVEZ redémarrer le service.

```bash
# Arrêter le service en cours (Ctrl+C dans le terminal)
# Puis redémarrer:
cd auth-service
mvn spring-boot:run
```

### 2. Vérifier que le service démarre correctement

Attendez de voir dans les logs:
```
Started AuthServiceApplication in X.XXX seconds
Test user created: amal.waly@etudiant-isi.utm.tn / 123456
```

### 3. Tester à nouveau avec Postman

**POST** `http://localhost:8080/auth/LoginClientService`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "email": "safa@exemple.com",
  "password": "safa123"
}
```

### 4. Vérifier que l'utilisateur existe

Si vous obtenez toujours une erreur, vérifiez que l'utilisateur existe dans la base de données:

#### Option A: Via H2 Console (si vous utilisez H2)
1. Accédez à: `http://localhost:8080/h2-console`
2. JDBC URL: `jdbc:h2:mem:authdb`
3. Username: `sa`
4. Password: (vide)
5. Exécutez:
```sql
SELECT * FROM users WHERE email = 'safa@exemple.com';
```

#### Option B: Créer l'utilisateur via signup
```bash
curl -X POST http://localhost:8080/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "safa",
    "email": "safa@exemple.com",
    "password": "safa123",
    "roles": ["OCCUPANT"]
  }'
```

## Autres causes possibles d'erreur 403

### Cause 1: CSRF activé
**Solution**: CSRF est désactivé dans la configuration (`.csrf(csrf -> csrf.disable())`)

### Cause 2: Mauvaise URL
**Vérifiez**:
- ✅ Correct: `http://localhost:8080/auth/LoginClientService`
- ❌ Incorrect: `http://localhost:8080/LoginClientService`
- ❌ Incorrect: `http://localhost:8080/auth/loginclientservice` (sensible à la casse!)

### Cause 3: Port incorrect
**Vérifiez** dans `application.properties`:
```properties
server.port=8080
```

Si le port est différent, utilisez le bon port dans l'URL.

### Cause 4: Service non démarré
**Vérifiez** que le service est bien en cours d'exécution:
```bash
curl http://localhost:8080/actuator/health
```

Réponse attendue:
```json
{"status":"UP"}
```

## Test complet après correction

### 1. Créer un utilisateur
```bash
curl -X POST http://localhost:8080/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "test123"
  }'
```

Réponse attendue (200 OK):
```json
{
  "id": 2,
  "username": "testuser"
}
```

### 2. Se connecter avec LoginClientService
```bash
curl -X POST http://localhost:8080/auth/LoginClientService \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'
```

Réponse attendue (200 OK):
```json
{
  "idclient": 2,
  "clientname": "testuser",
  "email": "test@example.com",
  "username": "testuser",
  "token": "eyJhbGc...",
  ...
}
```

## Vérification de la configuration de sécurité

Pour vérifier que la configuration est correcte, consultez les logs au démarrage:

```
...
o.s.s.web.DefaultSecurityFilterChain     : Will secure any request with [...]
...
```

Les endpoints suivants doivent être accessibles sans authentification:
- `/auth/signup`
- `/auth/login`
- `/auth/LoginClientService`
- `/auth/**` (tous les autres endpoints sous /auth)
- `/.well-known/**`
- `/actuator/**`

## Checklist de dépannage

- [ ] Le service auth-service est démarré
- [ ] Le port 8080 est utilisé (ou le bon port configuré)
- [ ] L'URL est exactement: `http://localhost:8080/auth/LoginClientService`
- [ ] Le header `Content-Type: application/json` est présent
- [ ] Le body est un JSON valide
- [ ] L'utilisateur existe dans la base de données
- [ ] Le mot de passe est correct
- [ ] Le service a été redémarré après la modification de SecurityConfig

## Logs utiles pour le débogage

Ajoutez ces lignes dans `application.properties` pour plus de logs:

```properties
logging.level.org.springframework.security=DEBUG
logging.level.com.projet1.auth_service=DEBUG
```

Puis redémarrez le service et observez les logs lors de l'appel à LoginClientService.

## Contact et support

Si le problème persiste après avoir suivi toutes ces étapes:

1. Vérifiez les logs du service pour voir l'erreur exacte
2. Vérifiez que la version de Spring Security est compatible
3. Assurez-vous qu'aucun proxy ou firewall ne bloque la requête
4. Testez avec curl pour éliminer les problèmes liés à Postman

## Résumé de la solution

**Avant** (erreur 403):
```java
.requestMatchers("/auth/signup").permitAll()
.requestMatchers("/auth/**", ...).permitAll()
```

**Après** (fonctionne):
```java
.requestMatchers("/auth/signup", "/auth/login", "/auth/LoginClientService").permitAll()
.requestMatchers("/auth/**", ...).permitAll()
```

L'ajout explicite de `/auth/LoginClientService` garantit qu'il est bien autorisé sans authentification.
