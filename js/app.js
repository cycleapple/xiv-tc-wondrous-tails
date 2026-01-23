/**
 * Wondrous Tails Calculator - Main Application
 * 天書奇談計算器 - 主應用程式
 *
 * 基於社群研究的最佳策略實作
 */

(function() {
    'use strict';

    const STORAGE_KEY = 'wondrous-tails-state';

    // State
    let sealedCells = new Set();
    let currentStrategy = 'potential';

    // DOM Elements
    let boardGrid, sealCountEl, resetBtn;
    let decisionCard, decisionIcon, decisionTitle, decisionDesc, decisionDetails;
    let currentLinesEl, potentialLinesEl;
    let prob0El, prob1El, prob2El, prob3El;
    let baseline0El, baseline1El, baseline2El, baseline3El;
    let shuffleStatusEl;
    let strategyBtns, strategyDescEl;
    let cells = [];

    // Strategy descriptions
    const STRATEGY_DESCS = {
        potential: '在 7 印章時根據「潛在連線數」決定，平衡各種結果的最佳策略。<span class="strategy-recommend">✦ 推薦</span>',
        one: '最大化達成至少 1 條線的機率。若目前機率低於平均（58.5%）則建議重新貼。',
        two: '最大化達成至少 2 條線的機率。若目前機率低於平均（10.6%）則建議重新貼。',
        three: '最大化達成 3 條線的機率。適合想拚最高獎勵的玩家，但 3 線機率本身極低（0.21%）。'
    };

    function init() {
        // Get DOM elements
        boardGrid = document.getElementById('boardGrid');
        sealCountEl = document.getElementById('sealCount');
        resetBtn = document.getElementById('resetBtn');
        shuffleStatusEl = document.getElementById('shuffleStatus');

        decisionCard = document.getElementById('decisionCard');
        decisionIcon = document.getElementById('decisionIcon');
        decisionTitle = document.getElementById('decisionTitle');
        decisionDesc = document.getElementById('decisionDesc');
        decisionDetails = document.getElementById('decisionDetails');

        currentLinesEl = document.getElementById('currentLines');
        potentialLinesEl = document.getElementById('potentialLines');

        prob0El = document.getElementById('prob0');
        prob1El = document.getElementById('prob1');
        prob2El = document.getElementById('prob2');
        prob3El = document.getElementById('prob3');

        baseline0El = document.getElementById('baseline0');
        baseline1El = document.getElementById('baseline1');
        baseline2El = document.getElementById('baseline2');
        baseline3El = document.getElementById('baseline3');

        strategyBtns = document.querySelectorAll('.strategy-btn');
        strategyDescEl = document.getElementById('strategyDesc');

        createBoard();
        loadState();
        resetBtn.addEventListener('click', handleReset);

        // Strategy selector
        strategyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                strategyBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentStrategy = btn.dataset.strategy;
                updateStrategyDesc();
                saveState();
                updateCalculations();
            });
        });

        updateStrategyDesc();
        updateCalculations();
    }

    function updateStrategyDesc() {
        const desc = STRATEGY_DESCS[currentStrategy] || STRATEGY_DESCS.potential;
        strategyDescEl.innerHTML = `<p class="strategy-text">${desc}</p>`;
    }

    function createBoard() {
        boardGrid.innerHTML = '';
        cells = [];

        for (let i = 0; i < WondrousTailsProbability.TOTAL_CELLS; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.index = i;
            cell.addEventListener('click', () => handleCellClick(i));
            cell.setAttribute('role', 'button');
            cell.setAttribute('aria-label', `格子 ${i + 1}`);
            cell.setAttribute('tabindex', '0');

            cell.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCellClick(i);
                }
            });

            boardGrid.appendChild(cell);
            cells.push(cell);
        }
    }

    function handleCellClick(index) {
        if (sealedCells.has(index)) {
            sealedCells.delete(index);
        } else if (sealedCells.size < WondrousTailsProbability.MAX_SEALS) {
            sealedCells.add(index);
        }

        updateUI();
        updateCalculations();
        saveState();
    }

    function handleReset() {
        sealedCells.clear();
        updateUI();
        updateCalculations();
        saveState();
    }

    function updateUI() {
        const sealCount = sealedCells.size;
        const isMaxReached = sealCount >= WondrousTailsProbability.MAX_SEALS;
        const canShuffle = sealCount >= 3 && sealCount <= 7;

        cells.forEach((cell, index) => {
            const isSealed = sealedCells.has(index);
            cell.classList.toggle('sealed', isSealed);
            cell.classList.toggle('max-reached', isMaxReached && !isSealed);
            cell.setAttribute('aria-pressed', isSealed);
        });

        sealCountEl.textContent = sealCount;

        // Update shuffle status
        const statusDot = shuffleStatusEl.querySelector('.status-dot');
        const statusText = shuffleStatusEl.querySelector('span:last-child');

        if (canShuffle) {
            statusDot.className = 'status-dot available';
            statusText.textContent = '重新貼：可用';
        } else {
            statusDot.className = 'status-dot unavailable';
            if (sealCount < 3) {
                statusText.textContent = `重新貼：需 3+ 印章`;
            } else {
                statusText.textContent = `重新貼：超過 7 印章`;
            }
        }
    }

    function updateCalculations() {
        const currentSeals = Array.from(sealedCells);
        const results = WondrousTailsProbability.calculateProbabilities(currentSeals);
        const baseline = WondrousTailsProbability.getBaselineProbabilities();

        // Highlight completed lines
        cells.forEach((cell, index) => {
            cell.classList.toggle('in-line', results.cellsInLines.has(index));
        });

        // Update stats display
        currentLinesEl.textContent = results.currentLines;
        potentialLinesEl.textContent = results.potentialLines;

        // Update probability display
        prob0El.textContent = formatPercent(results.probabilities.zeroLines);
        prob1El.textContent = formatPercent(results.probabilities.oneLine);
        prob2El.textContent = formatPercent(results.probabilities.twoLines);
        prob3El.textContent = formatPercent(results.probabilities.threeLines);

        // Update baseline display
        baseline0El.textContent = formatPercent(baseline.zeroLines);
        baseline1El.textContent = formatPercent(baseline.oneLine);
        baseline2El.textContent = formatPercent(baseline.twoLines);
        baseline3El.textContent = formatPercent(baseline.threeLines);

        // Update decision card
        updateDecisionCard(results);
    }

    function updateDecisionCard(results) {
        const recommendation = WondrousTailsProbability.getShuffleRecommendation(
            results.currentLines,
            results.potentialLines,
            results.sealCount,
            results.probabilities,
            currentStrategy
        );

        decisionCard.className = 'decision-card';

        // No seals yet
        if (results.sealCount === 0) {
            decisionIcon.textContent = '📋';
            decisionTitle.textContent = '請放置印章';
            decisionDesc.textContent = '在下方格子中標記你目前天書上的印章位置';
            decisionDetails.innerHTML = '';
            return;
        }

        // Set card style based on recommendation
        switch (recommendation.recommendation) {
            case 'shuffle':
                decisionCard.classList.add('recommend-shuffle');
                decisionIcon.textContent = '🔄';
                break;
            case 'keep':
                if (results.currentLines >= 1) {
                    decisionCard.classList.add('has-lines');
                    decisionIcon.textContent = results.currentLines >= 3 ? '🎉' : '✨';
                } else {
                    decisionCard.classList.add('recommend-keep');
                    decisionIcon.textContent = '🌟';
                }
                break;
            case 'maybe':
                decisionCard.classList.add('recommend-maybe');
                decisionIcon.textContent = '🤔';
                break;
            case 'wait':
                decisionCard.classList.add('recommend-wait');
                decisionIcon.textContent = '⏳';
                break;
            case 'none':
                decisionCard.classList.add('unavailable');
                decisionIcon.textContent = '🎲';
                break;
        }

        decisionTitle.textContent = recommendation.message;
        decisionDesc.textContent = recommendation.detail;

        // Show additional context
        let detailsHtml = '';

        if (results.sealCount >= 3 && results.sealCount <= 7) {
            detailsHtml += `<div class="decision-stats">`;
            detailsHtml += `<span class="stat">目前連線: <strong>${results.currentLines}</strong></span>`;
            detailsHtml += `<span class="stat">潛在連線: <strong>${results.potentialLines}</strong></span>`;
            detailsHtml += `</div>`;
        }

        if (results.sealCount === 7) {
            detailsHtml += `<div class="decision-point-badge">⭐ 最佳決策點</div>`;
        }

        decisionDetails.innerHTML = detailsHtml;
    }

    function formatPercent(value) {
        if (value === 0) return '0%';
        if (value === 100) return '100%';
        if (value < 0.1 && value > 0) return '<0.1%';
        if (value < 1) return value.toFixed(2) + '%';
        return value.toFixed(1) + '%';
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                sealedCells: Array.from(sealedCells),
                strategy: currentStrategy,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to save state:', e);
        }
    }

    function loadState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const state = JSON.parse(saved);
                if (state.sealedCells && Array.isArray(state.sealedCells)) {
                    sealedCells = new Set(state.sealedCells.filter(
                        i => i >= 0 && i < WondrousTailsProbability.TOTAL_CELLS
                    ));
                    updateUI();
                }
                if (state.strategy) {
                    currentStrategy = state.strategy;
                    strategyBtns.forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.strategy === currentStrategy);
                    });
                    updateStrategyDesc();
                }
            }
        } catch (e) {
            console.warn('Failed to load state:', e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
