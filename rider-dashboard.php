<?php
require_once __DIR__ . '/lib/auth.php';
requireLogin();
requireRole('rider');

$stmt = $pdo->prepare(
    'SELECT rides.id, rides.status, rides.created_at, locations.name AS pickup_name, dropoffs.name AS drop_name
     FROM rides
     JOIN locations ON locations.id = rides.pickup_location_id
     JOIN locations dropoffs ON dropoffs.id = rides.drop_location_id
     WHERE rides.rider_id = ?
     ORDER BY rides.id DESC'
);
$stmt->execute([currentUser()['id']]);
$rides = $stmt->fetchAll();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Rider Dashboard – Ola Ride</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="dashboard-body">
  <div class="dashboard-shell">
    <header class="dashboard-header">
      <h1>Rider Dashboard</h1>
      <div class="dashboard-actions">
        <span><?php echo htmlspecialchars(currentUser()['name'], ENT_QUOTES); ?></span>
        <a href="logout.php">Logout</a>
      </div>
    </header>

    <section class="dashboard-card">
      <h2>Your Assigned Rides</h2>
      <table>
        <thead>
          <tr>
            <th>Ride</th>
            <th>Pickup</th>
            <th>Drop</th>
            <th>Status</th>
            <th>Requested</th>
          </tr>
        </thead>
        <tbody>
          <?php if (!$rides): ?>
            <tr>
              <td colspan="5">No rides assigned yet.</td>
            </tr>
          <?php else: ?>
            <?php foreach ($rides as $ride): ?>
              <tr>
                <td>#<?php echo htmlspecialchars($ride['id'], ENT_QUOTES); ?></td>
                <td><?php echo htmlspecialchars($ride['pickup_name'], ENT_QUOTES); ?></td>
                <td><?php echo htmlspecialchars($ride['drop_name'], ENT_QUOTES); ?></td>
                <td><?php echo htmlspecialchars($ride['status'], ENT_QUOTES); ?></td>
                <td><?php echo htmlspecialchars($ride['created_at'], ENT_QUOTES); ?></td>
              </tr>
            <?php endforeach; ?>
          <?php endif; ?>
        </tbody>
      </table>
    </section>
  </div>
</body>
</html>
