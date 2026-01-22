<?php
require_once __DIR__ . '/db.php';

function fetchLocations(): array
{
    global $pdo;
    $stmt = $pdo->query('SELECT id, name, lat, lng FROM locations ORDER BY name');
    return $stmt->fetchAll();
}

function findLocation(int $id): ?array
{
    global $pdo;
    $stmt = $pdo->prepare('SELECT id, name, lat, lng FROM locations WHERE id = ?');
    $stmt->execute([$id]);
    $location = $stmt->fetch();
    return $location ?: null;
}

function haversineDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
{
    $earthRadius = 6371000;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
    return 2 * $earthRadius * atan2(sqrt($a), sqrt(1 - $a));
}
