# LoginClientService API Documentation

## Overview
The auth-service has been modified to support the external API specification for `/LoginClientService/`. This endpoint provides authentication using email and password, returning a comprehensive user session object.

## Changes Made

### 1. User Entity Enhancement
**File:** `src/main/java/com/projet1/auth_service/domain/User.java`

Added all required fields from the external API specification:
- `clientname`, `country`, `city`, `active`
- `phonenumber`, `numberofphones`
- `devicename`, `unicastadress`, `isadmin`, `isgateway`
- MQTT configuration fields
- Database configuration fields
- And many more fields matching the external API response

### 2. New DTOs
**Files:**
- `src/main/java/com/projet1/auth_service/dto/LoginClientRequest.java`
- `src/main/java/com/projet1/auth_service/dto/LoginClientResponse.java`

These DTOs match the exact structure of the external API request and response.

### 3. UserService Updates
**File:** `src/main/java/com/projet1/auth_service/service/UserService.java`

Added methods:
- `findByEmail(String email)` - Find user by email
- `authenticateByEmail(String email, String password, String devicename)` - Authenticate using email
- `generateToken()` - Generate random authentication tokens

### 4. UserRepository Updates
**File:** `src/main/java/com/projet1/auth_service/repository/UserRepository.java`

Added:
- `Optional<User> findByEmail(String email)` - Query method for email lookup

### 5. AuthController Enhancement
**File:** `src/main/java/com/projet1/auth_service/controller/AuthController.java`

Added new endpoint:
- `POST /auth/LoginClientService` - Main authentication endpoint matching external API

### 6. Test Data Initialization
**File:** `src/main/java/com/projet1/auth_service/init/DataInitializer.java`

Creates a test user on startup:
- Email: `amal.waly@etudiant-isi.utm.tn`
- Password: `123456`
- Username: `guest`
- Client name: `amal`

## API Endpoint

### POST /auth/LoginClientService

**URL:** `http://localhost:8080/auth/LoginClientService`

**Request Body:**
```json
{
  "email": "amal.waly@etudiant-isi.utm.tn",
  "password": "123456",
  "devicename": "a989b76f5d8c827c"
}
```

**Response (200 OK):**
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
  "token": "eyJhbGciOiJSUzI1NiJ9...",
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

## Testing the Endpoint

### Using cURL:
```bash
curl -X POST http://localhost:8080/auth/LoginClientService \
  -H "Content-Type: application/json" \
  -d '{
    "email": "amal.waly@etudiant-isi.utm.tn",
    "password": "123456",
    "devicename": "a989b76f5d8c827c"
  }'
```

### Using Postman or Thunder Client:
1. Method: POST
2. URL: `http://localhost:8080/auth/LoginClientService`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "email": "amal.waly@etudiant-isi.utm.tn",
  "password": "123456",
  "devicename": "a989b76f5d8c827c"
}
```

## Important Notes

1. **Token Generation**: The endpoint generates a JWT token that can be used for subsequent API calls. This token is returned in the `token` field.

2. **Token Invalidation**: Each new login generates a new JWT token. The token follows JWT standards and includes user roles.

3. **Password Security**: The password in the response is the encrypted/hashed version, not the plain text password.

4. **Device Name**: The `devicename` parameter is optional but will be stored if provided.

5. **Backward Compatibility**: The original `/auth/login` and `/auth/signup` endpoints remain unchanged and functional.

## Database Schema Updates

The User table now includes many additional columns. If you're using an existing database, you may need to:

1. Drop and recreate the database, OR
2. Run database migrations to add the new columns

For development, the easiest approach is to set in `application.properties`:
```properties
spring.jpa.hibernate.ddl-auto=update
```

This will automatically add the new columns to the existing table.

## Security Considerations

1. The endpoint validates email format and requires non-blank password
2. Authentication failures return appropriate error messages
3. Passwords are encrypted using BCrypt
4. JWT tokens include user roles for authorization

## Next Steps

To use this endpoint with other services:
1. Extract the `token`, `idclient`, and `iduser` from the response
2. Include these in subsequent API calls as required by your application
3. The token can be used in the `Authorization: Bearer <token>` header for protected endpoints
