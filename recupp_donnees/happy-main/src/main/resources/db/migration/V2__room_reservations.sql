CREATE TABLE IF NOT EXISTS room_reservations (
    id BIGSERIAL PRIMARY KEY,
    ifc_global_id VARCHAR(255) NOT NULL,
    room_name VARCHAR(255) NOT NULL,
    room_long_name VARCHAR(255),
    storey VARCHAR(255),
    location VARCHAR(255),
    reservation_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    country VARCHAR(255),
    phone VARCHAR(255),
    email VARCHAR(255),
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_room_reservations_room_date
    ON room_reservations(ifc_global_id, reservation_date);
