<?php
header('Content-Type: application/json');

require __DIR__ . '/../lib/auth.php';
require __DIR__ . '/../lib/location.php';

$user = currentUser();
if (!$user) {
    http_response_code(401);
    echo json_encode(['error' => 'Authentication required']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit;
}

$pickupId = (int)($payload['pickup_id'] ?? 0);
$dropId = (int)($payload['drop_id'] ?? 0);

if (!$pickupId || !$dropId) {
    http_response_code(422);
    echo json_encode(['error' => 'Pickup and drop locations are required']);
    exit;
}

$pickup = findLocation($pickupId);
$drop = findLocation($dropId);

if (!$pickup || !$drop) {
    http_response_code(404);
    echo json_encode(['error' => 'Location not found']);
    exit;
}

$stmt = $pdo->query("SELECT id, name, rating, vehicle_type, lat, lng FROM users WHERE role = 'rider' AND status = 'available' AND lat IS NOT NULL AND lng IS NOT NULL");
$riders = $stmt->fetchAll();

if (!$riders) {
    http_response_code(409);
    echo json_encode(['error' => 'No riders available']);
    exit;
}

$nearest = null;
$nearestDistance = null;
foreach ($riders as $rider) {
    $distance = haversineDistance((float)$pickup['lat'], (float)$pickup['lng'], (float)$rider['lat'], (float)$rider['lng']);
    if ($nearestDistance === null || $distance < $nearestDistance) {
        $nearestDistance = $distance;
        $nearest = $rider;
    }
}

$insert = $pdo->prepare(
    'INSERT INTO rides (user_id, rider_id, pickup_location_id, drop_location_id, pickup_lat, pickup_lng, drop_lat, drop_lng, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)' 
);
$insert->execute([
    $user['id'],
    $nearest['id'],
    $pickup['id'],
    $drop['id'],
    $pickup['lat'],
    $pickup['lng'],
    $drop['lat'],
    $drop['lng'],
    'assigned',
]);

$updateRider = $pdo->prepare('UPDATE users SET status = ? WHERE id = ?');
$updateRider->execute(['on-ride', $nearest['id']]);

$rideId = $pdo->lastInsertId();

echo json_encode([
    'status' => 'assigned',
    'ride_id' => $rideId,
    'rider' => [
        'name' => $nearest['name'],
        'rating' => $nearest['rating'],
        'vehicle_type' => $nearest['vehicle_type'],
        'distance_meters' => round($nearestDistance),
    ],
    'pickup' => $pickup,
    'drop' => $drop,
]);
