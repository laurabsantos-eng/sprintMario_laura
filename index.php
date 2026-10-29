<?php

require_once 'conexao.php';

// Busca inicial do ranking para carregar rápido na primeira abertura
$rankingInicial = [];
try {
    $stmt = $pdo->query("
        SELECT id, nome, pontos, DATE_FORMAT(data_registro, '%d/%m/%Y %H:%i') as data 
        FROM ranking 
        ORDER BY pontos DESC, id ASC 
        LIMIT 10
    ");
    $rankingInicial = $stmt->fetchAll();
} catch (Exception $e) {
    // Caso o banco ainda não possua registros
    $rankingInicial = [];
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mario Jump - Jogo com Ranking MySQL</title>
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>

    <div class="game-container">
        
        <header class="hud-bar">
            <div class="player-info">
                <span class="label">JOGADOR:</span>
                <span class="value" id="hud-player-name">---</span>
            </div>

            <div class="score-info">
                <span class="label">PONTOS:</span>
                <span class="value" id="score-display">0</span>
            </div>

            <div class="crown-info">
                <span class="label">COROAS:</span>
                <span class="value" id="crown-display">0</span>
            </div>

            <div class="level-info">
                <span class="label">LEVEL:</span>
                <span class="value" id="level-display">1</span>
            </div>
        </header>

        
        <main class="game-board" id="game-board">
            <img src="assets/clouds.png" class="clouds" alt="Nuvens">
            <img src="assets/mario.gif" class="mario" alt="Mario">
            <img src="assets/castelo.png" class="castelo" alt="Castelo">
            <img src="assets/coroa.png" class="crown" id="crown" alt="Coroa">
            <span class="jump-tip" id="jump-tip">Pressione ESPAÇO</span>
            <div class="unlock-toast" id="unlock-toast" role="status" aria-live="polite"></div>
        </main>
    </div>

<!-- 1. MENU INICIAL -->
<div class="modal-overlay menu-overlay active" id="start-modal">
    <div class="menu-pixel">
        <h1 class="menu-title">MARIO<br>JUMP</h1>
        <p class="menu-subtitle">Corra, desvie dos canos e dispute o topo do ranking!</p>

        <form class="start-form" id="start-form">
            <div class="input-group">
                <label for="player-input">DIGITE SEU NOME:</label>
                <input
                    type="text"
                    id="player-input"
                    placeholder="Ex: Seu Nome"
                    maxlength="30"
                    required
                    autocomplete="off"
                    autofocus
                >
            </div>

            <div class="menu-options">
                <button type="submit" class="menu-btn" id="btn-start">INICIAR JOGO</button>
                <button type="button" class="menu-btn" id="btn-view-ranking">VER RANKING</button>
                <button type="button" class="menu-btn" id="btn-change-character">TROCAR PERSONAGEM</button>
            </div>
        </form>

        <div class="selected-character">
            <img id="menu-character-img" src="assets/mario.gif" alt="Personagem">
            <span>PERSONAGEM: <strong id="character-name">Mario</strong></span>
        </div>

        <div class="server-status" id="server-status">
            <span class="status-dot online"></span> Conectado ao MySQL
        </div>
    </div>
</div>


    <!-- 2. TELA DE GAME OVER & RANKING -->
    <div class="modal-overlay" id="gameover-modal">
        <div class="modal-card gameover-card">
            <div class="modal-header">
                <h2 class="gameover-title">GAME OVER</h2>
                <p class="unlock-message" id="unlock-message" hidden>
                    🏆 CONQUISTA! Você chegou ao último level e desbloqueou <strong>Wanda</strong> e <strong>Cosmo</strong>!
                    Escolha eles em "TROCAR PERSONAGEM".
                </p>
                <div class="final-score-box">
                    <div class="final-score-label">SUA PONTUAÇÃO</div>
                    <div class="final-score-num" id="final-score-value">0</div>
                    <div class="save-status" id="save-status-msg"></div>
                </div>
            </div>

            <!-- Tabela com o TOP 10 -->
            <div class="ranking-container">
                <h3 class="ranking-title">🏆 TOP 10 MELHORES PONTUAÇÕES</h3>
                <div class="table-wrapper">
                    <table class="ranking-table">
                        <thead>
                            <tr>
                                <th>POS</th>
                                <th>JOGADOR</th>
                                <th>PONTUAÇÃO</th>
                            </tr>
                        </thead>
                        <tbody id="ranking-body">
                            <?php if (!empty($rankingInicial)): ?>
                                <?php foreach ($rankingInicial as $i => $row): ?>
                                    <tr>
                                        <td class="ranking-pos">
                                            <?= $i === 0 ? '🥇 1º' : ($i === 1 ? '🥈 2º' : ($i === 2 ? '🥉 3º' : ($i + 1) . 'º')) ?>
                                        </td>
                                        <td><strong><?= htmlspecialchars($row['nome']) ?></strong></td>
                                        <td><?= (int)$row['pontos'] ?> pts</td>
                                    </tr>
                                <?php endforeach; ?>
                            <?php else: ?>
                                <tr>
                                    <td colspan="3" class="loading-cell">Nenhuma pontuação gravada ainda. Jogue para ser o 1º!</td>
                                </tr>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="modal-actions">
                <button type="button" class="btn btn-primary" id="btn-restart">JOGAR NOVAMENTE</button>
                <button type="button" class="btn btn-secondary" id="btn-change-player">TROCAR JOGADOR</button>
            </div>
        </div>
    </div>

    <!-- 3. TELA DE ESCOLHA DE PERSONAGEM -->
    <div class="modal-overlay menu-overlay" id="character-modal">
    <div class="menu-pixel">
        <h2 class="menu-title menu-title-small">ESCOLHA SEU PERSONAGEM</h2>

        <div class="character-grid" id="character-list">
            <!-- os cartões são criados pelo JavaScript -->
        </div>

        <p class="character-hint" id="character-hint"></p>

        <div class="menu-options">
            <button type="button" class="menu-btn" id="btn-character-back">VOLTAR</button>
        </div>
    </div>
</div>
   
    <script src="js/script.js" defer></script>
</body>
</html>