# Guide de Test avec Postman - LoginClientService

## Étape 1: Démarrer le service auth-service

Avant de tester, assurez-vous que le service est démarré:

```bash
cd auth-service
mvn spring-boot:run
```

Attendez que le service démarre complètement. Vous devriez voir dans les logs:
```
Test user created: amal.waly@etudiant-isi.utm.tn / 123456
```

Le service sera disponible sur: `http://localhost:8080`

---

## Étape 2: Ouvrir Postman

1. Lancez l'application Postman
2. Créez une nouvelle requête (cliquez sur "New" ou "+")

---

## Étape 3: Configurer la requête

### 3.1 Méthode et URL
- **Méthode**: Sélectionnez `POST` dans le menu déroulant
- **URL**: Entrez `http://localhost:8080/auth/LoginClientService`

### 3.2 Headers (En-têtes)
1. Cliquez sur l'onglet **"Headers"**
2. Ajoutez un header:
   - **Key**: `Content-Type`
   - **Value**: `application/json`

### 3.3 Body (Corps de la requête)
1. Cliquez sur l'onglet **"Body"**
2. Sélectionnez **"raw"**
3. Dans le menu déroulant à droite, sélectionnez **"JSON"**
4. Copiez-collez ce JSON dans la zone de texte:

```json
{
  "email": "amal.waly@etudiant-isi.utm.tn",
  "password": "123456",
  "devicename": "a989b76f5d8c827c"
}
```

---

## Étape 4: Envoyer la requête

1. Cliquez sur le bouton bleu **"Send"**
2. Attendez la réponse (quelques secondes)

---

## Étape 5: Vérifier la réponse

### Réponse attendue (Status: 200 OK)

Vous devriez recevoir une réponse JSON complète comme ceci:

```json
{
    "idclient": 1,
    "clientname": "amal",
    "email": "amal.waly@etudiant-isi.utm.tn",
    "username": "guest",
    "password": "$2a$10$...",
    "country": null,
    "city": null,
    "active": 0,
    "phonenumber": null,
    "numberofphones": 11,
    "jasonpath": null,
    "regiscode": null,
    "lastedate": null,
    "resetpasswordtoken": null,
    "isgateway": 0,
    "passkey": null,
    "unicastadress": "0001",
    "isadmin": 0,
    "token": "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJndWVzdCIsInJvbGVzIjpbIlJPTEVfT0NDVVBBTlQiXSwiaWF0IjoxNzQzNjE1MzA1LCJleHAiOjE3NDM2MTg5MDV9...",
    "iduser": 1,
    "devicename": "a989b76f5d8c827c",
    "unicastlowadress": "0001",
    "unicasthighadress": 0,
    "grouplowadress": 0,
    "grouphighadress": 0,
    "scenelowadress": 0,
    "scenehighadress": 0,
    "sequencenumber": 0,
    "ivindex": 0,
    "mqttClientCreated": null,
    "mqttClientModified": null,
    "setUserAdminToken": null,
    "setUserGatewayToken": null,
    "mqttIP": null,
    "mqttPORT": null,
    "databaseIP": "iot.waveon.tn/WS_WAVEON/proxy/",
    "databasePORT": "81",
    "databaseUserName": "",
    "databasePassKey": "",
    "subscriptionType": 0,
    "maxUserReached": 0
}
```

### Champs importants à noter:
- **token**: Le JWT token pour les appels API suivants
- **idclient**: L'identifiant du client (utilisateur)
- **iduser**: L'identifiant de l'utilisateur
- **email**: L'email de l'utilisateur
- **username**: Le nom d'utilisateur

---

## Étape 6: Sauvegarder la requête (Optionnel)

1. Cliquez sur **"Save"** en haut à droite
2. Donnez un nom à votre requête: "LoginClientService Test"
3. Créez ou sélectionnez une collection
4. Cliquez sur **"Save"**

---

## Tests supplémentaires

### Test 1: Mauvais mot de passe
Changez le password dans le body:
```json
{
  "email": "amal.waly@etudiant-isi.utm.tn",
  "password": "mauvais_password",
  "devicename": "a989b76f5d8c827c"
}
```
**Résultat attendu**: Erreur 500 avec message "Invalid email or password"

### Test 2: Email inexistant
```json
{
  "email": "inexistant@example.com",
  "password": "123456",
  "devicename": "a989b76f5d8c827c"
}
```
**Résultat attendu**: Erreur 500 avec message "Invalid email or password"

### Test 3: Sans devicename (optionnel)
```json
{
  "email": "amal.waly@etudiant-isi.utm.tn",
  "password": "123456"
}
```
**Résultat attendu**: Succès 200 OK (devicename est optionnel)

---

## Utiliser le token pour d'autres appels API

Une fois que vous avez le token, vous pouvez l'utiliser pour les appels API protégés:

1. Créez une nouvelle requête
2. Dans l'onglet **"Authorization"**:
   - Type: Sélectionnez **"Bearer Token"**
   - Token: Collez le token reçu (la valeur du champ "token" de la réponse)

Ou manuellement dans les Headers:
- **Key**: `Authorization`
- **Value**: `Bearer <votre_token_ici>`

---

## Capture d'écran de la configuration Postman

```
┌─────────────────────────────────────────────────────────┐
│ POST  http://localhost:8080/auth/LoginClientService    │
├─────────────────────────────────────────────────────────┤
│ Params  Authorization  Headers  Body  Pre-request  Tests│
│                                                          │
│ Headers:                                                 │
│ ┌──────────────────┬──────────────────┬────────────┐   │
│ │ Key              │ Value            │ Description │   │
│ ├──────────────────┼──────────────────┼────────────┤   │
│ │ Content-Type     │ application/json │            │   │
│ └──────────────────┴──────────────────┴────────────┘   │
│                                                          │
│ Body: ○ none  ○ form-data  ○ x-www-form-urlencoded     │
│       ● raw   ○ binary     ○ GraphQL                    │
│                                                          │
│       [Text ▼] → [JSON ▼]                               │
│                                                          │
│ {                                                        │
│   "email": "amal.waly@etudiant-isi.utm.tn",            │
│   "password": "123456",                                  │
│   "devicename": "a989b76f5d8c827c"                      │
│ }                                                        │
│                                                          │
│                                    [Send] [Save ▼]      │
└─────────────────────────────────────────────────────────┘
```

---

## Dépannage

### Problème: "Connection refused" ou "Could not get response"
**Solution**: Vérifiez que le service auth-service est bien démarré sur le port 8080

### Problème: "404 Not Found"
**Solution**: Vérifiez l'URL, elle doit être exactement: `http://localhost:8080/auth/LoginClientService`

### Problème: "400 Bad Request"
**Solution**: 
- Vérifiez que le Content-Type est bien `application/json`
- Vérifiez que le JSON est valide (pas de virgule en trop, guillemets corrects)

### Problème: "500 Internal Server Error"
**Solution**: 
- Vérifiez les logs du service pour voir l'erreur exacte
- Assurez-vous que la base de données est accessible
- Vérifiez que l'utilisateur test a bien été créé au démarrage

---

## Commandes utiles

### Démarrer le service:
```bash
cd auth-service
mvn spring-boot:run
```

### Vérifier que le service répond:
```bash
curl http://localhost:8080/actuator/health
```

### Tester avec curl (alternative à Postman):
```bash
curl -X POST http://localhost:8080/auth/LoginClientService \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"amal.waly@etudiant-isi.utm.tn\",\"password\":\"123456\",\"devicename\":\"a989b76f5d8c827c\"}"
```
