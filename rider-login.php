<?php
require_once __DIR__ . '/lib/auth.php';

if (currentUser()) {
    header('Location: rider-dashboard.php');
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    $stmt = $pdo->prepare('SELECT id, name, email, password_hash, role FROM users WHERE email = ? AND role = ?');
    $stmt->execute([$email, 'rider']);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
        loginUser($user);
        header('Location: rider-dashboard.php');
        exit;
    }

    $error = 'Invalid rider credentials.';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Rider Login – Ola Ride</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="auth-body">
  <div class="auth-card">
    <h1>Rider Login</h1>
    <p class="auth-sub">Track assignments and ride status.</p>
    <?php if ($error): ?>
      <div class="auth-error"><?php echo htmlspecialchars($error, ENT_QUOTES); ?></div>
    <?php endif; ?>
    <form method="post" class="auth-form">
      <label>
        Email
        <input type="email" name="email" required>
      </label>
      <label>
        Password
        <input type="password" name="password" required>
      </label>
      <button type="submit" class="primary-btn">Login as Rider</button>
    </form>
    <div class="auth-links">
      <a href="login.php">User login</a>
    </div>
  </div>
</body>
</html>
