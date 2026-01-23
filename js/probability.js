/**
 * Wondrous Tails Probability Calculator
 * 天書奇談機率計算模組
 *
 * 基於社群研究的最佳策略：
 * - 在 7 個印章時決定是否使用重新貼
 * - 根據「目前連線數」和「潛在連線數」判斷
 *
 * 潛在連線 = 如果剩餘印章以最佳方式放置，最多能完成的連線數
 */

const WondrousTailsProbability = (function() {
    // 10 possible lines (4 horizontal + 4 vertical + 2 diagonal)
    const LINES = [
        [0, 1, 2, 3],       // Row 1
        [4, 5, 6, 7],       // Row 2
        [8, 9, 10, 11],     // Row 3
        [12, 13, 14, 15],   // Row 4
        [0, 4, 8, 12],      // Column 1
        [1, 5, 9, 13],      // Column 2
        [2, 6, 10, 14],     // Column 3
        [3, 7, 11, 15],     // Column 4
        [0, 5, 10, 15],     // Diagonal 1
        [3, 6, 9, 12],      // Diagonal 2
    ];

    const MAX_SEALS = 9;
    const TOTAL_CELLS = 16;
    const DECISION_POINT = 7; // The optimal point to decide on shuffle

    /**
     * Count completed lines for a given seal configuration
     */
    function countLines(sealedCells) {
        let lineCount = 0;
        for (const line of LINES) {
            if (line.every(cell => sealedCells.has(cell))) {
                lineCount++;
            }
        }
        return lineCount;
    }

    /**
     * Get all cells that are part of completed lines
     */
    function getCellsInCompletedLines(sealedCells) {
        const cellsInLines = new Set();
        for (const line of LINES) {
            if (line.every(cell => sealedCells.has(cell))) {
                line.forEach(cell => cellsInLines.add(cell));
            }
        }
        return cellsInLines;
    }

    /**
     * Generate all combinations of k elements from array
     */
    function* generateCombinations(array, k) {
        if (k === 0) {
            yield [];
            return;
        }
        if (array.length < k) return;

        const [first, ...rest] = array;
        for (const combo of generateCombinations(rest, k - 1)) {
            yield [first, ...combo];
        }
        yield* generateCombinations(rest, k);
    }

    /**
     * Calculate the maximum potential lines achievable
     * This is the maximum number of lines that could be completed
     * if the remaining stickers were placed optimally
     *
     * @param {Set<number>} currentSeals - Currently placed seals
     * @param {number} remainingSeals - Number of seals left to place
     * @returns {number} Maximum potential lines
     */
    function calculatePotentialLines(currentSeals, remainingSeals) {
        if (remainingSeals <= 0) {
            return countLines(currentSeals);
        }

        // Get empty cells
        const emptyCells = [];
        for (let i = 0; i < TOTAL_CELLS; i++) {
            if (!currentSeals.has(i)) {
                emptyCells.push(i);
            }
        }

        let maxLines = 0;

        // Try all possible placements of remaining seals
        for (const additionalSeals of generateCombinations(emptyCells, remainingSeals)) {
            const finalSet = new Set([...currentSeals, ...additionalSeals]);
            const lineCount = countLines(finalSet);
            if (lineCount > maxLines) {
                maxLines = lineCount;
            }
        }

        return maxLines;
    }

    /**
     * Calculate detailed probabilities for each line count
     */
    function calculateDetailedProbabilities(currentSeals, remainingSeals) {
        if (remainingSeals <= 0) {
            const lines = countLines(currentSeals);
            return {
                zeroLines: lines === 0 ? 100 : 0,
                oneLine: lines === 1 ? 100 : 0,
                twoLines: lines === 2 ? 100 : 0,
                threeLines: lines >= 3 ? 100 : 0,
                onePlus: lines >= 1 ? 100 : 0,
                twoPlus: lines >= 2 ? 100 : 0
            };
        }

        const emptyCells = [];
        for (let i = 0; i < TOTAL_CELLS; i++) {
            if (!currentSeals.has(i)) {
                emptyCells.push(i);
            }
        }

        let counts = { 0: 0, 1: 0, 2: 0, 3: 0 };
        let total = 0;

        for (const additionalSeals of generateCombinations(emptyCells, remainingSeals)) {
            const finalSet = new Set([...currentSeals, ...additionalSeals]);
            const lineCount = Math.min(countLines(finalSet), 3);
            counts[lineCount]++;
            total++;
        }

        return {
            zeroLines: (counts[0] / total) * 100,
            oneLine: (counts[1] / total) * 100,
            twoLines: (counts[2] / total) * 100,
            threeLines: (counts[3] / total) * 100,
            onePlus: ((counts[1] + counts[2] + counts[3]) / total) * 100,
            twoPlus: ((counts[2] + counts[3]) / total) * 100
        };
    }

    /**
     * Main calculation function
     */
    function calculateProbabilities(currentSealsArray) {
        const currentSeals = new Set(currentSealsArray);
        const sealCount = currentSealsArray.length;
        const remainingSeals = MAX_SEALS - sealCount;
        const remainingToDecision = DECISION_POINT - sealCount;

        // Current state
        const currentLines = countLines(currentSeals);
        const cellsInLines = getCellsInCompletedLines(currentSeals);

        // Calculate potential lines (max possible with optimal remaining placements)
        const potentialLines = calculatePotentialLines(currentSeals, remainingSeals);

        // Calculate probabilities for final state
        const probabilities = calculateDetailedProbabilities(currentSeals, remainingSeals);

        return {
            sealCount,
            remainingSeals,
            currentLines,
            potentialLines,
            cellsInLines,
            probabilities,
            isAtDecisionPoint: sealCount === DECISION_POINT,
            canShuffle: sealCount >= 3 && sealCount <= 7
        };
    }

    /**
     * Baseline probabilities (from a completely random journal)
     * These are the expected probabilities after shuffle
     */
    const BASELINE_PROBABILITIES = {
        zeroLines: 41.54,
        oneLine: 47.90,
        twoLines: 10.35,
        threeLines: 0.21,
        onePlus: 58.46,
        twoPlus: 10.56
    };

    /**
     * Get shuffle recommendation based on strategy
     *
     * Strategies:
     * - 'potential': Potential Lines method (default, based on community research)
     * - 'one': Maximize 1+ line probability
     * - 'two': Maximize 2+ lines probability
     * - 'three': Maximize 3 lines probability
     */
    function getShuffleRecommendation(currentLines, potentialLines, sealCount, probabilities, strategy = 'potential') {
        // Not at decision point
        if (sealCount < 3) {
            return {
                recommendation: 'wait',
                reason: 'tooFewSeals',
                confidence: 'high',
                message: '繼續完成任務，獲得更多印章',
                detail: `還需要 ${3 - sealCount} 個印章才能使用重新貼`
            };
        }

        if (sealCount > 7) {
            return {
                recommendation: 'none',
                reason: 'tooManySeals',
                confidence: 'high',
                message: '已無法使用重新貼',
                detail: '印章超過 7 個，只能等待最終結果'
            };
        }

        // Strategy-based recommendations
        if (strategy === 'one') {
            return getOnePlusRecommendation(currentLines, probabilities);
        } else if (strategy === 'two') {
            return getTwoPlusRecommendation(currentLines, probabilities);
        } else if (strategy === 'three') {
            return getThreeRecommendation(currentLines, probabilities);
        }

        // Default: Potential Lines strategy
        return getPotentialLinesRecommendation(currentLines, potentialLines, sealCount);
    }

    /**
     * Potential Lines strategy (default)
     */
    function getPotentialLinesRecommendation(currentLines, potentialLines, sealCount) {
        // Already have completed lines
        if (currentLines >= 1) {
            return {
                recommendation: 'keep',
                reason: 'hasLines',
                confidence: 'high',
                message: '保留目前的連線',
                detail: `已有 ${currentLines} 條連線，重新貼有 79% 機率變差`
            };
        }

        if (potentialLines === 1) {
            return {
                recommendation: 'shuffle',
                reason: 'lowPotential',
                confidence: 'high',
                message: '建議使用重新貼',
                detail: '目前排列無法達成 2 條線，重新貼有 89% 機率改善'
            };
        }

        if (potentialLines >= 3) {
            return {
                recommendation: 'keep',
                reason: 'highPotential',
                confidence: 'high',
                message: '不要重新貼！',
                detail: `有機會達成 ${potentialLines} 條線，重新貼有 93%+ 機率變差`
            };
        }

        if (sealCount < 7) {
            return {
                recommendation: 'wait',
                reason: 'waitForSeven',
                confidence: 'medium',
                message: '等到 7 個印章再決定',
                detail: `目前潛在 ${potentialLines} 條線，在 7 印章時再評估`
            };
        }

        return {
            recommendation: 'maybe',
            reason: 'averagePotential',
            confidence: 'medium',
            message: '可考慮重新貼',
            detail: '21% 變好、11% 變差、68% 持平'
        };
    }

    /**
     * 1+ line maximum strategy
     */
    function getOnePlusRecommendation(currentLines, probabilities) {
        if (currentLines >= 1) {
            return {
                recommendation: 'keep',
                reason: 'hasLines',
                confidence: 'high',
                message: '已達成目標',
                detail: `已有 ${currentLines} 條連線`
            };
        }

        const current = probabilities.onePlus;
        const baseline = BASELINE_PROBABILITIES.onePlus;
        const diff = baseline - current;

        if (diff > 5) {
            return {
                recommendation: 'shuffle',
                reason: 'betterOdds',
                confidence: 'high',
                message: '建議使用重新貼',
                detail: `1線機率：${current.toFixed(1)}% → 預期 ${baseline.toFixed(1)}%`
            };
        } else if (diff < -5) {
            return {
                recommendation: 'keep',
                reason: 'goodOdds',
                confidence: 'high',
                message: '不要重新貼',
                detail: `目前 1線機率 ${current.toFixed(1)}% 優於平均`
            };
        }

        return {
            recommendation: 'maybe',
            reason: 'similar',
            confidence: 'low',
            message: '差異不大',
            detail: `1線機率：${current.toFixed(1)}%（平均 ${baseline.toFixed(1)}%）`
        };
    }

    /**
     * 2+ lines maximum strategy
     */
    function getTwoPlusRecommendation(currentLines, probabilities) {
        if (currentLines >= 2) {
            return {
                recommendation: 'keep',
                reason: 'hasLines',
                confidence: 'high',
                message: '已達成目標',
                detail: `已有 ${currentLines} 條連線`
            };
        }

        const current = probabilities.twoPlus;
        const baseline = BASELINE_PROBABILITIES.twoPlus;
        const diff = baseline - current;

        if (diff > 2) {
            return {
                recommendation: 'shuffle',
                reason: 'betterOdds',
                confidence: 'high',
                message: '建議使用重新貼',
                detail: `2線機率：${current.toFixed(1)}% → 預期 ${baseline.toFixed(1)}%`
            };
        } else if (diff < -2) {
            return {
                recommendation: 'keep',
                reason: 'goodOdds',
                confidence: 'high',
                message: '不要重新貼',
                detail: `目前 2線機率 ${current.toFixed(1)}% 優於平均`
            };
        }

        return {
            recommendation: 'maybe',
            reason: 'similar',
            confidence: 'low',
            message: '差異不大',
            detail: `2線機率：${current.toFixed(1)}%（平均 ${baseline.toFixed(1)}%）`
        };
    }

    /**
     * 3 lines maximum strategy
     */
    function getThreeRecommendation(currentLines, probabilities) {
        if (currentLines >= 3) {
            return {
                recommendation: 'keep',
                reason: 'hasLines',
                confidence: 'high',
                message: '恭喜達成 3 條線！',
                detail: '已達成最高獎勵'
            };
        }

        const current = probabilities.threeLines;
        const baseline = BASELINE_PROBABILITIES.threeLines;
        const diff = baseline - current;

        if (diff > 0.1) {
            return {
                recommendation: 'shuffle',
                reason: 'betterOdds',
                confidence: 'medium',
                message: '可考慮重新貼',
                detail: `3線機率：${current.toFixed(2)}% → 預期 ${baseline.toFixed(2)}%`
            };
        } else if (current > baseline) {
            return {
                recommendation: 'keep',
                reason: 'goodOdds',
                confidence: 'high',
                message: '不要重新貼',
                detail: `目前 3線機率 ${current.toFixed(2)}% 優於平均`
            };
        }

        return {
            recommendation: 'maybe',
            reason: 'similar',
            confidence: 'low',
            message: '差異不大',
            detail: `3線機率：${current.toFixed(2)}%（平均 ${baseline.toFixed(2)}%）`
        };
    }

    /**
     * Get baseline probabilities (after shuffle)
     */
    function getBaselineProbabilities() {
        return BASELINE_PROBABILITIES;
    }

    // Public API
    return {
        LINES,
        MAX_SEALS,
        TOTAL_CELLS,
        DECISION_POINT,
        countLines,
        getCellsInCompletedLines,
        calculateProbabilities,
        calculatePotentialLines,
        getShuffleRecommendation,
        getBaselineProbabilities
    };
})();
