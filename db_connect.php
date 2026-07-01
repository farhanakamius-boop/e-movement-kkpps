<?php
// db_connect.php - Sambungan MySQL MAMP & Auto-Seeder

$host = '127.0.0.1';
$port = '8889'; // Default MAMP MySQL port on macOS
$db   = 'kkpps_status';
$user = 'root';
$pass = 'root'; // Default MAMP MySQL password
$charset = 'utf8mb4';

// Setup connection options
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

$dsn = "mysql:host=$host;port=$port;dbname=$db;charset=$charset";

try {
    // Cuba menyambung ke database
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    // Jika database tidak wujud, sambung tanpa nama DB dan cipta database baru
    try {
        $dsnNoDb = "mysql:host=$host;port=$port;charset=$charset";
        $pdoNoDb = new PDO($dsnNoDb, $user, $pass, $options);
        $pdoNoDb->exec("CREATE DATABASE IF NOT EXISTS `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        
        // Cuba sambung semula ke DB yang baru dicipta
        $pdo = new PDO($dsn, $user, $pass, $options);
    } catch (\PDOException $err) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            "success" => false, 
            "message" => "Gagal menyambung ke MySQL MAMP: " . $err->getMessage() . ". Pastikan MySQL MAMP sedang berjalan."
        ]);
        exit;
    }
}

// Fungsi untuk menyemai data daripada CSV ke MySQL jika jadual kosong
function seed_database_if_empty($pdo) {
    // 1. Cipta jadual lecturers jika tiada
    try {
        $sql = "CREATE TABLE IF NOT EXISTS `lecturers` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `name` VARCHAR(255) NOT NULL,
            `role` VARCHAR(255) DEFAULT '',
            `phone` VARCHAR(50) DEFAULT '',
            `ic` VARCHAR(50) NOT NULL,
            `status` VARCHAR(50) DEFAULT 'Dalam Kampus',
            `destination` VARCHAR(255) DEFAULT '',
            `waktu_keluar` VARCHAR(50) DEFAULT '',
            `waktu_kembali` VARCHAR(50) DEFAULT '',
            `updated_at` VARCHAR(50) DEFAULT ''
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
        $pdo->exec($sql);
    } catch (\PDOException $e) {
        error_log("Gagal mencipta jadual: " . $e->getMessage());
        return;
    }

    // 2. Semak jika sudah mempunyai rekod
    try {
        $stmt = $pdo->query("SELECT COUNT(*) FROM `lecturers`");
        $count = $stmt->fetchColumn();
        if ($count > 0) {
            return; // Sudah disemai
        }
    } catch (\PDOException $e) {
        return;
    }

    // 3. Baca fail CSV
    $csvPath = 'STAF KKPPS .csv';
    if (!file_exists($csvPath)) {
        error_log("Fail CSV tidak dijumpai untuk penyemaian pangkalan data.");
        return;
    }

    $lecturers = [];
    if (($handle = fopen($csvPath, "r")) !== FALSE) {
        // Abaikan UTF-8 BOM jika wujud
        $bom = fread($handle, 3);
        if ($bom !== "\xEF\xBB\xBF") {
            rewind($handle);
        }
        
        while (($row = fgetcsv($handle, 1000, ",")) !== FALSE) {
            if (!$row || count($row) < 6) continue;
            
            $idStr = trim($row[0]);
            if (!ctype_digit($idStr)) continue; // Hanya ambil baris yang mempunyai nombor ID

            $name = trim($row[2]);
            $role = trim($row[3]);
            $role = preg_replace('/\s+/', ' ', $role); // Bersihkan ruang kosong berganda
            $phone = trim($row[4]);
            $ic = trim($row[5]);

            if (empty($name)) continue;

            $lecturers[] = [
                'id' => (int)$idStr,
                'name' => $name,
                'role' => empty($role) ? "Pensyarah / Kakitangan" : $role,
                'phone' => $phone,
                'ic' => $ic,
                'status' => 'Dalam Kampus',
                'destination' => '',
                'waktu_keluar' => '',
                'waktu_kembali' => '',
                'updated_at' => ''
            ];
        }
        fclose($handle);
    }

    // 4. Masukkan data ke dalam pangkalan data MySQL
    if (!empty($lecturers)) {
        try {
            $sql = "INSERT INTO `lecturers` (`id`, `name`, `role`, `phone`, `ic`, `status`, `destination`, `waktu_keluar`, `waktu_kembali`, `updated_at`) 
                    VALUES (:id, :name, :role, :phone, :ic, :status, :destination, :waktu_keluar, :waktu_kembali, :updated_at)";
            $stmt = $pdo->prepare($sql);
            foreach ($lecturers as $l) {
                $stmt->execute($l);
            }
        } catch (\PDOException $e) {
            error_log("Ralat menyemai pangkalan data: " . $e->getMessage());
        }
    }
}
?>
