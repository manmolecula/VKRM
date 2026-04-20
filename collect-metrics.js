/**
 * collect-metrics.js - Автоматизированный сбор метрик для магистерской работы
 * Сравнивает подходы Vue 2 (Options API) и Vue 3 (Composition API + Composables)
 *
 * Метрики:
 * 1. LOC (Lines of Code) - объем кода
 * 2. Cyclomatic Complexity - цикломатическая сложность
 * 3. DCR (Dependency Coupling Ratio) - коэффициент связанности зависимостей
 * 4. TI (Testability Index) - индекс тестируемости
 * 5. SoCS (Separation of Concerns Score) - показатель разделения ответственности
 * 6. Function Length - средняя длина функций
 * 7. State Properties - количество свойств состояния
 * 8. Imports Count - количество импортов (показатель модульности)
 */

const fs = require('fs');
const path = require('path');

// Конфигурация путей
const PATHS = {
    vue2Multi: './src/MultiComponent.vue',
    vue2Single: './src/SingleComponent.vue',
    vue3Multi: './src/MigratedMultiComponent/MigratedMultiComponent.vue',
    vue3Single: './src/MigratedSingleComponent/MigratedSingleComponent.vue',
    vue3MultiComposable: './src/MigratedMultiComponent/composables/useMigratedMultiComponentLogic.js',
    vue3SingleComposable: './src/MigratedSingleComponent/composables/useMigratedSingleComponentLogic.js',
    testsDir: './tests'
};

// Утилиты для анализа кода
class CodeAnalyzer {

