/**
 * collect-metrics.js - Автоматизированный сбор метрик для магистерской работы
 * Сравнивает подходы Vue 2 (Options API) и Vue 3 (Composition API + Composables)
 *
 * Метрики из README:
 * 1. DCR (Dependency Coupling Ratio) - коэффициент связанности зависимостей в тестах
 * 2. TI (Testability Index) - индекс тестируемости
 * 3. CR (Code Reduction) - показатель сокращения объема кода компонента
 */

const fs = require('fs');
const path = require('path');

const PATHS = {
    vue2Multi: './src/MultiComponent.vue',
    vue2Single: './src/SingleComponent.vue',
    vue3Multi: './src/MigratedMultiComponent/MigratedMultiComponent.vue',
    vue3Single: './src/MigratedSingleComponent/MigratedSingleComponent.vue',
    vue3MultiComposable: './src/MigratedMultiComponent/composables/useMigratedMultiComponentLogic.js',
    vue3SingleComposable: './src/MigratedSingleComponent/composables/useMigratedSingleComponentLogic.js',
    tests: {
        vue2Multi: './tests/MultiComponent.spec.js',
        vue2Single: './tests/SingleComponent.spec.js',
        vue3Multi: './tests/MigratedMultiComponent.spec.js',
        vue3Single: './tests/MigratedSingleComponent.spec.js'
    }
};

class CodeAnalyzer {
    static readFile(filePath) {
        if (!fs.existsSync(filePath)) return null;
        return fs.readFileSync(filePath, 'utf-8');
    }

    static countLOC(content) {
        if (!content) return 0;
        return content.split('\n').filter(line => {
            const t = line.trim();
            return t && !t.startsWith('//') && !t.startsWith('*');
        }).length;
    }

