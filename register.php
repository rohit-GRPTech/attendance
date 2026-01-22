<?php
require_once __DIR__ . '/lib/auth.php';

if (currentUser()) {
    header('Location: index.php');
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = trim($_POST['name'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($name === '' || $email === '' || $password === '') {
        $error = 'All fields are required.';
    } else {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            $error = 'Email already registered.';
        } else {
            $hash = password_hash($password, PASSWORD_BCRYPT);
            $insert = $pdo->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
            $insert->execute([$name, $email, $hash, 'user']);
            $userId = $pdo->lastInsertId();
            loginUser([
                'id' => $userId,
                'name' => $name,
                'email' => $email,
                'role' => 'user',
            ]);
            header('Location: index.php');
            exit;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Register – Ola Ride</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="auth-body">
  <div class="auth-card">
    <h1>Create Account</h1>
    <p class="auth-sub">Book rides with Ola-style experience.</p>
    <?php if ($error): ?>
      <div class="auth-error"><?php echo htmlspecialchars($error, ENT_QUOTES); ?></div>
    <?php endif; ?>
    <form method="post" class="auth-form">
      <label>
        Name
        <input type="text" name="name" required>
      </label>
      <label>
        Email
        <input type="email" name="email" required>
      </label>
      <label>
        Password
        <input type="password" name="password" required>
      </label>
      <button type="submit" class="primary-btn">Register</button>
    </form>
    <div class="auth-links">
      <a href="login.php">Already have an account?</a>
    </div>
  </div>
</body>
</html>
