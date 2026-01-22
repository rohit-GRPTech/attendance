<?php
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/location.php';

requireLogin();

$meta = [
    'title' => 'Ola Style Ride – PHP Demo',
    'description' => 'Responsive Ola/Uber-style map demo with PHP + SQL backend.',
];
$locations = fetchLocations();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title><?php echo htmlspecialchars($meta['title'], ENT_QUOTES); ?></title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="<?php echo htmlspecialchars($meta['description'], ENT_QUOTES); ?>">

  <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/style.css">
  <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js" defer></script>
  <script src="assets/js/app.js" defer></script>
</head>
<body>
  <div class="app-shell">
    <div id="map"></div>

    <div class="top-bar">
      <div class="brand">
        <div class="brand-badge">O</div>
        Ola Ride
      </div>
      <div class="location-details">
        <div class="location-row">
          <span class="location-dot pickup"></span>
          From
          <select id="pickup-select" class="location-select">
            <?php foreach ($locations as $location): ?>
              <option value="<?php echo htmlspecialchars($location['id'], ENT_QUOTES); ?>" data-lat="<?php echo htmlspecialchars($location['lat'], ENT_QUOTES); ?>" data-lng="<?php echo htmlspecialchars($location['lng'], ENT_QUOTES); ?>">
                <?php echo htmlspecialchars($location['name'], ENT_QUOTES); ?>
              </option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="location-row">
          <span class="location-dot drop"></span>
          To
          <select id="drop-select" class="location-select">
            <?php foreach ($locations as $location): ?>
              <option value="<?php echo htmlspecialchars($location['id'], ENT_QUOTES); ?>" data-lat="<?php echo htmlspecialchars($location['lat'], ENT_QUOTES); ?>" data-lng="<?php echo htmlspecialchars($location['lng'], ENT_QUOTES); ?>">
                <?php echo htmlspecialchars($location['name'], ENT_QUOTES); ?>
              </option>
            <?php endforeach; ?>
          </select>
        </div>
      </div>
      <div class="user-pill">
        <span><?php echo htmlspecialchars(currentUser()['name'], ENT_QUOTES); ?></span>
        <a href="logout.php">Logout</a>
      </div>
    </div>

    <button class="demo-btn" id="btn" type="button">Book Nearest Rider</button>

    <div class="stats-card">
      <div class="stat">
        <span class="stat-label">Status</span>
        <span class="stat-value" id="ride-status">Ready for pickup</span>
      </div>
      <div class="stat">
        <span class="stat-label">ETA</span>
        <span class="stat-value" id="eta">--</span>
      </div>
      <div class="stat">
        <span class="stat-label">Distance</span>
        <span class="stat-value" id="distance">--</span>
      </div>
      <div class="stat">
        <span class="stat-label">Est. Fare</span>
        <span class="stat-value" id="fare">--</span>
      </div>
    </div>

    <div class="loader" id="loader">
      <div class="loader-card">
        <div class="loader-title">Finding best route…</div>
        <div class="loader-sub" id="loader-sub">Matching with a nearby driver</div>
      </div>
    </div>
  </div>
</body>
</html>
