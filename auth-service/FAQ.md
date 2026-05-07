# FAQ - Questions Fréquentes

## Q1: Le devicename n'est pas saisi lors du signup, comment faire pour LoginClientService?

**Réponse**: C'est normal! Le `devicename` n'est PAS obligatoire. Voici comment ça fonctionne:

### Processus en 2 étapes:

#### Étape 1: Créer un utilisateur avec /auth/signup
```json
POST http://localhost:8080/auth/signup
{
  "username": "nouvel_utilisateur",
  "email": "nouveau@example.com",
  "password": "motdepasse123",
  "roles": ["OCCUPANT"]
}
```
**Note**: Pas besoin de devicename ici!

#### Étape 2: Se connecter avec /auth/LoginClientService
```json
POST http://localhost:8080/auth/LoginClientService
{
  "email": "nouveau@example.com",
  "password": "motdepasse123",
  "devicename": "mon_appareil_123"
}
```

### Le devicename est OPTIONNEL

Vous pouvez même vous connecter SANS devicename:
```json
{
  "email": "nouveau@example.com",
  "password": "motdepasse123"
}
```

Le devicename sera simplement `null` dans la réponse, ce qui est parfaitement acceptable.

### Quand le devicename est-il utilisé?

Le `devicename` est stocké lors de la connexion et peut être utilisé pour:
- Identifier l'appareil depuis lequel l'utilisateur se connecte
- Gérer plusieurs appareils pour un même utilisateur
- Tracer les connexions par appareil

### Exemple complet:

```bash
# 1. Créer un utilisateur
curl -X POST http://localhost:8080/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'

# 2. Se connecter SANS devicename (OK)
curl -X POST http://localhost:8080/auth/LoginClientService \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# 3. Ou se connecter AVEC devicename (OK aussi)
curl -X POST http://localhost:8080/auth/LoginClientService \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "devicename": "mon_telephone"
  }'
```

---

## Q2: Quelle est la différence entre /auth/login et /auth/LoginClientService?

### /auth/login (Ancien endpoint)
- Utilise le **username** pour se connecter
- Retourne seulement le token JWT
- Format de réponse simple:
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer"
}
```

### /auth/LoginClientService (Nouveau endpoint)
- Utilise l'**email** pour se connecter
- Retourne TOUTES les informations de l'utilisateur
- Compatible avec l'API externe
- Format de réponse complet avec 40+ champs

**Les deux endpoints fonctionnent!** Utilisez celui qui correspond à vos besoins.

---

## Q3: Comment mettre à jour le devicename d'un utilisateur existant?

Il suffit de se reconnecter avec LoginClientService en spécifiant le nouveau devicename:

```json
POST http://localhost:8080/auth/LoginClientService
{
  "email": "user@example.com",
  "password": "password123",
  "devicename": "nouveau_appareil"
}
```

Le devicename sera mis à jour automatiquement.

---

## Q4: Puis-je utiliser LoginClientService avec l'utilisateur créé par signup?

**Oui, absolument!** Voici un exemple complet:

### Avec Postman:

**1. Créer l'utilisateur:**
```
POST http://localhost:8080/auth/signup
Content-Type: application/json

{
  "username": "marie",
  "email": "marie@example.com",
  "password": "marie123",
  "roles": ["OCCUPANT"]
}
```

**2. Se connecter immédiatement:**
```
POST http://localhost:8080/auth/LoginClientService
Content-Type: application/json

{
  "email": "marie@example.com",
  "password": "marie123",
  "devicename": "laptop_marie"
}
```

**3. Réponse attendue:**
```json
{
  "idclient": 2,
  "clientname": "marie",
  "email": "marie@example.com",
  "username": "marie",
  "token": "eyJhbGc...",
  "iduser": 2,
  "devicename": "laptop_marie",
  ...
}
```

---

## Q5: Les champs comme country, city, phonenumber sont-ils obligatoires?

**Non!** Tous ces champs sont optionnels. Lors du signup, seuls ces champs sont obligatoires:
- `username`
- `email`
- `password`

Tous les autres champs (country, city, phonenumber, etc.) peuvent être `null` et seront remplis plus tard si nécessaire.

---

## Q6: Comment ajouter des informations supplémentaires à un utilisateur?

Actuellement, les informations supplémentaires (country, city, phonenumber, etc.) sont définies lors de la création dans DataInitializer ou directement en base de données.

Pour ajouter un endpoint de mise à jour du profil, vous pourriez créer:

```java
@PutMapping("/auth/profile")
public ResponseEntity<?> updateProfile(@RequestBody ProfileUpdateRequest request) {
    // Logique de mise à jour
}
```

---

## Q7: Que faire si j'oublie le mot de passe?

Actuellement, il n'y a pas d'endpoint de réinitialisation de mot de passe. Vous pouvez:

1. **En développement**: Recréer l'utilisateur ou modifier directement en base de données
2. **En production**: Implémenter un endpoint `/auth/reset-password`

---

## Q8: Puis-je avoir plusieurs utilisateurs avec le même email?

**Non!** L'email doit être unique. Si vous essayez de créer un utilisateur avec un email existant, vous recevrez une erreur.

---

## Q9: Comment vérifier si un email existe déjà?

Essayez de créer l'utilisateur avec `/auth/signup`. Si l'email existe, vous recevrez une erreur.

Ou créez un endpoint de vérification:
```
GET http://localhost:8080/auth/check-email?email=test@example.com
```

---

## Q10: Le token JWT expire-t-il?

Oui, par défaut le token JWT expire après 1 heure. Vous pouvez vérifier la configuration dans `JwtUtil.java`.

Pour obtenir un nouveau token, reconnectez-vous avec `/auth/LoginClientService`.

---

## Résumé des endpoints disponibles

| Endpoint | Méthode | Authentification requise | Description |
|----------|---------|-------------------------|-------------|
| `/auth/signup` | POST | Non | Créer un nouvel utilisateur |
| `/auth/login` | POST | Non | Connexion avec username (retourne token simple) |
| `/auth/LoginClientService` | POST | Non | Connexion avec email (retourne infos complètes) |
| `/auth/.well-known/jwks.json` | GET | Non | Clés publiques JWT |

---

## Workflow recommandé

```
1. Créer un utilisateur
   POST /auth/signup
   {username, email, password, roles}

2. Se connecter
   POST /auth/LoginClientService
   {email, password, devicename (optionnel)}

3. Utiliser le token
   Inclure dans les headers: Authorization: Bearer <token>

4. Quand le token expire
   Se reconnecter avec /auth/LoginClientService
```
