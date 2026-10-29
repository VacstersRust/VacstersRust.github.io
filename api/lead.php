<?php
/**
 * DomPogrom — optional backend lead handler, PHP 8.1+.
 * Disabled until DP_LEADS_ENABLED=1 and DP_LEADS_FROM are configured on Russian hosting.
 * Uses PHP mail(); hosting SMTP/delivery must be verified in production.
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function finish(int $status, string $message, bool $success = false): never {
    http_response_code($status);
    echo json_encode(['ok' => $success, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') finish(405, 'Метод не поддерживается');
if (getenv('DP_LEADS_ENABLED') !== '1') finish(503, 'Приём заявок пока недоступен');
$sender = getenv('DP_LEADS_FROM') ?: '';
if (!filter_var($sender, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $sender)) finish(503, 'Почта сервера не настроена');
// Reject cross-site browser submissions. Some older clients omit Origin: accept only when absent.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && !in_array(strtolower($origin), ['https://dompogrom.ru', 'https://www.dompogrom.ru'], true)) finish(403, 'Некорректный источник запроса');
if (!str_contains(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'multipart/form-data')) finish(415, 'Ожидается форма с вложениями');
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 8 * 1024 * 1024) finish(413, 'Файлы слишком большие');
if (!empty($_POST['company_website'])) finish(400, 'Некорректные поля формы');
if (($_POST['consent'] ?? '') !== 'yes') finish(422, 'Нужно согласие');
function value(string $key, int $limit): string {
    $v = $_POST[$key] ?? '';
    if (!is_string($v)) finish(422, 'Некорректные данные');
    $v = trim($v);
    if (mb_strlen($v, 'UTF-8') > $limit || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', $v)) finish(422, 'Некорректные данные');
    return $v;
}
$name=value('name',80);
$phone=value('phone',30);
$service=value('service',90);
$location=value('location',150);
$area=value('area',12);
$access=value('access',90);
$description=value('description',1500);
if (mb_strlen($name,'UTF-8') < 2 || strlen(preg_replace('/\D/', '', $phone)) < 10) finish(422, 'Укажите имя и телефон');
if ($area !== '' && (!ctype_digit($area) || (int)$area > 999999)) finish(422, 'Некорректная площадь');
// Persistent rate limit file contains only a one-way hash, never the original IP or personal data.
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$key = hash('sha256', $ip . '|dompogrom-leads-v1');
$lockPath = sys_get_temp_dir() . '/dp_lead_' . $key . '.txt';
$lock = @fopen($lockPath,'c+');
if (!$lock || !flock($lock, LOCK_EX)) finish(503, 'Сервер временно недоступен');
$old = trim(stream_get_contents($lock));
if ($old !== '' && (time() - (int)$old) < 180) {flock($lock,LOCK_UN);fclose($lock);finish(429,'Повторите отправку позже');}
$attachments=[]; $total=0;
foreach (['photo_1','photo_2'] as $key) {
    if (!isset($_FILES[$key]) || $_FILES[$key]['error'] === UPLOAD_ERR_NO_FILE) continue;
    $f=$_FILES[$key];
    if (!is_array($f) || is_array($f['tmp_name']) || $f['error'] !== UPLOAD_ERR_OK) finish(422,'Ошибка загрузки фото');
    $size=(int)$f['size']; $total+=$size;
    if ($size<1 || $size>3*1024*1024 || $total>6*1024*1024) finish(413,'Слишком большие фото');
    if (!is_uploaded_file($f['tmp_name'])) finish(422,'Файл не принят');
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    $types=['image/jpeg'=>'.jpg','image/png'=>'.png','image/webp'=>'.webp'];
    if (!array_key_exists($mime, $types) || @getimagesize($f['tmp_name'])===false) finish(422,'Допускаются JPG, PNG, WebP');
    $contents=file_get_contents($f['tmp_name']);
    if ($contents===false) finish(500,'Не удалось прочитать вложение');
    $attachments[]=['name'=>$key . $types[$mime], 'mime'=>$mime, 'content'=>$contents];
}
$fields = [
    'Имя'=>$name, 'Телефон'=>$phone, 'Тип работ'=>$service,
    'Расположение'=>$location, 'Площадь, м²'=>$area,
    'Подъезд'=>$access, 'Описание'=>$description,
    'Подтверждено согласие'=>'yes',
];
$message = "DomPogrom — заявка с сайта\r\n\r\n";
foreach($fields as $label=>$v) $message .= $label . ': ' . ($v === '' ? 'не указано' : $v) . "\r\n";
$boundary='dp-' . bin2hex(random_bytes(16));
$body="--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($message));
foreach ($attachments as $file) {
    $body .= "\r\n--$boundary\r\nContent-Type: {$file['mime']}; name=\"{$file['name']}\"\r\nContent-Disposition: attachment; filename=\"{$file['name']}\"\r\nContent-Transfer-Encoding: base64\r\n\r\n";
    $body .= chunk_split(base64_encode($file['content']));
}
$body .= "\r\n--$boundary--\r\n";
$subject='=?UTF-8?B?' . base64_encode('Новая заявка — DomPogrom') . '?=';
$headers=['From: DomPogrom <' . $sender . '>','MIME-Version: 1.0','Content-Type: multipart/mixed; boundary="' . $boundary . '"','X-Auto-Response-Suppress: All'];
$ok=@mail('dompogrom@mail.ru', $subject, $body, implode("\r\n",$headers));
if (!$ok) {flock($lock,LOCK_UN);fclose($lock);finish(503,'Почтовый сервер не принял заявку');}
ftruncate($lock,0);rewind($lock);fwrite($lock,(string)time());fflush($lock);flock($lock,LOCK_UN);fclose($lock);
// mail() reports local acceptance, not mailbox delivery. An end-to-end production test is mandatory.
finish(200,'Запрос передан почтовой системе',true);