    static countUIStubs(testContent) {
        if (!testContent) return 0;
        const m = testContent.match(/['"]?[A-Z][a-zA-Z]+['"]?\s*:\s*(?:true|false|\{\})/g);
        return m ? m.length : 0;
    }

    static countVuexModules(testContent) {
        if (!testContent) return 0;
        const m = testContent.match(/createStore|vuex|plugins\s*:\s*\[/gi);
        return m ? m.length : 0;
    }

    static countGlobalObjects(testContent) {
        if (!testContent) return 0;
        let count = 0;
        if (testContent.includes('global.window') || testContent.match(/window\s*=/)) {
            const wm = testContent.match(/window\.\w+/g);
            count += wm ? wm.length : 1;
        }
        const mm = testContent.match(/\$\w+:/g);
        if (mm) count += mm.length;
        const dm = testContent.match(/\$[a-zA-Z]+\s*:/g);
        if (dm) count += dm.length;
        return count;
    }

    static countMockFunctions(testContent) {
        if (!testContent) return 0;
        const m = testContent.match(/vi\.fn\(\)/g);
        return m ? m.length : 0;
    }

    static calculateDCR(testContent) {
        if (!testContent) return 0;
        return this.countUIStubs(testContent) +
               this.countVuexModules(testContent) +
               this.countGlobalObjects(testContent) +
               this.countMockFunctions(testContent);
    }

    static countBusinessLogicLines(componentContent, composableContent = null, isVue2 = false) {
        if (!componentContent) return 0;
        if (isVue2) {
            // Извлекаем весь блок script
            const scriptMatch = componentContent.match(/<script>([\s\S]*?)<\/script>/);
            if (!scriptMatch) return 0;
            const scriptContent = scriptMatch[1];

            // Находим начало и конец export default
            const exportStart = scriptContent.indexOf('export default');
            if (exportStart === -1) return 0;

            const afterExport = scriptContent.substring(exportStart);

            // Считаем LOC всего блока export default (включая data, methods, computed, watch)
            // Находим все строки между export default и последующим };
            let braceCount = 0;
            let foundFirstBrace = false;
            let logicLines = [];

            for (const line of afterExport.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('//')) continue;

                // Подсчитываем скобки для определения границ export default
                for (const char of line) {
                    if (char === '{') {
                        braceCount++;
                        foundFirstBrace = true;
                    } else if (char === '}') {
                        braceCount--;
                    }
                }

                // Пропускаем строки с импортами и export default
                if (trimmed.startsWith('import') || trimmed.startsWith('export')) continue;

                // Добавляем строку в логику, если мы внутри export default
                if (foundFirstBrace && braceCount > 0) {
                    logicLines.push(line);
                }

                // Если вышли из export default (braceCount стал 0 после того как был > 0)
                if (foundFirstBrace && braceCount === 0) break;
            }

            return logicLines.length;
        } else {
            return composableContent ? this.countLOC(composableContent) : 0;
        }
    }

    static countTestLines(testContent) {
        if (!testContent) return 0;
        let count = 0, inDescribe = false;
        for (const line of testContent.split('\n')) {
            const t = line.trim();
            if (t.startsWith('import') || !t) continue;
            if (t.startsWith('describe')) { inDescribe = true; continue; }
            if (t.startsWith('it(') || t.startsWith('test(')) count++;
            if (inDescribe && t && !t.startsWith('describe')) count++;
        }
        return count;
    }

    static countInfrastructureLines(testContent) {
        if (!testContent) return 0;
        let count = 0;
        for (const line of testContent.split('\n')) {
            const t = line.trim();
            if (t.match(/['"]?[A-Z][a-zA-Z]+['"]?\s*:/)) count++;
            if (t.includes('createStore') || t.includes('vuex')) count++;
            if (t.includes('$t') || t.includes('$style') || t.includes('window.')) count++;
            if (t.includes('mount(') || t.includes('shallowMount(')) count++;
        }
        return count;
    }

    static calculateTI(businessLogicLines, testLines, infrastructureLines) {
        const denom = testLines + infrastructureLines;
        return denom === 0 ? 0 : businessLogicLines / denom;
    }

    static calculateCR(vue2ComponentLOC, vue3ComponentLOC) {
        return vue2ComponentLOC === 0 ? 0 : ((vue2ComponentLOC - vue3ComponentLOC) / vue2ComponentLOC) * 100;
    }
}

class MetricsCalculator {
    static calculateAllMetrics(componentContent, composableContent, testContent, isVue2 = false) {
        const bl = CodeAnalyzer.countBusinessLogicLines(componentContent, composableContent, isVue2);
        const tl = CodeAnalyzer.countTestLines(testContent);
        const il = CodeAnalyzer.countInfrastructureLines(testContent);
        const dcr = CodeAnalyzer.calculateDCR(testContent);
        const ti = CodeAnalyzer.calculateTI(bl, tl, il);

        let componentLOC = 0, composableLOC = 0;
        if (isVue2) {
            componentLOC = CodeAnalyzer.countLOC(componentContent);
            composableLOC = 0;
        } else {
            componentLOC = CodeAnalyzer.countLOC(componentContent);
            composableLOC = composableContent ? CodeAnalyzer.countLOC(composableContent) : 0;
        }
        const totalLOC = componentLOC + composableLOC;

        return {
            dcr, ti: parseFloat(ti.toFixed(2)), totalLOC,
            businessLogicLines: bl, testLines: tl, infrastructureLines: il,
            uiStubs: CodeAnalyzer.countUIStubs(testContent),
            vuexModules: CodeAnalyzer.countVuexModules(testContent),
            globalObjects: CodeAnalyzer.countGlobalObjects(testContent),
            mockFunctions: CodeAnalyzer.countMockFunctions(testContent),
            componentLOC, composableLOC
        };
    }
}

function collectMetrics() {
    console.log('\n🔍 Сбор метрик для магистерской работы...\n');
    console.log('='.repeat(80));

    const files = {
        vue2Multi: CodeAnalyzer.readFile(PATHS.vue2Multi),
        vue2Single: CodeAnalyzer.readFile(PATHS.vue2Single),
        vue3Multi: CodeAnalyzer.readFile(PATHS.vue3Multi),
        vue3Single: CodeAnalyzer.readFile(PATHS.vue3Single),
        vue3MultiComposable: CodeAnalyzer.readFile(PATHS.vue3MultiComposable),
        vue3SingleComposable: CodeAnalyzer.readFile(PATHS.vue3SingleComposable),
        tests: {
            vue2Multi: CodeAnalyzer.readFile(PATHS.tests.vue2Multi),
            vue2Single: CodeAnalyzer.readFile(PATHS.tests.vue2Single),
            vue3Multi: CodeAnalyzer.readFile(PATHS.tests.vue3Multi),
            vue3Single: CodeAnalyzer.readFile(PATHS.tests.vue3Single)
        }
    };

    const metrics = {
        vue2: {
            multi: MetricsCalculator.calculateAllMetrics(files.vue2Multi, null, files.tests.vue2Multi, true),
            single: MetricsCalculator.calculateAllMetrics(files.vue2Single, null, files.tests.vue2Single, true)
        },
        vue3: {
            multi: MetricsCalculator.calculateAllMetrics(files.vue3Multi, files.vue3MultiComposable, files.tests.vue3Multi, false),
            single: MetricsCalculator.calculateAllMetrics(files.vue3Single, files.vue3SingleComposable, files.tests.vue3Single, false)
        }
    };

    console.log('\n📊 МЕТРИКА 1: DCR (Dependency Coupling Ratio)\n');
    console.log('Формула: DCR = Σ(UI) + Σ(Vuex) + Σ(global) + Σ(mockFn)');
    console.log('-'.repeat(80));
    console.log('Компонент                  | UI   | Vuex | Global | MockFn | DCR');
    console.log('-'.repeat(80));
    console.log(`SingleComponent (Vue 2)      | ${String(metrics.vue2.single.uiStubs).padStart(4)} | ${String(metrics.vue2.single.vuexModules).padStart(4)} | ${String(metrics.vue2.single.globalObjects).padStart(6)} | ${String(metrics.vue2.single.mockFunctions).padStart(6)} | ${metrics.vue2.single.dcr}`);
    console.log(`MigratedSingleComponent (V3) | ${String(metrics.vue3.single.uiStubs).padStart(4)} | ${String(metrics.vue3.single.vuexModules).padStart(4)} | ${String(metrics.vue3.single.globalObjects).padStart(6)} | ${String(metrics.vue3.single.mockFunctions).padStart(6)} | ${metrics.vue3.single.dcr}`);
    console.log(`MultiComponent (Vue 2)       | ${String(metrics.vue2.multi.uiStubs).padStart(4)} | ${String(metrics.vue2.multi.vuexModules).padStart(4)} | ${String(metrics.vue2.multi.globalObjects).padStart(6)} | ${String(metrics.vue2.multi.mockFunctions).padStart(6)} | ${metrics.vue2.multi.dcr}`);
    console.log(`MigratedMultiComponent (V3)  | ${String(metrics.vue3.multi.uiStubs).padStart(4)} | ${String(metrics.vue3.multi.vuexModules).padStart(4)} | ${String(metrics.vue3.multi.globalObjects).padStart(6)} | ${String(metrics.vue3.multi.mockFunctions).padStart(6)} | ${metrics.vue3.multi.dcr}`);

    const dcrSI = metrics.vue2.single.dcr > 0 && metrics.vue3.single.dcr > 0 ? (metrics.vue2.single.dcr / metrics.vue3.single.dcr).toFixed(0) : '-';
    const dcrMI = metrics.vue2.multi.dcr > 0 && metrics.vue3.multi.dcr > 0 ? (metrics.vue2.multi.dcr / metrics.vue3.multi.dcr).toFixed(0) : '-';
    console.log('\n' + '='.repeat(80));
    console.log(`Вывод: DCR снизился в ${dcrSI}–${dcrMI} раз`);

    console.log('\n\n📈 МЕТРИКА 2: TI (Testability Index)\n');
    console.log('Формула: TI = BusinessLogic / (TestLines + Infrastructure)');
    console.log('-'.repeat(80));
    console.log('Компонент                  | Logic | Tests | Infra | TI');
    console.log('-'.repeat(80));
    console.log(`SingleComponent (Vue 2)      | ${String(metrics.vue2.single.businessLogicLines).padStart(5)} | ${String(metrics.vue2.single.testLines).padStart(5)} | ${String(metrics.vue2.single.infrastructureLines).padStart(5)} | ${metrics.vue2.single.ti}`);
    console.log(`MigratedSingleComponent (V3) | ${String(metrics.vue3.single.businessLogicLines).padStart(5)} | ${String(metrics.vue3.single.testLines).padStart(5)} | ${String(metrics.vue3.single.infrastructureLines).padStart(5)} | ${metrics.vue3.single.ti}`);
    console.log(`MultiComponent (Vue 2)       | ${String(metrics.vue2.multi.businessLogicLines).padStart(5)} | ${String(metrics.vue2.multi.testLines).padStart(5)} | ${String(metrics.vue2.multi.infrastructureLines).padStart(5)} | ${metrics.vue2.multi.ti}`);
    console.log(`MigratedMultiComponent (V3)  | ${String(metrics.vue3.multi.businessLogicLines).padStart(5)} | ${String(metrics.vue3.multi.testLines).padStart(5)} | ${String(metrics.vue3.multi.infrastructureLines).padStart(5)} | ${metrics.vue3.multi.ti}`);

    const tiSI = metrics.vue2.single.ti > 0 ? (metrics.vue3.single.ti / metrics.vue2.single.ti).toFixed(1) : '-';
    const tiMI = metrics.vue2.multi.ti > 0 ? (metrics.vue3.multi.ti / metrics.vue2.multi.ti).toFixed(1) : '-';
    console.log('\n' + '='.repeat(80));
    console.log(`Вывод: TI улучшился в ${tiSI}–${tiMI} раз`);

    console.log('\n\n📉 МЕТРИКА 3: CR (Code Reduction) - сокращение объема кода компонента\n');
    console.log('Формула: CR = (Vue2LOC - Vue3LOC) / Vue2LOC × 100%');
    console.log('Показывает, насколько сократился общий объем кода после миграции на Composition API');
    console.log('-'.repeat(80));
    console.log('Компонент                  | Vue2 LOC | Vue3 LOC | CR%');
    console.log('-'.repeat(80));

    const singleCR = CodeAnalyzer.calculateCR(metrics.vue2.single.totalLOC, metrics.vue3.single.totalLOC);
    const multiCR = CodeAnalyzer.calculateCR(metrics.vue2.multi.totalLOC, metrics.vue3.multi.totalLOC);

    console.log(`SingleComponent (Vue 2)      | ${String(metrics.vue2.single.totalLOC).padStart(8)} | ${String(metrics.vue3.single.totalLOC).padStart(8)} | ${singleCR.toFixed(1)}`);
    console.log(`MultiComponent (Vue 2)       | ${String(metrics.vue2.multi.totalLOC).padStart(8)} | ${String(metrics.vue3.multi.totalLOC).padStart(8)} | ${multiCR.toFixed(1)}`);

    console.log('\n' + '='.repeat(80));
    console.log(`Вывод: код сократился на ${multiCR.toFixed(1)}% для MultiComponent (для SingleComponent объем незначительно вырос на ${Math.abs(singleCR).toFixed(1)}%)`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Сбор метрик завершен!\n');

    return { metrics, improvements: { dcr: { single: dcrSI, multi: dcrMI }, ti: { single: tiSI, multi: tiMI }, cr: { single: parseFloat(singleCR.toFixed(1)), multi: parseFloat(multiCR.toFixed(1)) } } };
}

if (require.main === module) collectMetrics();
module.exports = { collectMetrics, CodeAnalyzer, MetricsCalculator };