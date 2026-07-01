<?php
// api.php - Router API untuk Sistem Status e-Hadir KKPPS (PHP/MySQL)

// Tetapkan zon masa tempatan Malaysia
date_default_timezone_set('Asia/Kuala_Lumpur');

// CORS Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// Kolaborasi pre-flight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once 'db_connect.php';

// Jalankan penyemaian jika database kosong
seed_database_if_empty($pdo);

$action = isset($_GET['action']) ? $_GET['action'] : '';

// Kredensial Pentadbir (Admin)
define('ADMIN_USER', 'admin');
define('ADMIN_PASS', 'admin123');
define('ADMIN_TOKEN', 'admin_secure_token_kkpps_2026');

// Fungsi pembantu untuk memulangkan output JSON
function send_json($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// Baca data JSON daripada body request
$input = json_decode(file_get_contents('php://input'), true);
if (json_last_error() !== JSON_ERROR_NONE) {
    $input = [];
}

switch ($action) {
    // ----------------------------------------------------
    // API PELAJAR & PORTAL STAF (PUBLIC)
    // ----------------------------------------------------

    // 1. Dapatkan Senarai Pensyarah (IC dibuang untuk keselamatan)
    case 'lecturers':
        try {
            $stmt = $pdo->query("SELECT `id`, `name`, `role`, `phone`, `status`, `destination`, `waktu_keluar`, `waktu_kembali`, `updated_at` FROM `lecturers` ORDER BY `name` ASC");
            $rows = $stmt->fetchAll();
            send_json($rows);
        } catch (\PDOException $e) {
            send_json(["success" => false, "message" => "Ralat memuatkan senarai pensyarah: " . $e->getMessage()], 500);
        }
        break;

    // 2. Log Masuk Pensyarah
    case 'login':
        $lecturer_id = isset($input['id']) ? $input['id'] : null;
        $ic_number = isset($input['ic']) ? trim($input['ic']) : '';

        if ($lecturer_id === null || empty($ic_number)) {
            send_json(["success" => false, "message" => "Nama Pensyarah dan No. IC diperlukan"], 400);
        }

        try {
            $stmt = $pdo->prepare("SELECT * FROM `lecturers` WHERE `id` = :id");
            $stmt->execute(['id' => (int)$lecturer_id]);
            $lecturer = $stmt->fetch();

            if ($lecturer) {
                // Bersihkan aksara '-' dan ruang untuk perbandingan jitu
                $clean_db_ic = str_replace(['-', ' '], '', trim($lecturer['ic']));
                $clean_input_ic = str_replace(['-', ' '], '', $ic_number);

                if ($clean_db_ic === $clean_input_ic) {
                    $lecturer_info = $lecturer;
                    unset($lecturer_info['ic']); // Singkirkan IC daripada respons
                    send_json([
                        "success" => true,
                        "token" => $lecturer['ic'],
                        "lecturer" => $lecturer_info
                    ]);
                }
            }
            send_json(["success" => false, "message" => "No. IC tidak sepadan dengan rekod pensyarah"], 401);
        } catch (\PDOException $e) {
            send_json(["success" => false, "message" => "Ralat pelayan: " . $e->getMessage()], 500);
        }
        break;

    // 3. Kemaskini Status Pensyarah
    case 'status':
        $lecturer_id = isset($input['id']) ? $input['id'] : null;
        $token = isset($input['token']) ? trim($input['token']) : '';
        $status = isset($input['status']) ? trim($input['status']) : '';
        $destination = isset($input['destination']) ? trim($input['destination']) : '';
        $waktu_keluar = isset($input['waktu_keluar']) ? trim($input['waktu_keluar']) : '';
        $waktu_kembali = isset($input['waktu_kembali']) ? trim($input['waktu_kembali']) : '';

        if ($lecturer_id === null || empty($token)) {
            send_json(["success" => false, "message" => "Sesi tidak sah atau tiada kebenaran"], 400);
        }

        try {
            $stmt = $pdo->prepare("SELECT * FROM `lecturers` WHERE `id` = :id");
            $stmt->execute(['id' => (int)$lecturer_id]);
            $lecturer = $stmt->fetch();

            if ($lecturer) {
                $clean_db_ic = str_replace(['-', ' '], '', trim($lecturer['ic']));
                $clean_token = str_replace(['-', ' '], '', $token);

                if ($clean_db_ic === $clean_token) {
                    if (!in_array($status, ['Dalam Kampus', 'Keluar'])) {
                        send_json(["success" => false, "message" => "Status tidak sah"], 400);
                    }

                    // Sediakan pembolehubah mengikut status
                    $dest = ($status === 'Keluar') ? $destination : '';
                    $w_out = ($status === 'Keluar') ? $waktu_keluar : '';
                    $w_in = ($status === 'Keluar') ? $waktu_kembali : '';
                    $updated = date('d-m-Y h:i A');

                    $upd_stmt = $pdo->prepare("UPDATE `lecturers` SET `status` = :status, `destination` = :dest, `waktu_keluar` = :w_out, `waktu_kembali` = :w_in, `updated_at` = :updated WHERE `id` = :id");
                    $upd_stmt->execute([
                        'status' => $status,
                        'dest' => $dest,
                        'w_out' => $w_out,
                        'w_in' => $w_in,
                        'updated' => $updated,
                        'id' => (int)$lecturer_id
                    ]);

                    send_json(["success" => true, "message" => "Status berjaya disimpan!"]);
                }
            }
            send_json(["success" => false, "message" => "Token tidak sah atau tiada kebenaran mengemaskini"], 401);
        } catch (\PDOException $e) {
            send_json(["success" => false, "message" => "Ralat pelayan: " . $e->getMessage()], 500);
        }
        break;

    // ----------------------------------------------------
    // API PENTADBIR SISTEM (ADMIN)
    // ----------------------------------------------------

    // 1. Log Masuk Admin
    case 'admin_login':
        $username = isset($input['username']) ? trim($input['username']) : '';
        $password = isset($input['password']) ? trim($input['password']) : '';

        if ($username === ADMIN_USER && $password === ADMIN_PASS) {
            send_json(["success" => true, "token" => ADMIN_TOKEN]);
        } else {
            send_json(["success" => false, "message" => "Nama pengguna atau kata laluan salah"], 401);
        }
        break;

    // 2. Dapatkan Senarai Pensyarah (Termasuk No. IC untuk paparan admin)
    case 'admin_lecturers':
        // Dapatkan token kebenaran
        $token = isset($_GET['token']) ? $_GET['token'] : '';
        
        if (empty($token)) {
            // Cuba dapatkan daripada Header Authorization jika tiada dalam GET
            $headers = getallheaders();
            $auth_header = isset($headers['Authorization']) ? $headers['Authorization'] : '';
            $token = str_replace('Bearer ', '', $auth_header);
        }
        
        if (trim($token) !== ADMIN_TOKEN) {
            send_json(["success" => false, "message" => "Tiada kebenaran (Unauthorized)"], 401);
        }

        try {
            $stmt = $pdo->query("SELECT * FROM `lecturers` ORDER BY `name` ASC");
            $rows = $stmt->fetchAll();
            send_json($rows);
        } catch (\PDOException $e) {
            send_json(["success" => false, "message" => "Ralat memuatkan data: " . $e->getMessage()], 500);
        }
        break;

    // 3. Tambah Pensyarah Baru
    case 'admin_add':
        $token = isset($input['token']) ? trim($input['token']) : '';
        if ($token !== ADMIN_TOKEN) {
            send_json(["success" => false, "message" => "Tiada kebenaran (Unauthorized)"], 401);
        }

        $name = isset($input['name']) ? trim($input['name']) : '';
        $role = isset($input['role']) ? trim($input['role']) : '';
        $phone = isset($input['phone']) ? trim($input['phone']) : '';
        $ic = isset($input['ic']) ? trim($input['ic']) : '';

        if (empty($name) || empty($ic)) {
            send_json(["success" => false, "message" => "Nama dan No. IC diperlukan"], 400);
        }

        try {
            $stmt = $pdo->prepare("INSERT INTO `lecturers` (`name`, `role`, `phone`, `ic`, `status`, `destination`, `waktu_keluar`, `waktu_kembali`, `updated_at`) 
                                   VALUES (:name, :role, :phone, :ic, 'Dalam Kampus', '', '', '', :updated)");
            $stmt->execute([
                'name' => $name,
                'role' => empty($role) ? "Pensyarah / Kakitangan" : $role,
                'phone' => $phone,
                'ic' => $ic,
                'updated' => date('d-m-Y h:i A')
            ]);
            $new_id = $pdo->lastInsertId();
            send_json(["success" => true, "message" => "Pensyarah berjaya ditambah!", "id" => $new_id]);
        } catch (\PDOException $e) {
            send_json(["success" => false, "message" => "Ralat menambah rekod: " . $e->getMessage()], 500);
        }
        break;

    // 4. Kemaskini Profil Pensyarah (Edit)
    case 'admin_update':
        $token = isset($input['token']) ? trim($input['token']) : '';
        if ($token !== ADMIN_TOKEN) {
            send_json(["success" => false, "message" => "Tiada kebenaran (Unauthorized)"], 401);
        }

        $id = isset($input['id']) ? $input['id'] : null;
        $name = isset($input['name']) ? trim($input['name']) : '';
        $role = isset($input['role']) ? trim($input['role']) : '';
        $phone = isset($input['phone']) ? trim($input['phone']) : '';
        $ic = isset($input['ic']) ? trim($input['ic']) : '';

        if ($id === null || empty($name) || empty($ic)) {
            send_json(["success" => false, "message" => "ID, Nama, dan No. IC diperlukan"], 400);
        }

        try {
            $stmt = $pdo->prepare("UPDATE `lecturers` SET `name` = :name, `role` = :role, `phone` = :phone, `ic` = :ic, `updated_at` = :updated WHERE `id` = :id");
            $stmt->execute([
                'name' => $name,
                'role' => empty($role) ? "Pensyarah / Kakitangan" : $role,
                'phone' => $phone,
                'ic' => $ic,
                'updated' => date('d-m-Y h:i A'),
                'id' => (int)$id
            ]);
            send_json(["success" => true, "message" => "Maklumat pensyarah berjaya dikemaskini!"]);
        } catch (\PDOException $e) {
            send_json(["success" => false, "message" => "Ralat mengemaskini maklumat: " . $e->getMessage()], 500);
        }
        break;

    // 5. Padam Rekod Pensyarah
    case 'admin_delete':
        $token = isset($input['token']) ? trim($input['token']) : '';
        if ($token !== ADMIN_TOKEN) {
            send_json(["success" => false, "message" => "Tiada kebenaran (Unauthorized)"], 401);
        }

        $id = isset($input['id']) ? $input['id'] : null;
        if ($id === null) {
            send_json(["success" => false, "message" => "ID diperlukan"], 400);
        }

        try {
            $stmt = $pdo->prepare("DELETE FROM `lecturers` WHERE `id` = :id");
            $stmt->execute(['id' => (int)$id]);
            send_json(["success" => true, "message" => "Rekod pensyarah berjaya dipadam!"]);
        } catch (\PDOException $e) {
            send_json(["success" => false, "message" => "Ralat memadam rekod: " . $e->getMessage()], 500);
        }
        break;

    // 6. Reset Semua Status ke "Dalam Kampus"
    case 'admin_reset_all':
        $token = isset($input['token']) ? trim($input['token']) : '';
        if ($token !== ADMIN_TOKEN) {
            send_json(["success" => false, "message" => "Tiada kebenaran (Unauthorized)"], 401);
        }

        try {
            $stmt = $pdo->prepare("UPDATE `lecturers` SET `status` = 'Dalam Kampus', `destination` = '', `waktu_keluar` = '', `waktu_kembali` = '', `updated_at` = :updated");
            $stmt->execute(['updated' => date('d-m-Y h:i A')]);
            send_json(["success" => true, "message" => "Semua status pensyarah berjaya di-reset ke Dalam Kampus!"]);
        } catch (\PDOException $e) {
            send_json(["success" => false, "message" => "Ralat reset status: " . $e->getMessage()], 500);
        }
        break;

    // 7. Reset Satu Status Pensyarah
    case 'admin_reset_single':
        $token = isset($input['token']) ? trim($input['token']) : '';
        if ($token !== ADMIN_TOKEN) {
            send_json(["success" => false, "message" => "Tiada kebenaran (Unauthorized)"], 401);
        }

        $id = isset($input['id']) ? $input['id'] : null;
        if ($id === null) {
            send_json(["success" => false, "message" => "ID diperlukan"], 400);
        }

        try {
            $stmt = $pdo->prepare("UPDATE `lecturers` SET `status` = 'Dalam Kampus', `destination` = '', `waktu_keluar` = '', `waktu_kembali` = '', `updated_at` = :updated WHERE `id` = :id");
            $stmt->execute([
                'updated' => date('d-m-Y h:i A'),
                'id' => (int)$id
            ]);
            send_json(["success" => true, "message" => "Status pensyarah berjaya di-reset!"]);
        } catch (\PDOException $e) {
            send_json(["success" => false, "message" => "Ralat reset status: " . $e->getMessage()], 500);
        }
        break;

    default:
        send_json(["success" => false, "message" => "Tindakan tidak sah"], 404);
        break;
}
?>
