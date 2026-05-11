```mermaid
flowchart TD
    A[React UI] -->|useEffect + fetch| B[api.ts services]
    B -->|GET /api/measurements/recent| C[Spring Boot Backend (8084)]
    B -->|GET /api/spaces| C
    B -->|GET /waveon/test-session| C
    B -->|GET http://localhost:8080/api/energy/rooms| D[Energy Microservice (8080)]
    C -->|MQTT Subscription| E[WaveOn IoT Broker]
    E -->|Publish sensor data| C
    C -->|REST JSON| A
    D -->|REST JSON| A
```