/**
 * Super Mario Jump - Lógica do Jogo e Integração com Ranking MySQL (Laragon)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Elementos do Jogo
    const mario = document.querySelector('.mario');
    const castelo = document.querySelector('.castelo');
    const gameBoard = document.getElementById('game-board');
    const hudPlayerName = document.getElementById('hud-player-name');
    const scoreDisplay = document.getElementById('score-display');
    const jumpTip = document.getElementById('jump-tip');

    // Modais e Telas
    const startModal = document.getElementById('start-modal');
    const startForm = document.getElementById('start-form');
    const playerInput = document.getElementById('player-input');
    const btnViewRanking = document.getElementById('btn-view-ranking');

    const gameoverModal = document.getElementById('gameover-modal');
    const finalScoreValue = document.getElementById('final-score-value');
    const saveStatusMsg = document.getElementById('save-status-msg');
    const rankingBody = document.getElementById('ranking-body');
    const btnRestart = document.getElementById('btn-restart');
    const btnChangePlayer = document.getElementById('btn-change-player');

    // Variáveis de Estado
    let currentPlayer = '';
    let score = 0;
    let isPlaying = false;
    let gameLoop = null;
    let scoreLoop = null;
    let pendingSpeed = false;
    
    const levelDisplay = document.getElementById('level-display');
    const crown = document.getElementById('crown');
    const crownDisplay = document.getElementById('crown-display');

    let crowns = 0;
    const MAX_CROWNS_PER_LEVEL = 1; // Limite de coroas por fase
    let levelCrownsCount = 0;        // Contador de coroas do nível atual
    const CROWN_EXTRA_MIN = 10;       // a coroa nasce pelo menos X px ACIMA da cabeça do personagem parado (obriga a pular)
    const CROWN_EXTRA_MAX = 140;      // e no máximo X px acima (o pulo alcança ~170px)
    const CROWN_MIN_X = 40;           // posição horizontal mínima
    const CROWN_MAX_X = 130;          // posição horizontal máxima
    const CROWN_LIFETIME = 1800;      // quanto tempo a coroa fica na tela (ms)
    const CROWN_SPAWN_MIN = 300;      // tempo mínimo até a próxima coroa (ms)
    const CROWN_SPAWN_MAX = 800;      // tempo máximo até a próxima coroa (ms)
    let crownShownAt = 0;             // momento em que a coroa apareceu

    let crownSpawnTimer = null;
    let crownHideTimer = null;

    // ===== PERSONAGENS =====
    // run = imagem correndo | dead = imagem ao bater no castelo | deadWidth = largura da imagem "dead" (px)
    const CHARACTERS = [
        { id: 'mario', nome: 'Mario', run: 'assets/mario.gif', dead: 'assets/game-over.png', deadWidth: 75 },
        { id: 'wanda', nome: 'Wanda', run: 'assets/wanda.gif', dead: 'assets/wanda_morte.png', deadWidth: 71 },
        { id: 'cosmo', nome: 'Cosmo', run: 'assets/cosmo.gif', dead: 'assets/cosmo_morte.png', deadWidth: 88 },
        { id: 'wanda-wanda', nome: 'Wanda', run: 'assets/wanda_wanda.gif', dead: 'assets/wanda_morte.png', deadWidth: 71, bloqueado: true },
        { id: 'cosmo-visao', nome: 'Cosmo', run: 'assets/cosmo_visao.gif', dead: 'assets/cosmo_morte.png', deadWidth: 88, bloqueado: true }
    ];

    // Pré-carrega as imagens de "bater no castelo" para aparecerem na hora da colisão
    CHARACTERS.forEach(c => { if (c.dead) new Image().src = c.dead; });

    const menuCharacterImg = document.getElementById('menu-character-img');
    const characterNameEl = document.getElementById('character-name');
    const characterList = document.getElementById('character-list');
    const characterModal = document.getElementById('character-modal');
    const btnChangeCharacter = document.getElementById('btn-change-character');
    const btnCharacterBack = document.getElementById('btn-character-back');

// ===== BÔNUS: Wanda e Cosmo ficam bloqueados até o jogador chegar ao último level =====
    let bonusUnlocked = false;
    let unlockedThisRun = false;

    const unlockToast = document.getElementById('unlock-toast');
    const unlockMessage = document.getElementById('unlock-message');
    const characterHint = document.getElementById('character-hint');
    let toastTimer = null;

    // Chave única para salvar o progresso de CADA jogador separadamente
    // Retorna a chave do localStorage específica para o jogador atual
    function getPlayerUnlockKey() {
        const typed = playerInput ? playerInput.value : '';
        const name = (currentPlayer || typed || 'default').trim().toLowerCase();
        return `mario_jump_unlocked_${name}`;
    }
    // Carrega se o jogador atual tem o bônus liberado
    function loadPlayerProgress() {
        bonusUnlocked = localStorage.getItem(getPlayerUnlockKey()) === 'true';
    }

    function isUnlocked(char) {
        return !char.bloqueado || bonusUnlocked;
    }


    // Função que executa o desbloqueio
    function unlockBonus() {
        if (bonusUnlocked) return;

        bonusUnlocked = true;
        unlockedThisRun = true;

        // Salva no localStorage associado ao nome do jogador atual
        localStorage.setItem(getPlayerUnlockKey(), 'true');

        // Atualiza a interface da lista de escolha de personagens
        renderCharacters();

        // Exibe a notificação na tela
        if (unlockToast) {
            unlockToast.textContent = '🏆 CONQUISTA! Wanda e Cosmo desbloqueados!';
            unlockToast.classList.add('show');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => unlockToast.classList.remove('show'), 4000);
        }
    }

    // Lê o personagem salvo no navegador; se não houver (ou estiver bloqueado), usa o Mario
    const savedCharId = localStorage.getItem('mario_jump_character');
    let selectedCharacter = CHARACTERS.find(c => c.id === savedCharId && isUnlocked(c)) || CHARACTERS[0];

    let level = 1;
    const MAX_LEVEL = 2;        // último level: aqui a velocidade já chegou no limite (MIN_SPEED)
    const BASE_SPEED = 1.6;     // duração inicial do cano (segundos)
    const MIN_SPEED = 0.6;      // limite: não deixar impossível
    const SPEED_STEP = 0.15;    // quanto reduz a cada level

    function getPipeDuration() {
        return Math.max(MIN_SPEED, BASE_SPEED - (level - 1) * SPEED_STEP);
    } //math.max garante que a velocidade nunca passe do limite

    function applySpeed(restart = false) {
        if (restart) {
            // Zera o tempo acumulado da animação (evita o cano "teleportar")
            castelo.style.animation = 'none';
            void castelo.offsetWidth;      // força o navegador a processar a remoção
            castelo.style.animation = '';  // volta a usar a animação do CSS
        }
        castelo.style.animationDuration = `${getPipeDuration()}s`;
    }

    // Sorteia um número inteiro entre min e max
    function randomBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Agenda a próxima coroa com verificação
    function scheduleNextCrown() {
        clearTimeout(crownSpawnTimer);
        crownSpawnTimer = setTimeout(spawnCrown, randomBetween(CROWN_SPAWN_MIN, CROWN_SPAWN_MAX));
    }

    // Mostra a coroa na tela
    function spawnCrown() {
        if (!isPlaying) return;

        // Se já coletou 1 coroas NESTE nível, espera o próximo nível sem travar o jogo
        if (levelCrownsCount >= MAX_CROWNS_PER_LEVEL) {
            scheduleNextCrown();
            return;
        }

        crown.style.left = `${randomBetween(CROWN_MIN_X, CROWN_MAX_X)}px`;
        // altura baseada no tamanho do personagem atual (Mario, Wanda e Cosmo têm alturas diferentes)
        const charHeight = mario.offsetHeight;
        crown.style.bottom = `${randomBetween(charHeight + CROWN_EXTRA_MIN, charHeight + CROWN_EXTRA_MAX)}px`;

        crown.classList.add('visible');
        crownShownAt = performance.now();

        clearTimeout(crownHideTimer);
        crownHideTimer = setTimeout(hideCrown, CROWN_LIFETIME);
    }

    // Esconde a coroa quando o tempo dela acaba
    function hideCrown() {
        clearTimeout(crownHideTimer);
        crown.classList.remove('visible');
        scheduleNextCrown();
    }

    // Para tudo (usado no Game Over e ao reiniciar)
    function stopCrowns() {
        clearTimeout(crownSpawnTimer);
        clearTimeout(crownHideTimer);
        crown.classList.remove('visible');
    }

    // Aplica o personagem escolhido no jogo e no menu
    function applyCharacter() {
        mario.src = selectedCharacter.run;
        mario.dataset.char = selectedCharacter.id;   // marca quem está em jogo
        menuCharacterImg.src = selectedCharacter.run;
        characterNameEl.textContent = selectedCharacter.nome;
    }

    // Desenha os cartões de escolha
    function renderCharacters() {
        characterList.innerHTML = '';

        CHARACTERS.forEach(char => {
            const locked = !isUnlocked(char);
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'character-option'
                + (char.id === selectedCharacter.id ? ' selected' : '')
                + (locked ? ' locked' : '');
            card.disabled = locked;
            card.innerHTML = `<img src="${char.run}" alt="${char.nome}"><span>${locked ? '🔒 ' : ''}${char.nome}</span>`;

            // Personagem bloqueado aparece escurecido e sem clique
            if (locked) {
                characterList.appendChild(card);
                return;
            }

            card.addEventListener('click', () => {
                selectedCharacter = char;
                localStorage.setItem('mario_jump_character', char.id);
                applyCharacter();
                renderCharacters();
            });

            characterList.appendChild(card);
        });

        // Dica de como desbloquear (some depois da conquista)
        characterHint.textContent = bonusUnlocked
            ? ''
            : `Chegue ao level ${MAX_LEVEL} para desbloquear Wanda e Cosmo!`;
    }

    // Confere o progresso do nome que está no campo e aplica o personagem certo
    function refreshPlayerCharacters() {
        loadPlayerProgress();

        // volta ao personagem salvo, se esse jogador já tiver liberado ele; senão Mario
        const saved = CHARACTERS.find(c => c.id === localStorage.getItem('mario_jump_character') && isUnlocked(c));
        const next = saved || CHARACTERS[0];

        if (next.id !== selectedCharacter.id || !mario.dataset.char) {
            selectedCharacter = next;
            applyCharacter();
        }
        renderCharacters();
    }

    // Recupera último nome utilizado caso exista
    const savedName = localStorage.getItem('mario_jump_player');
    if (savedName && playerInput) {
        playerInput.value = savedName;
    }

    refreshPlayerCharacters();   // aplica o personagem salvo ao abrir a página

    // Se a pessoa digitar outro nome, confere o progresso dele na hora
    playerInput.addEventListener('input', refreshPlayerCharacters);


    // quando o cano termina uma volta e reinicia, aplica a velocidade pendente
    castelo.addEventListener('animationiteration', () => {
        if (pendingSpeed) {
            applySpeed(true);
            pendingSpeed = false;
        }
    });

    /**
     * Inicia uma nova rodada
     */

    function startGame() {
        // Limpa loops anteriores se existirem
        clearInterval(gameLoop);
        clearInterval(scoreLoop);

        // Reseta posições e visuais
        resetElements();

        isPlaying = true;
        score = 0;
        unlockedThisRun = false;
        unlockToast.classList.remove('show');
        scoreDisplay.textContent = '0';
        hudPlayerName.textContent = currentPlayer || 'Jogador';

        level = 1;                          //  volta para o level 1
        levelDisplay.textContent = '1';     // atualiza o número na tela
        pendingSpeed = false;                // coloca a velocidade inicial no cano
        applySpeed();

        crowns = 0;
        levelCrownsCount = 0; // Reseta a contagem de coroas no início da partida
        crownDisplay.textContent = '0';
        stopCrowns();
        scheduleNextCrown();


        // Ativa animações CSS do jogo
        gameBoard.classList.add('running');

        // Loop de pontuação progressiva (1 ponto a cada 100ms)
        // Loop de pontuação progressiva (1 ponto a cada 100ms)
        scoreLoop = setInterval(() => {
            if (isPlaying) {
                score += 1;
                scoreDisplay.textContent = score;

                const newLevel = Math.min(Math.floor(score / 50) + 1, MAX_LEVEL);
                if (newLevel !== level) {
                    level = newLevel;
                    levelDisplay.textContent = level;
                    pendingSpeed = true;

                    // Nova fase: libera a coroa do novo level
                    levelCrownsCount = 0;
                    scheduleNextCrown();
                }

                // Libera os bónus ao chegar ao nível 8
                if (level >= MAX_LEVEL) {
                    unlockBonus();
                }
            }
        }, 100);

        // Loop de colisão
        gameLoop = setInterval(checkCollision, 10);
    }


    function resetElements() {
        // Reseta cano
        castelo.style.animation = '';
        castelo.style.left = '';

        // Reseta Mario
        mario.src = selectedCharacter.run;
        mario.style.animation = '';
        mario.style.bottom = '0px';
        mario.style.width = '';
        mario.style.marginLeft = '';
        mario.classList.remove('jump');

        if (jumpTip) {
            jumpTip.style.opacity = '1';
        }
    }

    function jump() {
        if (!isPlaying) return;
        if (mario.classList.contains('jump')) return;

        mario.classList.add('jump');

        if (jumpTip) {
            jumpTip.style.opacity = '0';
        }

        setTimeout(() => {
            mario.classList.remove('jump');
        }, 600);
    }

    // Checa o pulo e a coleta da coroa
    function checkCrownCollect() {
        // Se a coroa NÃO está visível, cancela na hora!
        if (!crown.classList.contains('visible')) return;

        // a coroa precisa ficar visível um instante antes de poder ser pega
        if (performance.now() - crownShownAt < 250) return;

        const m = mario.getBoundingClientRect();
        const c = crown.getBoundingClientRect();

        const isSmallChar = ['wanda', 'cosmo', 'wanda-wanda', 'cosmo-visao'].includes(selectedCharacter.id);
        const insetX = isSmallChar ? 10 : 30;
        const insetY = isSmallChar ? 5 : 10;

        const overlap =
            m.left + insetX < c.right &&
            m.right - insetX > c.left &&
            m.top + insetY < c.bottom &&
            m.bottom > c.top;

        if (overlap) {
            // 1. O SEGREDO: Esconde a coroa IMEDIATAMENTE no primeiro toque do pulo!
            // Isso impede o jogo de contar +1 várias vezes no mesmo pulo.
            crown.classList.remove('visible');

            // 2. Desliga o relógio de sumiço automático
            clearTimeout(crownHideTimer);

            // 3. Soma apenas 1 coroa no contador
            crowns += 1;
            levelCrownsCount += 1;
            crownDisplay.textContent = crowns;

            // 4. Prepara o surgimento da próxima coroa
            scheduleNextCrown();
        }
    }

    function checkCollision() {
        if (!isPlaying) return;
        checkCrownCollect();

        const casteloPosition = castelo.offsetLeft;
        const marioPosition = +window.getComputedStyle(mario).bottom.replace('px', '');

        // Tolerância de colisão: quando o cano está na faixa de contato com o Mario
        if (casteloPosition <= 120 && casteloPosition > 0 && marioPosition < 100) {
            triggerGameOver(casteloPosition, marioPosition);
        }
    }

    function triggerGameOver(casteloPosition, marioPosition) {
        isPlaying = false;
        clearInterval(gameLoop);
        clearInterval(scoreLoop);
        stopCrowns();


        gameBoard.classList.remove('running');


        castelo.style.animation = 'none';
        castelo.style.left = `${casteloPosition}px`;

        // Congela o Mario na altura exata e muda para a imagem de Game Over
        mario.style.animation = 'none';
        mario.style.bottom = `${marioPosition}px`;
        mario.src = selectedCharacter.dead || 'assets/game-over.png';
        mario.style.width = `${selectedCharacter.deadWidth || 75}px`;
        // só o Mario precisa deslocar para a direita (a imagem dele tem espaço vazio)
        mario.style.marginLeft = selectedCharacter.id === 'mario' ? '50px' : '0px';

        // Atualiza modal de Game Over
        finalScoreValue.textContent = score;
        saveStatusMsg.textContent = 'Salvando pontuação no banco...';
        saveStatusMsg.style.color = '#ffcc00';

        // Mensagem de conquista (só aparece na partida em que o bônus foi desbloqueado)
        unlockToast.classList.remove('show');
        unlockMessage.hidden = !unlockedThisRun;

        // Abre modal de Game Over
        gameoverModal.classList.add('active');

        // Salva a pontuação no banco MySQL via PHP
        saveScore(currentPlayer, score, crowns);
    }


    function saveScore(playerName, finalScore, finalCrowns) {
        fetch('salvar_ranking.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nome: playerName,
                pontos: finalScore,
                coroa: finalCrowns
            })
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    saveStatusMsg.textContent = 'Pontuação registrada no banco!';
                    saveStatusMsg.style.color = '#10b981';
                    if (data.ranking) {
                        renderRanking(data.ranking, playerName, finalScore);
                    }
                } else {
                    saveStatusMsg.textContent = '⚠️ ' + (data.message || 'Erro ao registrar.');
                    saveStatusMsg.style.color = '#ef4444';
                }
            })
            .catch(err => {
                console.error('Erro na requisição:', err);
                saveStatusMsg.textContent = '⚠️ Erro ao conectar ao servidor Laragon.';
                saveStatusMsg.style.color = '#ef4444';
            });
    }

    /**
     * Busca o ranking atualizado no banco
     */
    function fetchRanking() {
        fetch('obter_ranking.php')
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success' && data.ranking) {
                    renderRanking(data.ranking);
                }
            })
            .catch(err => console.error('Erro ao buscar ranking:', err));
    }

    /**
     * Atualiza a tabela HTML do ranking
     */
    function renderRanking(list, highlightName = null, highlightScore = null) {
        if (!rankingBody) return;
        rankingBody.innerHTML = '';

        if (!list || list.length === 0) {
            rankingBody.innerHTML = '<tr><td colspan="3" class="loading-cell">Nenhuma pontuação gravada ainda. Jogue para ser o 1º!</td></tr>';
            return;
        }

        let highlighted = false;

        list.forEach((item, index) => {
            const tr = document.createElement('tr');

            // Destaca a pontuação atual recém-salva se coincidir
            if (!highlighted && highlightName && item.nome === highlightName && parseInt(item.pontos, 10) === highlightScore) {
                tr.classList.add('highlight-current');
                highlighted = true;
            }

            let medal = `${index + 1}º`;
            if (index === 0) medal = '🥇 1º';
            else if (index === 1) medal = '🥈 2º';
            else if (index === 2) medal = '🥉 3º';

            tr.innerHTML = `
                <td class="ranking-pos">${medal}</td>
                <td><strong>${escapeHtml(item.nome)}</strong></td>
                <td>${parseInt(item.pontos, 10)} pts</td>
            `;

            rankingBody.appendChild(tr);
        });
    }

    /**
     * Função auxiliar para sanitizar strings no HTML
     */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Submit do Formulário de Início (INICIAR JOGO)
    startForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const nameValue = playerInput.value.trim();
        if (!nameValue) {
            playerInput.focus();
            return;
        }

        currentPlayer = nameValue;
        localStorage.setItem('mario_jump_player', currentPlayer);

        // Carrega o progresso deste jogador e aplica o personagem dele
        refreshPlayerCharacters();

        startModal.classList.remove('active');
        startGame();
    });

    // Botão "VER RANKING" na tela inicial
    btnViewRanking.addEventListener('click', () => {
        fetchRanking();
        finalScoreValue.textContent = '---';
        saveStatusMsg.textContent = '';
        unlockMessage.hidden = true;
        startModal.classList.remove('active');
        gameoverModal.classList.add('active');
    });

    // Botão "JOGAR NOVAMENTE" no Game Over
    btnRestart.addEventListener('click', () => {
        gameoverModal.classList.remove('active');
        if (!currentPlayer) {
            startModal.classList.add('active');
            playerInput.focus();
        } else {
            startGame();
        }
    });

    // 4. Botão "TROCAR JOGADOR" no Game Over
    btnChangePlayer.addEventListener('click', () => {
        gameoverModal.classList.remove('active');
        resetElements();

        // O nome agora vem do campo de texto (continua preenchido)
        currentPlayer = '';

        startModal.classList.add('active');
        playerInput.focus();
        playerInput.select();           // digitar substitui o nome; não digitar mantém o mesmo jogador
        refreshPlayerCharacters();      // confere o progresso do nome que está no campo
    });

    // Botão "TROCAR PERSONAGEM" no menu inicial
    btnChangeCharacter.addEventListener('click', () => {
        renderCharacters();                       // desenha os cartões
        startModal.classList.remove('active');    // fecha o menu
        characterModal.classList.add('active');   // abre a escolha
    });

    // Botão "VOLTAR" na escolha de personagem
    btnCharacterBack.addEventListener('click', () => {
        characterModal.classList.remove('active');
        startModal.classList.add('active');
    });

    // 5. Controle do Pulo por Teclado (Espaço ou Seta para Cima)
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.key === ' ' || e.code === 'ArrowUp') {
            if (isPlaying) {
                e.preventDefault();
                jump();
            }
        }
    });
});