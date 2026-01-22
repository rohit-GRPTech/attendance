CREATE DATABASE IF NOT EXISTS ola_ride CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ola_ride;

CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'rider', 'admin') NOT NULL DEFAULT 'user',
    rating DECIMAL(2, 1) NOT NULL DEFAULT 4.8,
    vehicle_type VARCHAR(40) DEFAULT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    lat DECIMAL(10, 6) DEFAULT NULL,
    lng DECIMAL(10, 6) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS locations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    lat DECIMAL(10, 6) NOT NULL,
    lng DECIMAL(10, 6) NOT NULL
);

CREATE TABLE IF NOT EXISTS rides (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    rider_id INT UNSIGNED DEFAULT NULL,
    pickup_location_id INT UNSIGNED NOT NULL,
    drop_location_id INT UNSIGNED NOT NULL,
    pickup_lat DECIMAL(10, 6) NOT NULL,
    pickup_lng DECIMAL(10, 6) NOT NULL,
    drop_lat DECIMAL(10, 6) NOT NULL,
    drop_lng DECIMAL(10, 6) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'requested',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (rider_id) REFERENCES users(id),
    FOREIGN KEY (pickup_location_id) REFERENCES locations(id),
    FOREIGN KEY (drop_location_id) REFERENCES locations(id)
);

INSERT INTO users (name, email, password_hash, role, rating, vehicle_type, status, lat, lng)
VALUES
    ('Admin', 'admin@demo.com', '$2y$12$oSOgECJA3UzhhL45DKMZSeX70jQDlatlVQO5cmXB6jNsEz/DuWGYK', 'admin', 5.0, NULL, 'available', NULL, NULL),
    ('Aarav Singh', 'aarav@demo.com', '$2y$12$oSOgECJA3UzhhL45DKMZSeX70jQDlatlVQO5cmXB6jNsEz/DuWGYK', 'rider', 4.9, 'Mini', 'available', 18.0833, 73.4167),
    ('Neha Patil', 'neha@demo.com', '$2y$12$oSOgECJA3UzhhL45DKMZSeX70jQDlatlVQO5cmXB6jNsEz/DuWGYK', 'rider', 4.8, 'Prime', 'available', 18.1041, 73.4242),
    ('Karan Mehta', 'karan@demo.com', '$2y$12$oSOgECJA3UzhhL45DKMZSeX70jQDlatlVQO5cmXB6jNsEz/DuWGYK', 'rider', 4.7, 'Auto', 'available', 18.0605, 73.4301);

INSERT INTO locations (name, lat, lng)
VALUES
    ('Mahad Pickup Point', 18.0833, 73.4167),
    ('Mumbai Drop Point', 18.0499, 73.6762),
    ('Raigad Fort Gate', 18.2332, 73.4441),
    ('Poladpur Market', 18.1721, 73.4690),
    ('Mahad Bus Stand', 18.0838, 73.4175),
    ('Raigad Hospital', 18.1034, 73.4278);
