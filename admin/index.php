<?php
require_once __DIR__ . '/../lib/auth.php';
requireLogin();
requireRole('admin');

$users = $pdo->query('SELECT id, name, email, role, status FROM users ORDER BY id DESC')->fetchAll();
$rides = $pdo->query(
    'SELECT rides.id, rides.status, rides.created_at, riders.name AS rider_name, users.name AS user_name
     FROM rides
     JOIN users ON users.id = rides.user_id
     LEFT JOIN users riders ON riders.id = rides.rider_id
     ORDER BY rides.id DESC'
)->fetchAll();
$locations = $pdo->query('SELECT id, name, lat, lng FROM locations ORDER BY name')->fetchAll();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Admin Panel – Ola Ride</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="../assets/css/style.css">
</head>
<body class="dashboard-body">
  <div class="dashboard-shell">
    <header class="dashboard-header">
      <h1>Admin Panel</h1>
      <div class="dashboard-actions">
        <span><?php echo htmlspecialchars(currentUser()['name'], ENT_QUOTES); ?></span>
        <a href="../logout.php">Logout</a>
      </div>
    </header>

    <section class="dashboard-card">
      <h2>Users & Riders</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($users as $user): ?>
            <tr>
              <td><?php echo htmlspecialchars($user['id'], ENT_QUOTES); ?></td>
              <td><?php echo htmlspecialchars($user['name'], ENT_QUOTES); ?></td>
              <td><?php echo htmlspecialchars($user['email'], ENT_QUOTES); ?></td>
              <td><?php echo htmlspecialchars($user['role'], ENT_QUOTES); ?></td>
              <td><?php echo htmlspecialchars($user['status'], ENT_QUOTES); ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </section>

    <section class="dashboard-card">
      <h2>Recent Rides</h2>
      <table>
        <thead>
          <tr>
            <th>Ride</th>
            <th>User</th>
            <th>Rider</th>
            <th>Status</th>
            <th>Requested</th>
          </tr>
        </thead>
        <tbody>
          <?php if (!$rides): ?>
            <tr>
              <td colspan="5">No rides created yet.</td>
            </tr>
          <?php else: ?>
            <?php foreach ($rides as $ride): ?>
              <tr>
                <td>#<?php echo htmlspecialchars($ride['id'], ENT_QUOTES); ?></td>
                <td><?php echo htmlspecialchars($ride['user_name'], ENT_QUOTES); ?></td>
                <td><?php echo htmlspecialchars($ride['rider_name'] ?? 'Unassigned', ENT_QUOTES); ?></td>
                <td><?php echo htmlspecialchars($ride['status'], ENT_QUOTES); ?></td>
                <td><?php echo htmlspecialchars($ride['created_at'], ENT_QUOTES); ?></td>
              </tr>
            <?php endforeach; ?>
          <?php endif; ?>
        </tbody>
      </table>
    </section>

    <section class="dashboard-card">
      <h2>Locations</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Latitude</th>
            <th>Longitude</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($locations as $location): ?>
            <tr>
              <td><?php echo htmlspecialchars($location['id'], ENT_QUOTES); ?></td>
              <td><?php echo htmlspecialchars($location['name'], ENT_QUOTES); ?></td>
              <td><?php echo htmlspecialchars($location['lat'], ENT_QUOTES); ?></td>
              <td><?php echo htmlspecialchars($location['lng'], ENT_QUOTES); ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </section>
  </div>
</body>
</html>
