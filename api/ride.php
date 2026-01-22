<?php
header('Content-Type: application/json');

require __DIR__ . '/../lib/auth.php';

$user = currentUser();
if (!$user) {
    http_response_code(401);
    echo json_encode(['error' => 'Authentication required']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($user['role'] === 'admin') {
        $stmt = $pdo->query(
            'SELECT rides.id, rides.status, rides.created_at, u.name AS rider_name, rides.pickup_lat, rides.pickup_lng, rides.drop_lat, rides.drop_lng
             FROM rides
             LEFT JOIN users u ON u.id = rides.rider_id
             ORDER BY rides.id DESC
             LIMIT 10'
        );
    } else {
        $stmt = $pdo->prepare(
            'SELECT rides.id, rides.status, rides.created_at, u.name AS rider_name, rides.pickup_lat, rides.pickup_lng, rides.drop_lat, rides.drop_lng
             FROM rides
             LEFT JOIN users u ON u.id = rides.rider_id
             WHERE rides.user_id = ?
             ORDER BY rides.id DESC
             LIMIT 10'
        );
        $stmt->execute([$user['id']]);
    }

    echo json_encode([
        'rides' => $stmt->fetchAll(),
    ]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
