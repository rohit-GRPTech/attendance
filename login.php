<?php
require_once __DIR__ . '/lib/auth.php';

if (currentUser()) {
    header('Location: index.php');
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    $stmt = $pdo->prepare('SELECT id, name, email, password_hash, role FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
        loginUser($user);
        if ($user['role'] === 'admin') {
            header('Location: admin/index.php');
        } elseif ($user['role'] === 'rider') {
            header('Location: rider-dashboard.php');
        } else {
            header('Location: index.php');
        }
        exit;
    }

    $error = 'Invalid email or password.';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Login – Ola Ride</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="auth-body">
  <div class="auth-card">
    <h1>Login</h1>
    <p class="auth-sub">Access your ride dashboard.</p>
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
      <button type="submit" class="primary-btn">Login</button>
    </form>
    <div class="auth-links">
      <a href="register.php">Create user account</a>
      <a href="rider-login.php">Rider login</a>
    </div>
  </div>
</body>
</html>
