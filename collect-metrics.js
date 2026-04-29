/**
 * collect-metrics.js - Автоматизированный сбор метрик для магистерской работы
 * Сравнивает подходы Vue 2 (Options API) и Vue 3 (Composition API + Composables)
 *
 * Метрики из README:
 * 1. DCR (Dependency Coupling Ratio) - коэффициент связанности зависимостей в тестах
 * 2. TI (Testability Index) - индекс тестируемости
 * 3. SoCS (Separation of Concerns Score) - уровень разделения ответственности
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
            let logic = '';
            const methods = componentContent.match(/methods\s*:\s*\{([\s\S]*?)\}/);
            const computed = componentContent.match(/computed\s*:\s*\{([\s\S]*?)\}/);
            const watch = componentContent.match(/watch\s*:\s*\{([\s\S]*?)\}/);
            if (methods) logic += methods[1];
            if (computed) logic += computed[1];
            if (watch) logic += watch[1];
            return this.countLOC(logic);
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

    static calculateSoCS(totalLogic, logicInComponent, logicInComposable) {
        return totalLogic === 0 ? 0 : (logicInComposable / totalLogic) * 100;
    }
}

class MetricsCalculator {
    static calculateAllMetrics(componentContent, composableContent, testContent, isVue2 = false) {
        const bl = CodeAnalyzer.countBusinessLogicLines(componentContent, composableContent, isVue2);
        const tl = CodeAnalyzer.countTestLines(testContent);
        const il = CodeAnalyzer.countInfrastructureLines(testContent);
        const dcr = CodeAnalyzer.calculateDCR(testContent);
        const ti = CodeAnalyzer.calculateTI(bl, tl, il);

        let lic = 0, loc = 0;
        if (isVue2) {
            lic = bl; loc = 0;
        } else {
            lic = Math.max(0, CodeAnalyzer.countLOC(componentContent) - 20);
            loc = bl;
        }
        const socs = CodeAnalyzer.calculateSoCS(lic + loc, lic, loc);

        return {
            dcr, ti: parseFloat(ti.toFixed(2)), socs: parseFloat(socs.toFixed(1)),
            businessLogicLines: bl, testLines: tl, infrastructureLines: il,
            uiStubs: CodeAnalyzer.countUIStubs(testContent),
            vuexModules: CodeAnalyzer.countVuexModules(testContent),
            globalObjects: CodeAnalyzer.countGlobalObjects(testContent),
            mockFunctions: CodeAnalyzer.countMockFunctions(testContent)
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

    console.log('\n\n📋 МЕТРИКА 3: SoCS (Separation of Concerns Score)\n');
    console.log('Формула: SoCS = LogicInComposable / TotalLogic × 100%');
    console.log('-'.repeat(80));
    console.log('Компонент                  | Всего | В компоненте | В composable | SoCS%');
    console.log('-'.repeat(80));

    const v2sT = metrics.vue2.single.businessLogicLines;
    const v3sT = metrics.vue3.single.businessLogicLines + Math.max(0, CodeAnalyzer.countLOC(files.vue3Single) - 20);
    const v2mT = metrics.vue2.multi.businessLogicLines;
    const v3mT = metrics.vue3.multi.businessLogicLines + Math.max(0, CodeAnalyzer.countLOC(files.vue3Multi) - 20);

    console.log(`SingleComponent (Vue 2)      | ${String(v2sT).padStart(5)} | ${String(v2sT).padStart(6)} | ${String(0).padStart(8)} | ${metrics.vue2.single.socs}`);
    console.log(`MigratedSingleComponent (V3) | ${String(v3sT.toFixed(0)).padStart(5)} | ${String(Math.max(0, CodeAnalyzer.countLOC(files.vue3Single) - 20)).padStart(6)} | ${String(metrics.vue3.single.businessLogicLines).padStart(8)} | ${metrics.vue3.single.socs}`);
    console.log(`MultiComponent (Vue 2)       | ${String(v2mT).padStart(5)} | ${String(v2mT).padStart(6)} | ${String(0).padStart(8)} | ${metrics.vue2.multi.socs}`);
    console.log(`MigratedMultiComponent (V3)  | ${String(v3mT.toFixed(0)).padStart(5)} | ${String(Math.max(0, CodeAnalyzer.countLOC(files.vue3Multi) - 20)).padStart(6)} | ${String(metrics.vue3.multi.businessLogicLines).padStart(8)} | ${metrics.vue3.multi.socs}`);

    const socsSI = metrics.vue3.single.socs - metrics.vue2.single.socs;
    const socsMI = metrics.vue3.multi.socs - metrics.vue2.multi.socs;
    console.log('\n' + '='.repeat(80));
    console.log(`Вывод: SoCS улучшился на ${socsSI}–${socsMI} п.п.`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Сбор метрик завершен!\n');

    return { metrics, improvements: { dcr: { single: dcrSI, multi: dcrMI }, ti: { single: tiSI, multi: tiMI }, socs: { single: socsSI, multi: socsMI } } };
}

if (require.main === module) collectMetrics();
module.exports = { collectMetrics, CodeAnalyzer, MetricsCalculator };