# ====== STAGE 1 : BUILD ======
FROM maven:3.9.9-eclipse-temurin-17 AS builder

WORKDIR /app

# Copier les fichiers du projet
COPY pom.xml .
COPY src ./src
COPY data ./data

# Compiler le projet (sans tests)
RUN mvn clean package -DskipTests


# ====== STAGE 2 : RUN ======
FROM eclipse-temurin:17-jre

WORKDIR /app

# Copier le jar généré depuis le builder
COPY --from=builder /app/target/*.jar app.jar

# Exposer le port
EXPOSE 8084

# Lancer l'application
CMD ["java", "-jar", "app.jar"]