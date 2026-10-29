/**
 * Super Mario Jump - Lógica do Jogo e Integração com Ranking MySQL (Laragon)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Elementos do Jogo
    const mario = document.querySelector('.mario');
    const pipe = document.querySelector('.pipe');
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
    const CROWN_MIN_HEIGHT = 90;      // altura mínima da moeda (px)
    const CROWN_MAX_HEIGHT = 260;     // altura máxima da moeda (px)
    const CROWN_MIN_X = 40;           // posição horizontal mínima
    const CROWN_MAX_X = 130;          // posição horizontal máxima
    const CROWN_LIFETIME = 2500;      // quanto tempo a moeda fica na tela (ms)
    const CROWN_SPAWN_MIN = 1200;     // tempo mínimo até a próxima moeda (ms)
    const CROWN_SPAWN_MAX = 2500;     // tempo máximo até a próxima moeda (ms)

    let crownSpawnTimer = null;
    let crownHideTimer = null;

    // ===== PERSONAGENS =====
    const CHARACTERS = [
        { id: 'mario', nome: 'Mario', run: 'assets/mario.gif' },
        { id: 'wanda', nome: 'Wanda', run: 'assets/wanda.gif' },
        { id: 'cosmo', nome: 'Cosmo', run: 'assets/cosmo.gif' }
    ];

    const menuCharacterImg = document.getElementById('menu-character-img');
    const characterNameEl = document.getElementById('character-name');
    const characterList = document.getElementById('character-list');
    const characterModal = document.getElementById('character-modal');
    const btnChangeCharacter = document.getElementById('btn-change-character');
    const btnCharacterBack = document.getElementById('btn-character-back');

    // Lê o personagem salvo no navegador; se não houver, usa o Mario
    const savedCharId = localStorage.getItem('mario_jump_character');
    let selectedCharacter = CHARACTERS.find(c => c.id === savedCharId) || CHARACTERS[0];

    let level = 1;
    const BASE_SPEED = 1.6;     // duração inicial do cano (segundos)
    const MIN_SPEED = 0.9;      // limite: não deixar impossível
    const SPEED_STEP = 0.1;    // quanto reduz a cada level

    function getPipeDuration() {
        return Math.max(MIN_SPEED, BASE_SPEED - (level - 1) * SPEED_STEP);
    } //math.max garante que a velocidade nunca passe do limite

    function applySpeed(restart = false) {
        if (restart) {
            // Zera o tempo acumulado da animação (evita o cano "teleportar")
            pipe.style.animation = 'none';
            void pipe.offsetWidth;      // força o navegador a processar a remoção
            pipe.style.animation = '';  // volta a usar a animação do CSS
        }
        pipe.style.animationDuration = `${getPipeDuration()}s`;
    }

    // Sorteia um número inteiro entre min e max
    function randomBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Agenda a próxima coroa para daqui a um tempo aleatório
    function scheduleNextCrown() {
        clearTimeout(crownSpawnTimer);
        crownSpawnTimer = setTimeout(spawnCrown, randomBetween(CROWN_SPAWN_MIN, CROWN_SPAWN_MAX));
    }

    // Mostra a coroa em uma posição aleatória
    function spawnCrown() {
        if (!isPlaying) return;

        crown.style.left = `${randomBetween(CROWN_MIN_X, CROWN_MAX_X)}px`;
        crown.style.bottom = `${randomBetween(CROWN_MIN_HEIGHT, CROWN_MAX_HEIGHT)}px`;
        crown.classList.add('visible');

        // se ninguém pegar, a coroa some sozinha
        crownHideTimer = setTimeout(hideCrown, CROWN_LIFETIME);
    }

    // Esconde a coroa e agenda a próxima
    function hideCrown() {
        crown.classList.remove('visible');
        clearTimeout(crownHideTimer);
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
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'character-option' + (char.id === selectedCharacter.id ? ' selected' : '');
            card.innerHTML = `<img src="${char.run}" alt="${char.nome}"><span>${char.nome}</span>`;

            card.addEventListener('click', () => {
                selectedCharacter = char;
                localStorage.setItem('mario_jump_character', char.id);
                applyCharacter();
                renderCharacters();
            });

            characterList.appendChild(card);
        });
    }

    applyCharacter();   // aplica o personagem salvo ao abrir a página

    // Recupera último nome utilizado caso exista
    const savedName = localStorage.getItem('mario_jump_player');
    if (savedName && playerInput) {
        playerInput.value = savedName;
    }


    // quando o cano termina uma volta e reinicia, aplica a velocidade pendente
    pipe.addEventListener('animationiteration', () => {
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
        scoreDisplay.textContent = '0';
        hudPlayerName.textContent = currentPlayer || 'Jogador';

        level = 1;                          //  volta para o level 1
        levelDisplay.textContent = '1';     // atualiza o número na tela
        pendingSpeed = false;                // coloca a velocidade inicial no cano
        applySpeed();

        crowns = 0;
        crownDisplay.textContent = '0';
        stopCrowns();
        scheduleNextCrown();


        // Ativa animações CSS do jogo
        gameBoard.classList.add('running');

        // Loop de pontuação progressiva (1 ponto a cada 100ms)
        scoreLoop = setInterval(() => {
            if (isPlaying) {
                score += 1;
                scoreDisplay.textContent = score;
                //A cada 50 pontos a dificuldade aumenta
                const newLevel = Math.floor(score / 50) + 1;
                if (newLevel !== level) {
                    level = newLevel;
                    levelDisplay.textContent = level;
                    pendingSpeed = true;
                }
            }
        }, 100);

        // Loop de colisão
        gameLoop = setInterval(checkCollision, 10);
    }


    function resetElements() {
        // Reseta cano
        pipe.style.animation = '';
        pipe.style.left = '';

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

    function checkCrownCollect() {
        // só tenta coletar se a coroa estiver visível
        if (!crown.classList.contains('visible')) return;

        const m = mario.getBoundingClientRect();
        const c = crown.getBoundingClientRect();

        // margens para ignorar o espaço transparente da imagem do Mario
        const insetX = 30;
        const insetY = 10;

        const overlap =
            m.left + insetX < c.right &&
            m.right - insetX > c.left &&
            m.top + insetY < c.bottom &&
            m.bottom > c.top;

        if (overlap) {
            crowns += 1;
            crownDisplay.textContent = crowns;
            hideCrown();   // some e agenda a próxima
        }
    }

    function checkCollision() {
        if (!isPlaying) return;
        checkCrownCollect();

        const pipePosition = pipe.offsetLeft;
        const marioPosition = +window.getComputedStyle(mario).bottom.replace('px', '');

        // Tolerância de colisão: quando o cano está na faixa de contato com o Mario
        if (pipePosition <= 120 && pipePosition > 0 && marioPosition < 100) {
            triggerGameOver(pipePosition, marioPosition);
        }
    }

    function triggerGameOver(pipePosition, marioPosition) {
        isPlaying = false;
        clearInterval(gameLoop);
        clearInterval(scoreLoop);
        stopCrowns();


        gameBoard.classList.remove('running');


        pipe.style.animation = 'none';
        pipe.style.left = `${pipePosition}px`;

        // Congela o Mario na altura exata e muda para a imagem de Game Over
        mario.style.animation = 'none';
        mario.style.bottom = `${marioPosition}px`;
        mario.src = 'assets/game-over.png';
        mario.style.width = '75px';
        mario.style.marginLeft = '50px';

        // Atualiza modal de Game Over
        finalScoreValue.textContent = score;
        saveStatusMsg.textContent = 'Salvando pontuação no banco...';
        saveStatusMsg.style.color = '#ffcc00';

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
        e.preventDefault(); // Impede o recarregamento da página

        const nameValue = playerInput.value.trim();
        if (!nameValue) {
            playerInput.focus();
            return;
        }

        currentPlayer = nameValue;
        localStorage.setItem('mario_jump_player', currentPlayer);

        // Fecha tela de início e começa o jogo
        startModal.classList.remove('active');
        startGame();
    });

    // Botão "VER RANKING" na tela inicial
    btnViewRanking.addEventListener('click', () => {
        fetchRanking();
        finalScoreValue.textContent = '---';
        saveStatusMsg.textContent = '';
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
        startModal.classList.add('active');
        playerInput.value = '';
        playerInput.focus();
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
