<?php
/**
 * Simple GitHub ZIP deployer (shared-hosting friendly)
 * - Deletes existing TARGET_DIR contents
 * - Downloads GitHub repo ZIP (branch)
 * - Extracts and copies into TARGET_DIR
 *
 * SECURITY:
 * - Use a secret key (?key=YOUR_SECRET)
 * - Optionally restrict by IP
 */

ini_set('display_errors', 1);
error_reporting(E_ALL);
set_time_limit(300);

// ===================== CONFIG =====================
$SECRET_KEY   = 'CHANGE_ME_SECRET_123';   // URL must include ?key=CHANGE_ME_SECRET_123
$ALLOW_IPS    = []; // optional: ['1.2.3.4']; empty = allow all

$OWNER        = 'grptechs';
$REPO         = 'attendance';
$BRANCH       = 'master'; // or main

// If repo is PRIVATE, create a GitHub token (classic or fine-grained) with repo read access
$GITHUB_TOKEN = ''; // e.g. 'ghp_xxxxxxxxx' ; leave empty for public repo

// TARGET folder where code should be deployed
$TARGET_DIR   = '/home/u586378881/domains/grptechs.com/public_html/nivara/Ola';

// Temp workspace
$TMP_BASE     = sys_get_temp_dir() . '/gh_deploy_' . md5(__FILE__);
// ==================================================


// ===================== AUTH =====================
if (!isset($_GET['key']) || $_GET['key'] !== $SECRET_KEY) {
    http_response_code(403);
    exit("Forbidden: Invalid key");
}
if (!empty($ALLOW_IPS)) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if (!in_array($ip, $ALLOW_IPS, true)) {
        http_response_code(403);
        exit("Forbidden: IP not allowed");
    }
}
// ================================================

function rrmdir($dir)
{
    if (!is_dir($dir)) return;
    $items = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($items as $item) {
        if ($item->isDir()) @rmdir($item->getRealPath());
        else @unlink($item->getRealPath());
    }
    @rmdir($dir);
}

function rrclean_dir($dir)
{
    if (!is_dir($dir)) return;
    $items = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($items as $item) {
        if ($item->isDir()) @rmdir($item->getRealPath());
        else @unlink($item->getRealPath());
    }
}

function copy_dir($src, $dst)
{
    if (!is_dir($src)) throw new Exception("Source not found: $src");
    if (!is_dir($dst)) mkdir($dst, 0755, true);

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($src, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($iterator as $item) {
        $targetPath = $dst . DIRECTORY_SEPARATOR . $iterator->getSubPathName();
        if ($item->isDir()) {
            if (!is_dir($targetPath)) mkdir($targetPath, 0755, true);
        } else {
            if (!is_dir(dirname($targetPath))) mkdir(dirname($targetPath), 0755, true);
            if (!copy($item->getRealPath(), $targetPath)) {
                throw new Exception("Failed to copy: " . $item->getRealPath());
            }
        }
    }
}

function download_file($url, $dest, $token = '')
{
    $fp = fopen($dest, 'w');
    if (!$fp) throw new Exception("Cannot write to $dest");

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_FILE => $fp,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 300,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT => 'PHP-GitHub-Deployer',
        CURLOPT_HTTPHEADER => array_filter([
            'Accept: application/vnd.github+json',
            $token ? "Authorization: token {$token}" : null,
        ]),
    ]);

    $ok = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    fclose($fp);

    if (!$ok || $http >= 400) {
        @unlink($dest);
        throw new Exception("Download failed (HTTP $http). $err");
    }
}

try {
    echo "<pre>";
    echo "== GitHub Deploy Start ==\n";
    echo "Target: $TARGET_DIR\n";

    // Prepare temp
    rrmdir($TMP_BASE);
    mkdir($TMP_BASE, 0755, true);

    $zipPath = $TMP_BASE . '/repo.zip';
    $extractPath = $TMP_BASE . '/extract';

    // GitHub ZIP URL
    $zipUrl = "https://api.github.com/repos/{$OWNER}/{$REPO}/zipball/{$BRANCH}";
    echo "Downloading ZIP...\n";
    download_file($zipUrl, $zipPath, $GITHUB_TOKEN);

    echo "Extracting...\n";
    mkdir($extractPath, 0755, true);

    $zip = new ZipArchive();
    if ($zip->open($zipPath) !== true) {
        throw new Exception("Unable to open ZIP");
    }
    $zip->extractTo($extractPath);
    $zip->close();

    // Find extracted repo root (GitHub zipball creates one top folder)
    $dirs = glob($extractPath . '/*', GLOB_ONLYDIR);
    if (!$dirs || !is_dir($dirs[0])) {
        throw new Exception("Extracted folder not found");
    }
    $repoRoot = $dirs[0];
    echo "Repo extracted folder: $repoRoot\n";

    // Ensure target exists
    if (!is_dir($TARGET_DIR)) {
        echo "Target does not exist, creating...\n";
        mkdir($TARGET_DIR, 0755, true);
    }

    // Clean target (delete files/folders inside, but keep the folder itself)
    echo "Deleting existing files in target...\n";
    rrclean_dir($TARGET_DIR);

    // Copy new code to target
    echo "Copying new code to target...\n";
    copy_dir($repoRoot, $TARGET_DIR);

    // Cleanup temp
    rrmdir($TMP_BASE);

    echo "✅ Deploy DONE.\n";
    echo "</pre>";
} catch (Exception $e) {
    echo "<pre>❌ Deploy FAILED: " . $e->getMessage() . "\n</pre>";
}
