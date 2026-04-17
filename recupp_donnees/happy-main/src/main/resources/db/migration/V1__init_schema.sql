-- V1__init_schema.sql
CREATE TABLE IF NOT EXISTS sites (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255),
    location VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS buildings_structure (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255),
    code VARCHAR(255),
    site_id BIGINT REFERENCES sites(id)
);

CREATE TABLE IF NOT EXISTS floors (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255),
    level_index INTEGER,
    building_id BIGINT REFERENCES buildings_structure(id)
);

CREATE TABLE IF NOT EXISTS zones (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255),
    type VARCHAR(255),
    floor_id BIGINT REFERENCES floors(id)
);

CREATE TABLE IF NOT EXISTS equipments (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255),
    category VARCHAR(255),
    ifc_global_id VARCHAR(255),
    zone_id BIGINT REFERENCES zones(id)
);

CREATE TABLE IF NOT EXISTS sensor_measurements (
    id BIGSERIAL PRIMARY KEY,
    sensor_id VARCHAR(255) NOT NULL,
    sensor_type VARCHAR(255) NOT NULL,
    label VARCHAR(255),
    ifc_global_id VARCHAR(255),
    room_name VARCHAR(255),
    unit VARCHAR(50),
    value DOUBLE PRECISION,
    status VARCHAR(50),
    measured_at TIMESTAMP WITH TIME ZONE NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sm_sensor_id ON sensor_measurements(sensor_id);
CREATE INDEX IF NOT EXISTS idx_sm_measured_at ON sensor_measurements(measured_at);
CREATE INDEX IF NOT EXISTS idx_sm_sensor_measured ON sensor_measurements(sensor_id, measured_at);
