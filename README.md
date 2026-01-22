# Ola Style Ride – PHP Demo

Responsive Ola/Uber-inspired map demo built with PHP, MapLibre, and a MySQL schema for storing rides.

## Features
- MapLibre map styling with animated route playback.
- Ola/Uber-style UI panels, ETA, distance, and fare.
- User registration/login plus rider login and admin panel.
- Ride booking that assigns the nearest available rider.
- SQL schema for users, locations, and rides.

## Setup
1. Create a database and import the schema:
   ```bash
   mysql -u root -p < database/schema.sql
   ```
2. Configure database credentials in `config.php` or via environment variables:
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
3. Run a local PHP server:
   ```bash
   php -S 0.0.0.0:8000
   ```
4. Open `http://localhost:8000`.

## Demo Credentials
All seeded demo accounts use password: `demo123`
- Admin: `admin@demo.com`
- Rider: `aarav@demo.com` / `neha@demo.com` / `karan@demo.com`

## Pages
- `/register.php` for user registration.
- `/login.php` for user/admin login.
- `/rider-login.php` for rider login.
- `/admin/index.php` for the admin panel.
- `/rider-dashboard.php` for rider assignments.

## API
- `POST /api/book.php` assigns the nearest rider and creates a ride.
- `GET /api/ride.php` returns recent rides for the logged-in account (admin sees all).

## Deployment (shared hosting)
Use `deploy.php` to pull the latest GitHub ZIP and deploy it into a target folder. Update the config section in `deploy.php` with your GitHub owner, branch, and target directory before use.
