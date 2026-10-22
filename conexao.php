<?php
    $host = "localhost";
    $port = "3306";
    $user = "root";
    $pass = "mysql";
    $dbname = "jogo_mario";

    try {
        $pdo = new PDO(
            "mysql:host=$host; port=$port; charset=utf8mb4",
            $user,
            $pass,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]
        );

    $pdo->exec(
        "CREATE DATABASE IF NOT EXISTS `$dbname`"
    );

    $pdo->exec("USE `$dbname`");

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS `ranking`(
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `nome` VARCHAR(50) NOT NULL,
        `moeda` INT NOT NULL,
        `pontos` INT NOT NULL,
        `data_registro` TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
    );
} catch (PDOException $e){ 
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');

    echo json_encode([
        'status' => 'error',
        'message' => 'Não foi possivel conectar ao Banco de Dados.' .$e->getMessage()
    ]);

    exit;
}
?>