    // Читать файл
    static readFile(filePath) {
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️  Файл не найден: ${filePath}`);
            return null;
        }
        return fs.readFileSync(filePath, 'utf-8');
    }

    // Подсчет строк кода (без пустых и комментариев)
    static countLOC(content) {
        if (!content) return 0;
        const lines = content.split('\n');
        return lines.filter(line => {
            const trimmed = line.trim();
            return trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('*');
        }).length;
    }

    // Подсчет цикломатической сложности
    static calculateCyclomaticComplexity(content) {
        if (!content) return 0;

        // Точки принятия решений: if, else if, for, while, case, catch, &&, ||, ?
        const decisionPoints = [
            /\bif\s*\(/g,
            /\belse\s+if\s*\(/g,
            /\bfor\s*\(/g,
            /\bwhile\s*\(/g,
            /\bcase\s+/g,
            /\bcatch\s*\(/g,
            /\&\&/g,
            /\|\|/g,
            /\?[\s\S]*?:/g  // тернарный оператор
        ];

        let complexity = 1; // Базовая сложность

        decisionPoints.forEach(regex => {
            const matches = content.match(regex);
            if (matches) {
                complexity += matches.length;
            }
        });

        return complexity;
    }

    // Подсчет импортов
    static countImports(content) {
        if (!content) return 0;
        const importMatches = content.match(/^import\s+.+from\s+['"].+['"]/gm);
        return importMatches ? importMatches.length : 0;
    }

    // Подсчет функций и их средней длины
    static analyzeFunctions(content) {
        if (!content) return { count: 0, avgLength: 0, totalLength: 0 };

        // Для JS: function, arrow functions, methods в объектах
        const functionRegex = /(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>|\w+\s*\([^)]*\)\s*\{)/g;
        const matches = [...content.matchAll(functionRegex)];

        if (matches.length === 0) {
            return { count: 0, avgLength: 0, totalLength: 0 };
        }

        let totalLength = 0;
        const lines = content.split('\n');

        // Простой эвристический подсчет: делим общий LOC на количество функций
        const loc = this.countLOC(content);
        totalLength = loc;

        return {
            count: matches.length,
            avgLength: Math.round(loc / matches.length),
            totalLength: loc
        };
    }

    // Подсчет ассертов в тестах (expect, assert, toBe, toEqual, etc.)
    static countAssertions(content) {
        if (!content) return 0;

        // Считаем expect().matcher() паттерны
        const expectMatches = content.match(/expect\s*\([^)]+\)\s*\.\s*\w+/g);
        const toBeMatches = content.match(/\.toBe\s*\(/g);
        const toEqualMatches = content.match(/\.toEqual\s*\(/g);
        const toContainMatches = content.match(/\.toContain\s*\(/g);
        const toThrowMatches = content.match(/\.toThrow\s*\(/g);
        const toBeTruthyMatches = content.match(/\.toBeTruthy\s*\(/g);
        const toBeFalsyMatches = content.match(/\.toBeFalsy\s*\(/g);
        const toBeNullMatches = content.match(/\.toBeNull\s*\(/g);
        const toBeUndefinedMatches = content.match(/\.toBeUndefined\s*\(/g);
        const toHaveLengthMatches = content.match(/\.toHaveLength\s*\(/g);
        const toHavePropertyMatches = content.match(/\.toHaveProperty\s*\(/g);
        const toMatchMatches = content.match(/\.toMatch\s*\(/g);

        // Суммируем все ассерты (expect уже включает matcher, но считаем отдельно для надежности)
        const allMatchers = [
            ...(toBeMatches || []),
            ...(toEqualMatches || []),
            ...(toContainMatches || []),
            ...(toThrowMatches || []),
            ...(toBeTruthyMatches || []),
            ...(toBeFalsyMatches || []),
            ...(toBeNullMatches || []),
            ...(toBeUndefinedMatches || []),
            ...(toHaveLengthMatches || []),
            ...(toHavePropertyMatches || []),
            ...(toMatchMatches || [])
        ];

        return allMatchers.length;
    }

    // Подсчет свойств состояния (data properties в Vue 2, ref/reactive в Vue 3)
    static countStateProperties(content, isVue2 = false) {
        if (!content) return 0;

        if (isVue2) {
            // Ищем свойства в data()
            const dataMatch = content.match(/data\s*\(\s*\)\s*\{[\s\S]*?return\s*\{([\s\S]*?)\}/m);
            if (dataMatch) {
                const dataContent = dataMatch[1];
                const props = dataContent.match(/\w+\s*:/g);
                return props ? props.length : 0;
            }
            return 0;
        } else {
            // Ищем ref, reactive, shallowRef
            const refMatches = content.match(/(?:ref|reactive|shallowRef|computed)\s*\(/g);
            return refMatches ? refMatches.length : 0;
        }
    }

    // Анализ разделенности ответственности (Separation of Concerns)
    static analyzeSeparationOfConcerns(vueContent, composableContent) {
        if (!vueContent || !composableContent) {
            return { uiLogic: 0, businessLogic: 0, separationScore: 0 };
        }

        // В Vue 3 шаблоне должна быть только UI логика
        const templateMatch = vueContent.match(/<template>([\s\S]*)<\/template>/);
        const templateContent = templateMatch ? templateMatch[1] : '';

        // Считаем строки бизнес-логики в composables
        const composableLOC = this.countLOC(composableContent);

        // Считаем строки в script секции Vue компонента
        const scriptMatch = vueContent.match(/<script>([\s\S]*)<\/script>/);
        const scriptContent = scriptMatch ? scriptMatch[1] : '';
        const scriptLOC = this.countLOC(scriptContent);

        // Separation Score = (логика в composables) / (вся логика) * 100
        const totalLogic = composableLOC + scriptLOC;
        const separationScore = totalLogic > 0 ? Math.round((composableLOC / totalLogic) * 100) : 0;

        return {
            uiLogic: scriptLOC,
            businessLogic: composableLOC,
            separationScore
        };
    }

    // Анализ тестов
    static analyzeTests(testsDir) {
        if (!fs.existsSync(testsDir)) {
            return { testFiles: 0, totalTests: 0, testLOC: 0, assertionsCount: 0 };
        }

        const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.js') || f.endsWith('.spec.js'));

        let totalTests = 0;
        let testLOC = 0;
        let assertionsCount = 0;

        files.forEach(file => {
            const content = fs.readFileSync(path.join(testsDir, file), 'utf-8');
            testLOC += this.countLOC(content);

            // Считаем тесты (it, test, describe)
            const testMatches = content.match(/\b(it|test)\s*\(/g);
            if (testMatches) {
                totalTests += testMatches.length;
            }

            // Считаем ассерты через новый метод
            assertionsCount += this.countAssertions(content);
        });

        return {
            testFiles: files.length,
            totalTests,
            testLOC,
            assertionsCount
        };
    }
}

// Расчет комплексных метрик
class MetricsCalculator {

    // DCR (Dependency Coupling Ratio)
    // Чем меньше, тем лучше (меньше связанность)
    // DCR = (imports + vuexMappings) / stateProperties
    static calculateDCR(content, isVue2 = false) {
        const imports = CodeAnalyzer.countImports(content);
        const stateProps = CodeAnalyzer.countStateProperties(content, isVue2);

        // Для Vue 2 добавляем mapState, mapActions как дополнительную связанность
        let vuexCoupling = 0;
        if (isVue2) {
            const mapStateMatches = content.match(/mapState/g);
            const mapActionsMatches = content.match(/mapActions/g);
            const mapMutationsMatches = content.match(/mapMutations/g);
            const mapGettersMatches = content.match(/mapGetters/g);

            vuexCoupling = (mapStateMatches?.length || 0) +
                          (mapActionsMatches?.length || 0) +
                          (mapMutationsMatches?.length || 0) +
                          (mapGettersMatches?.length || 0);
        }

        const totalCoupling = imports + vuexCoupling;
        return stateProps > 0 ? (totalCoupling / stateProps).toFixed(2) : totalCoupling;
    }

    // TI (Testability Index)
    // TI = assertions / (complexity * LOC)
    // Чем больше, тем лучше тестируемость
    static calculateTI(testMetrics, codeMetrics) {
        const { assertionsCount } = testMetrics;
        const { complexity, loc } = codeMetrics;

        if (complexity === 0 || loc === 0) return 0;

        // Нормализуем: умножаем на 1000 для удобства чтения
        const ti = (assertionsCount / (complexity * loc)) * 1000;
        return ti.toFixed(2);
    }

    // SoCS (Separation of Concerns Score)
    // Процент логики, вынесенной в composables
    static calculateSoCS(separationData) {
        return separationData.separationScore;
    }
}

// Основная функция сбора метрик
function collectMetrics() {
    console.log('\n🔍 Сбор метрик для магистерской работы...\n');
    console.log('=' .repeat(80));

    // Чтение файлов
    const files = {
        vue2Multi: CodeAnalyzer.readFile(PATHS.vue2Multi),
        vue2Single: CodeAnalyzer.readFile(PATHS.vue2Single),
        vue3Multi: CodeAnalyzer.readFile(PATHS.vue3Multi),
        vue3Single: CodeAnalyzer.readFile(PATHS.vue3Single),
        vue3MultiComposable: CodeAnalyzer.readFile(PATHS.vue3MultiComposable),
        vue3SingleComposable: CodeAnalyzer.readFile(PATHS.vue3SingleComposable)
    };

    // Анализ тестов
    const testMetrics = CodeAnalyzer.analyzeTests(PATHS.testsDir);

    // Базовые метрики для каждого подхода
    const metrics = {
        vue2: {
            multi: {},
            single: {},
            totals: {}
        },
        vue3: {
            multi: {},
            single: {},
            totals: {}
        }
    };

    // === Vue 2 Multi Component ===
    if (files.vue2Multi) {
        metrics.vue2.multi = {
            loc: CodeAnalyzer.countLOC(files.vue2Multi),
            complexity: CodeAnalyzer.calculateCyclomaticComplexity(files.vue2Multi),
            imports: CodeAnalyzer.countImports(files.vue2Multi),
            stateProps: CodeAnalyzer.countStateProperties(files.vue2Multi, true),
            functions: CodeAnalyzer.analyzeFunctions(files.vue2Multi),
            dcr: MetricsCalculator.calculateDCR(files.vue2Multi, true)
        };
    }

    // === Vue 2 Single Component ===
    if (files.vue2Single) {
        metrics.vue2.single = {
            loc: CodeAnalyzer.countLOC(files.vue2Single),
            complexity: CodeAnalyzer.calculateCyclomaticComplexity(files.vue2Single),
            imports: CodeAnalyzer.countImports(files.vue2Single),
            stateProps: CodeAnalyzer.countStateProperties(files.vue2Single, true),
            functions: CodeAnalyzer.analyzeFunctions(files.vue2Single),
            dcr: MetricsCalculator.calculateDCR(files.vue2Single, true)
        };
    }

    // === Vue 3 Migrated Multi Component (Vue + Composable) ===
    if (files.vue3Multi && files.vue3MultiComposable) {
        const vueLoc = CodeAnalyzer.countLOC(files.vue3Multi);
        const composableLoc = CodeAnalyzer.countLOC(files.vue3MultiComposable);
        const vueComplexity = CodeAnalyzer.calculateCyclomaticComplexity(files.vue3Multi);
        const composableComplexity = CodeAnalyzer.calculateCyclomaticComplexity(files.vue3MultiComposable);

        const separationData = CodeAnalyzer.analyzeSeparationOfConcerns(files.vue3Multi, files.vue3MultiComposable);

        metrics.vue3.multi = {
            loc: vueLoc + composableLoc,
            locBreakdown: { vue: vueLoc, composable: composableLoc },
            complexity: vueComplexity + composableComplexity,
            complexityBreakdown: { vue: vueComplexity, composable: composableComplexity },
            imports: CodeAnalyzer.countImports(files.vue3Multi) + CodeAnalyzer.countImports(files.vue3MultiComposable),
            stateProps: CodeAnalyzer.countStateProperties(files.vue3MultiComposable, false),
            functions: CodeAnalyzer.analyzeFunctions(files.vue3MultiComposable),
            dcr: MetricsCalculator.calculateDCR(files.vue3MultiComposable, false),
            socs: MetricsCalculator.calculateSoCS(separationData),
            separation: separationData
        };
    }

    // === Vue 3 Migrated Single Component (Vue + Composable) ===
    if (files.vue3Single && files.vue3SingleComposable) {
        const vueLoc = CodeAnalyzer.countLOC(files.vue3Single);
        const composableLoc = CodeAnalyzer.countLOC(files.vue3SingleComposable);
        const vueComplexity = CodeAnalyzer.calculateCyclomaticComplexity(files.vue3Single);
        const composableComplexity = CodeAnalyzer.calculateCyclomaticComplexity(files.vue3SingleComposable);

        const separationData = CodeAnalyzer.analyzeSeparationOfConcerns(files.vue3Single, files.vue3SingleComposable);

        metrics.vue3.single = {
            loc: vueLoc + composableLoc,
            locBreakdown: { vue: vueLoc, composable: composableLoc },
            complexity: vueComplexity + composableComplexity,
            complexityBreakdown: { vue: vueComplexity, composable: composableComplexity },
            imports: CodeAnalyzer.countImports(files.vue3Single) + CodeAnalyzer.countImports(files.vue3SingleComposable),
            stateProps: CodeAnalyzer.countStateProperties(files.vue3SingleComposable, false),
            functions: CodeAnalyzer.analyzeFunctions(files.vue3SingleComposable),
            dcr: MetricsCalculator.calculateDCR(files.vue3SingleComposable, false),
            socs: MetricsCalculator.calculateSoCS(separationData),
            separation: separationData
        };
    }

    // === Расчет итоговых значений ===
    metrics.vue2.totals = {
        loc: (metrics.vue2.multi.loc || 0) + (metrics.vue2.single.loc || 0),
        complexity: (metrics.vue2.multi.complexity || 0) + (metrics.vue2.single.complexity || 0),
        avgDcr: ((parseFloat(metrics.vue2.multi.dcr) || 0) + (parseFloat(metrics.vue2.single.dcr) || 0) / 2).toFixed(2)
    };

    metrics.vue3.totals = {
        loc: (metrics.vue3.multi.loc || 0) + (metrics.vue3.single.loc || 0),
        complexity: (metrics.vue3.multi.complexity || 0) + (metrics.vue3.single.complexity || 0),
        avgDcr: ((parseFloat(metrics.vue3.multi.dcr) || 0) + (parseFloat(metrics.vue3.single.dcr) || 0) / 2).toFixed(2),
        avgSocs: Math.round(((metrics.vue3.multi.socs || 0) + (metrics.vue3.single.socs || 0)) / 2)
    };

    // === Вывод результатов ===
    console.log('\n📊 БАЗОВЫЕ МЕТРИКИ КОДА\n');
    console.log('-'.repeat(80));
    console.log('Метрика                    | Vue 2 Multi | Vue 2 Single | Vue 3 Multi | Vue 3 Single');
    console.log('-'.repeat(80));
    console.log(`LOC (строк кода)           | ${String(metrics.vue2.multi.loc || 0).padStart(11)} | ${String(metrics.vue2.single.loc || 0).padStart(12)} | ${String(metrics.vue3.multi.loc || 0).padStart(11)} | ${String(metrics.vue3.single.loc || 0).padStart(12)}`);
    console.log(`Цикломатическая сложность  | ${String(metrics.vue2.multi.complexity || 0).padStart(11)} | ${String(metrics.vue2.single.complexity || 0).padStart(12)} | ${String(metrics.vue3.multi.complexity || 0).padStart(11)} | ${String(metrics.vue3.single.complexity || 0).padStart(12)}`);
    console.log(`Количество импортов        | ${String(metrics.vue2.multi.imports || 0).padStart(11)} | ${String(metrics.vue2.single.imports || 0).padStart(12)} | ${String(metrics.vue3.multi.imports || 0).padStart(11)} | ${String(metrics.vue3.single.imports || 0).padStart(12)}`);
    console.log(`Свойства состояния         | ${String(metrics.vue2.multi.stateProps || 0).padStart(11)} | ${String(metrics.vue2.single.stateProps || 0).padStart(12)} | ${String(metrics.vue3.multi.stateProps || 0).padStart(11)} | ${String(metrics.vue3.single.stateProps || 0).padStart(12)}`);
    console.log(`Функций                    | ${String(metrics.vue2.multi.functions.count || 0).padStart(11)} | ${String(metrics.vue2.single.functions.count || 0).padStart(12)} | ${String(metrics.vue3.multi.functions.count || 0).padStart(11)} | ${String(metrics.vue3.single.functions.count || 0).padStart(12)}`);
    console.log(`Ср. длина функции (строки) | ${String(metrics.vue2.multi.functions.avgLength || 0).padStart(11)} | ${String(metrics.vue2.single.functions.avgLength || 0).padStart(12)} | ${String(metrics.vue3.multi.functions.avgLength || 0).padStart(11)} | ${String(metrics.vue3.single.functions.avgLength || 0).padStart(12)}`);

    console.log('\n📈 КОМПЛЕКСНЫЕ МЕТРИКИ КАЧЕСТВА\n');
    console.log('-'.repeat(80));
    console.log('Метрика                    | Vue 2 Multi | Vue 2 Single | Vue 3 Multi | Vue 3 Single | Улучшение');
    console.log('-'.repeat(80));

    const dcrMultiImprovement = metrics.vue2.multi.dcr && metrics.vue3.multi.dcr
        ? (parseFloat(metrics.vue2.multi.dcr) / parseFloat(metrics.vue3.multi.dcr)).toFixed(2)
        : '-';
    const dcrSingleImprovement = metrics.vue2.single.dcr && metrics.vue3.single.dcr
        ? (parseFloat(metrics.vue2.single.dcr) / parseFloat(metrics.vue3.single.dcr)).toFixed(2)
        : '-';

    console.log(`DCR (связанность) ↓        | ${String(metrics.vue2.multi.dcr || 0).padStart(11)} | ${String(metrics.vue2.single.dcr || 0).padStart(12)} | ${String(metrics.vue3.multi.dcr || 0).padStart(11)} | ${String(metrics.vue3.single.dcr || 0).padStart(12)} | ${dcrMultiImprovement}x / ${dcrSingleImprovement}x`);

    console.log(`SoCS (разделение) ↑ %      | ${String(0).padStart(11)} | ${String(0).padStart(12)} | ${String(metrics.vue3.multi.socs || 0).padStart(11)} | ${String(metrics.vue3.single.socs || 0).padStart(12)} | +${metrics.vue3.multi.socs || 0}% / +${metrics.vue3.single.socs || 0}%`);

    // Расчет TI для всех тестов вместе
    const totalVue2Loc = metrics.vue2.totals.loc;
    const totalVue2Complexity = metrics.vue2.totals.complexity;
    const tiVue2 = MetricsCalculator.calculateTI(testMetrics, { loc: totalVue2Loc, complexity: totalVue2Complexity });

    const totalVue3Loc = metrics.vue3.totals.loc;
    const totalVue3Complexity = metrics.vue3.totals.complexity;
    const tiVue3 = MetricsCalculator.calculateTI(testMetrics, { loc: totalVue3Loc, complexity: totalVue3Complexity });

    const tiImprovement = tiVue2 && tiVue3 && parseFloat(tiVue2) > 0
        ? (parseFloat(tiVue3) / parseFloat(tiVue2)).toFixed(2)
        : '-';

    console.log(`TI (тестируемость) ↑       | ${String(tiVue2).padStart(11)} | ${String(tiVue2).padStart(12)} | ${String(tiVue3).padStart(11)} | ${String(tiVue3).padStart(12)} | ${tiImprovement}x`);

    console.log('\n🧪 МЕТРИКИ ТЕСТИРОВАНИЯ\n');
    console.log('-'.repeat(80));
    console.log(`Тест-файлов: ${testMetrics.testFiles}`);
    console.log(`Всего тестов: ${testMetrics.totalTests}`);
    console.log(`LOC тестов: ${testMetrics.testLOC}`);
    console.log(`Ассертов: ${testMetrics.assertionsCount}`);
    console.log(`Плотность тестов (тестов на 100 строк кода): ${(testMetrics.totalTests / (totalVue2Loc / 100)).toFixed(1)}`);

    console.log('\n💡 ДЕТАЛИЗАЦИЯ РАЗДЕЛЕНИЯ ОТВЕТСТВЕННОСТИ (Vue 3)\n');
    console.log('-'.repeat(80));
    console.log('Компонент                  | UI логика | Бизнес-логика | SoCS %');
    console.log('-'.repeat(80));
    if (metrics.vue3.multi.separation) {
        console.log(`Multi Component            | ${String(metrics.vue3.multi.separation.uiLogic).padStart(9)} | ${String(metrics.vue3.multi.separation.businessLogic).padStart(13)} | ${metrics.vue3.multi.socs}%`);
    }
    if (metrics.vue3.single.separation) {
        console.log(`Single Component           | ${String(metrics.vue3.single.separation.uiLogic).padStart(9)} | ${String(metrics.vue3.single.separation.businessLogic).padStart(13)} | ${metrics.vue3.single.socs}%`);
    }

    console.log('\n📋 СВОДНАЯ ТАБЛИЦА УЛУЧШЕНИЙ\n');
    console.log('=' .repeat(80));
    console.log('Метрика                           | Vue 2 (среднее) | Vue 3 (среднее) | Улучшение');
    console.log('-'.repeat(80));

    const avgVue2Dcr = ((parseFloat(metrics.vue2.multi.dcr) || 0) + (parseFloat(metrics.vue2.single.dcr) || 0)) / 2;
    const avgVue3Dcr = ((parseFloat(metrics.vue3.multi.dcr) || 0) + (parseFloat(metrics.vue3.single.dcr) || 0)) / 2;
    const dcrImprovement = avgVue3Dcr > 0 ? (avgVue2Dcr / avgVue3Dcr).toFixed(2) : '-';

    const avgVue2Loc = (metrics.vue2.multi.loc + metrics.vue2.single.loc) / 2;
    const avgVue3Loc = (metrics.vue3.multi.loc + metrics.vue3.single.loc) / 2;
    const locChange = ((avgVue3Loc - avgVue2Loc) / avgVue2Loc * 100).toFixed(1);

    const avgVue2Complexity = (metrics.vue2.multi.complexity + metrics.vue2.single.complexity) / 2;
    const avgVue3Complexity = (metrics.vue3.multi.complexity + metrics.vue3.single.complexity) / 2;
    const complexityChange = ((avgVue3Complexity - avgVue2Complexity) / avgVue2Complexity * 100).toFixed(1);

    const avgSocs = metrics.vue3.totals.avgSocs;

    console.log(`DCR (связанность зависимостей) ↓  | ${avgVue2Dcr.toFixed(2).padStart(15)} | ${avgVue3Dcr.toFixed(2).padStart(15)} | в ${dcrImprovement} раза`);
    console.log(`SoCS (разделение ответственности)↑| ${String(0).padStart(15)}% | ${String(avgSocs).padStart(15)}% | +${avgSocs} процентных пунктов`);
    console.log(`TI (индекс тестируемости) ↑       | ${String(tiVue2).padStart(15)} | ${String(tiVue3).padStart(15)} | в ${tiImprovement} раза`);
    console.log(`Средний LOC на компонент ±        | ${Math.round(avgVue2Loc).toString().padStart(15)} | ${Math.round(avgVue3Loc).toString().padStart(15)} | ${locChange > 0 ? '+' : ''}${locChange}%`);
    console.log(`Средняя сложность ±               | ${Math.round(avgVue2Complexity).toString().padStart(15)} | ${Math.round(avgVue3Complexity).toString().padStart(15)} | ${complexityChange > 0 ? '+' : ''}${complexityChange}%`);

    console.log('\n' + '=' .repeat(80));
    console.log('✅ Сбор метрик завершен!\n');

    // Возвращаем данные для программного использования
    return {
        metrics,
        testMetrics,
        improvements: {
            dcr: dcrImprovement,
            socs: avgSocs,
            ti: tiImprovement,
            locChange,
            complexityChange
        }
    };
}

// Запуск при прямом вызове
if (require.main === module) {
    collectMetrics();
}

module.exports = { collectMetrics, CodeAnalyzer, MetricsCalculator };