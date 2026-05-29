/**
 * collect-metrics.js - Автоматизированный сбор метрик для магистерской работы
 * Сравнивает подходы Vue 2 (Options API), Vue 3 (Composables) и Vue 3 (Composition API + Composables)
 *
 * Метрики из README:
 * 1. DCR (Dependency Coupling Ratio) - коэффициент связанности зависимостей в тестах
 *    Показывает, сколько сторонних зависимостей (моки, стабы, глобальные объекты)
 *    требуется для тестирования компонента. Чем меньше DCR, тем лучше.
 *
 * 2. TI (Testability Index) - индекс тестируемости
 *    Показывает соотношение полезной бизнес-логики к общему объёму тестового кода.
 *    Формула: TI = Бизнес-логика / (Строки тестов + Инфраструктура)
 *    Чем выше TI, тем эффективнее тесты (больше проверки логики, меньше настройки).
 *
 * 3. CR (Code Reduction) - показатель изменения объема бизнес-логики
 * Показывает, насколько изменилась бизнес-логика после миграции.
 * Положительное значение означает увеличение кода, отрицательное - сокращение.
 */

const fs = require('fs');
const path = require('path');

const PATHS = {
    vue2Multi: './src/MultiComponent.vue',
    vue2Single: './src/SingleComponent.vue',
    // Migration Stage 1: Options API + Composable (logic extracted, but Options API preserved)
    vue3MultiOptionsAPI: './src/MigratedMultiComponent/OptionsAPI/MigratedMultiComponent.vue',
    vue3SingleOptionsAPI: './src/MigratedSingleComponent/OptionsAPI/MigratedSingleComponent.vue',
    vue3MultiOptionsComposable: './src/MigratedMultiComponent/OptionsAPI/composables/useMigratedMultiComponentLogic.js',
    vue3SingleOptionsComposable: './src/MigratedSingleComponent/OptionsAPI/composables/useMigratedSingleComponentLogic.js',
    // Migration Stage 2: Full Composition API with <script setup>
    vue3MultiCompositionAPI: './src/MigratedMultiComponent/CompositionAPI/MigratedMultiComponent.vue',
    vue3SingleCompositionAPI: './src/MigratedSingleComponent/CompositionAPI/MigratedSingleComponent.vue',
    vue3MultiCompositionComposable: './src/MigratedMultiComponent/CompositionAPI/composables/useMigratedMultiComponentLogic.js',
    vue3SingleCompositionComposable: './src/MigratedSingleComponent/CompositionAPI/composables/useMigratedSingleComponentLogic.js',
    tests: {
        vue2Multi: './tests/MultiComponent.spec.js',
        vue2Single: './tests/SingleComponent.spec.js',
        vue3MultiOptionsAPI: './tests/MigratedMultiComponentOptionsAPI.spec.js',
        vue3SingleOptionsAPI: './tests/MigratedSingleComponentOptionsAPI.spec.js',
        vue3MultiCompositionAPI: './tests/MigratedMultiComponentCompositionAPI.spec.js',
        vue3SingleCompositionAPI: './tests/MigratedSingleComponentCompositionAPI.spec.js'
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
        // Подсчитываем количество стабов UI-компонентов в тестах
        // Ищем только в контексте stubs: { ... } или const STUBS/REQUIRED_STUBS = { ... }
        // Паттерн ищет компоненты вида ComponentName: true/false/{}

        let count = 0;

        // Вариант 1: Ищем в константе STUBS = { ... } или REQUIRED_STUBS = { ... }
        const stubsConstMatch = testContent.match(/(?:const|let|var)\s+(?:REQUIRED_)?STUBS\s*=\s*\{([\s\S]*?)\}/);
        if (stubsConstMatch) {
            const stubsContent = stubsConstMatch[1];
            const keys = stubsContent.match(/(?:^|,)\s*['\"]?([A-Z][a-zA-Z]*)['\"]?\s*:\s*(?:true|false|\{\})/g);
            if (keys) {
                count += keys.length;
            }
        }

        // Вариант 2: Ищем в inline stubs: { ... } (если есть напрямую в mount/stubMount)
        // Но исключаем те, что уже посчитаны в STUBS/REQUIRED_STUBS
        const inlineStubsMatches = testContent.match(/stubs\s*:\s*\{([\s\S]*?)\}/g);
        if (inlineStubsMatches) {
            for (const match of inlineStubsMatches) {
                // Проверяем, не является ли это ссылкой на STUBS (например, stubs: STUBS или stubs: REQUIRED_STUBS)
                if (match.includes('STUBS')) continue;

                const innerContent = match.match(/\{([\s\S]*?)\}/);
                if (innerContent) {
                    const keys = innerContent[1].match(/(?:^|,)\s*['\"]?([A-Z][a-zA-Z]*)['\"]?\s*:\s*(?:true|false|\{\})/g);
                    if (keys) {
                        count += keys.length;
                    }
                }
            }
        }

        return count;
    }

    static countVuexModules(testContent) {
        if (!testContent) return 0;
        // Считаем количество уникальных подключений Vuex store в тестах
        // Ищем вызовы createStore() в контексте плагинов или создания мокового стора
        // Исключаем комментарии и импорты

        let count = 0;
        const lines = testContent.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            // Пропускаем комментарии
            if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

            // Пропускаем строки импорта (они начинаются с import)
            if (trimmed.startsWith('import')) continue;

            // Считаем только реальные вызовы createStore() для создания стора
            // Это могут быть строки типа: createStore({...}) или return createStore({...})
            if (trimmed.includes('createStore(')) {
                count++;
            }
        }

        return count;
    }

    static countGlobalObjects(testContent) {
        if (!testContent) return 0;
        let count = 0;

        // Vue 2: Считаем моки глобальных свойств в блоках mocks: { ... }
        // Ищем все блоки mocks и считаем в них свойства вида $something:
        const mocksMatches = testContent.match(/mocks\s*:\s*\{([\s\S]*?)\}/g);
        if (mocksMatches) {
            for (const match of mocksMatches) {
                const innerMatch = match.match(/\{([\s\S]*?)\}/);
                if (innerMatch) {
                    const mocksContent = innerMatch[1];
                    // Считаем свойства вида $alert:, $t:, $style: и т.д.
                    const keys = mocksContent.match(/\$[a-zA-Z_][\w\$]*\s*:/g);
                    if (keys) {
                        count += keys.length;
                    }
                }
            }
        }

        // Vue 2: Также считаем моки из констант REQUIRED_MOCKS = { ... } или MOCKS = { ... }
        const mocksConstMatch = testContent.match(/(?:const|let|var)\s+(?:REQUIRED_)?MOCKS?\s*=\s*\{([\s\S]*?)\}/);
        if (mocksConstMatch) {
            const mocksContent = mocksConstMatch[1];
            const keys = mocksContent.match(/\$[a-zA-Z_][\w\$]*\s*:/g);
            if (keys) {
                count += keys.length;
            }
        }

        // Проверяем наличие global.window или присваивания window (для Vue 3 тестов)
        if (testContent.includes('global.window') || testContent.match(/window\s*=/)) {
            const wm = testContent.match(/window\.\w+/g);
            count += wm ? wm.length : 1;
        }

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
            // Для Vue 3 определяем тип компонента и считаем соответствующую бизнес-логику
            let totalLogicLines = 0;

            // Проверяем, используется ли <script setup> (Composition API) или обычный <script> (Options API)
            // Ищем тег <script setup> как отдельный элемент, а не упоминание в комментариях
            const hasScriptSetup = /^<script\s+setup\s*>/m.test(componentContent);
            const scriptOptionsMatch = componentContent.match(/<script>([\s\S]*?)<\/script>/);

            if (hasScriptSetup) {
                // Вариант 2: Composition API - считаем логику из composable И из <script setup>
                if (composableContent) {
                    totalLogicLines += this.countLOC(composableContent);
                }

                // Считаем строки из <script setup> компонента (вся логика кроме чистых импортов UI компонентов)
                const scriptSetupMatch = componentContent.match(/<script\s+setup>([\s\S]*?)<\/script>/);
                if (scriptSetupMatch) {
                    const scriptSetupContent = scriptSetupMatch[1];
                    const lines = scriptSetupContent.split('\n');

                    for (const line of lines) {
                        const trimmed = line.trim();
                        // Пропускаем пустые строки и комментарии
                        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

                        // Пропускаем только чистые импорты UI компонентов (не бизнес-логику)
                        // Импорты composable, хуков и данных считаем как бизнес-логику
                        if (trimmed.startsWith('import')) {
                            // Не считаем импорты UI компонентов (начинаются с '@/components' или относительные пути к компонентам)
                            if (trimmed.includes('@/components/') ||
                                trimmed.match(/import\s+\w+\s+from\s+['"]\.\/[^'']*\.vue['"]/)) {
                                continue;
                            }
                        }

                        totalLogicLines++;
                    }
                }
            } else if (scriptOptionsMatch && composableContent) {
                // Вариант 1: Options API с вынесением логики в composable
                // Считаем ТОЛЬКО composable, так как компонент на Options API не содержит бизнес-логики
                // (он только вызывает функции из composable через деструктуризацию)
                // Компонент содержит лишь тонкую обёртку для вызова composable
                totalLogicLines = this.countLOC(composableContent);
            } else if (scriptOptionsMatch) {
                // Если есть Options API但没有 composable, считаем логику внутри компонента
                const scriptContent = scriptOptionsMatch[1];
                const exportStart = scriptContent.indexOf('export default');
                if (exportStart !== -1) {
                    const afterExport = scriptContent.substring(exportStart);
                    let braceCount = 0;
                    let foundFirstBrace = false;
                    let logicLines = [];

                    for (const line of afterExport.split('\n')) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith('//')) continue;

                        for (const char of line) {
                            if (char === '{') {
                                braceCount++;
                                foundFirstBrace = true;
                            } else if (char === '}') {
                                braceCount--;
                            }
                        }

                        if (trimmed.startsWith('import') || trimmed.startsWith('export')) continue;

                        if (foundFirstBrace && braceCount > 0) {
                            logicLines.push(line);
                        }

                        if (foundFirstBrace && braceCount === 0) break;
                    }

                    totalLogicLines = logicLines.length;
                }
            }

            return totalLogicLines;
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
            // Инфраструктура: стабы UI-компонентов (строки с заглушками компонентов)
            if (t.match(/['"]?[A-Z][a-zA-Z]+['"]?\s*:\s*(?:true|false|\{\})/)) count++;
            // Инфраструктура: подключение Vuex хранилища
            if (t.includes('createStore') || t.includes('vuex')) count++;
            // Инфраструктура: моки глобальных свойств Vue ($t - локализация, $style)
            if (t.includes('$t:') || t.includes('$style:')) count++;
            // Инфраструктура: моки глобального объекта window
            if (t.includes('window.') && !t.includes('//')) count++;
            // Инфраструктура: вызовы функций монтирования компонента
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
        // Migration Stage 1: Options API + Composable
        vue3MultiOptionsAPI: CodeAnalyzer.readFile(PATHS.vue3MultiOptionsAPI),
        vue3SingleOptionsAPI: CodeAnalyzer.readFile(PATHS.vue3SingleOptionsAPI),
        vue3MultiOptionsComposable: CodeAnalyzer.readFile(PATHS.vue3MultiOptionsComposable),
        vue3SingleOptionsComposable: CodeAnalyzer.readFile(PATHS.vue3SingleOptionsComposable),
        // Migration Stage 2: Full Composition API
        vue3MultiCompositionAPI: CodeAnalyzer.readFile(PATHS.vue3MultiCompositionAPI),
        vue3SingleCompositionAPI: CodeAnalyzer.readFile(PATHS.vue3SingleCompositionAPI),
        vue3MultiCompositionComposable: CodeAnalyzer.readFile(PATHS.vue3MultiCompositionComposable),
        vue3SingleCompositionComposable: CodeAnalyzer.readFile(PATHS.vue3SingleCompositionComposable),
        tests: {
            vue2Multi: CodeAnalyzer.readFile(PATHS.tests.vue2Multi),
            vue2Single: CodeAnalyzer.readFile(PATHS.tests.vue2Single),
            vue3MultiOptionsAPI: CodeAnalyzer.readFile(PATHS.tests.vue3MultiOptionsAPI),
            vue3SingleOptionsAPI: CodeAnalyzer.readFile(PATHS.tests.vue3SingleOptionsAPI),
            vue3MultiCompositionAPI: CodeAnalyzer.readFile(PATHS.tests.vue3MultiCompositionAPI),
            vue3SingleCompositionAPI: CodeAnalyzer.readFile(PATHS.tests.vue3SingleCompositionAPI)
        }
    };

    const metrics = {
        vue2: {
            multi: MetricsCalculator.calculateAllMetrics(files.vue2Multi, null, files.tests.vue2Multi, true),
            single: MetricsCalculator.calculateAllMetrics(files.vue2Single, null, files.tests.vue2Single, true)
        },
        vue3OptionsAPI: {
            multi: MetricsCalculator.calculateAllMetrics(files.vue3MultiOptionsAPI, files.vue3MultiOptionsComposable, files.tests.vue3MultiOptionsAPI, false),
            single: MetricsCalculator.calculateAllMetrics(files.vue3SingleOptionsAPI, files.vue3SingleOptionsComposable, files.tests.vue3SingleOptionsAPI, false)
        },
        vue3CompositionAPI: {
            multi: MetricsCalculator.calculateAllMetrics(files.vue3MultiCompositionAPI, files.vue3MultiCompositionComposable, files.tests.vue3MultiCompositionAPI, false),
            single: MetricsCalculator.calculateAllMetrics(files.vue3SingleCompositionAPI, files.vue3SingleCompositionComposable, files.tests.vue3SingleCompositionAPI, false)
        }
    };

    console.log('\n📊 МЕТРИКА 1: DCR (Dependency Coupling Ratio) - коэффициент связанности зависимостей\n');
    console.log('Что показывает: сколько сторонних зависимостей требуется для тестирования');
    console.log('Формула: DCR = UI-стабы + Vuex-модули + Глобальные объекты + Мок-функции');
    console.log('Интерпретация: чем меньше DCR, тем лучше — меньше внешних зависимостей в тестах');
    console.log('-'.repeat(80));
    console.log('Компонент                              | UI   | Vuex | Global | MockFn | DCR');
    console.log('-'.repeat(80));
    // Vue 2 (Original)
    console.log(`SingleComponent (Vue 2)                | ${String(metrics.vue2.single.uiStubs).padStart(4)} | ${String(metrics.vue2.single.vuexModules).padStart(4)} | ${String(metrics.vue2.single.globalObjects).padStart(6)} | ${String(metrics.vue2.single.mockFunctions).padStart(6)} | ${metrics.vue2.single.dcr}`);
    console.log(`MultiComponent (Vue 2)                 | ${String(metrics.vue2.multi.uiStubs).padStart(4)} | ${String(metrics.vue2.multi.vuexModules).padStart(4)} | ${String(metrics.vue2.multi.globalObjects).padStart(6)} | ${String(metrics.vue2.multi.mockFunctions).padStart(6)} | ${metrics.vue2.multi.dcr}`);
    // Migration Stage 1: Options API + Composable
    console.log(`MigratedSingleComponent (Options+Comp) | ${String(metrics.vue3OptionsAPI.single.uiStubs).padStart(4)} | ${String(metrics.vue3OptionsAPI.single.vuexModules).padStart(4)} | ${String(metrics.vue3OptionsAPI.single.globalObjects).padStart(6)} | ${String(metrics.vue3OptionsAPI.single.mockFunctions).padStart(6)} | ${metrics.vue3OptionsAPI.single.dcr}`);
    console.log(`MigratedMultiComponent (Options+Comp)  | ${String(metrics.vue3OptionsAPI.multi.uiStubs).padStart(4)} | ${String(metrics.vue3OptionsAPI.multi.vuexModules).padStart(4)} | ${String(metrics.vue3OptionsAPI.multi.globalObjects).padStart(6)} | ${String(metrics.vue3OptionsAPI.multi.mockFunctions).padStart(6)} | ${metrics.vue3OptionsAPI.multi.dcr}`);
    // Migration Stage 2: Full Composition API
    console.log(`MigratedSingleComponent (Composition)  | ${String(metrics.vue3CompositionAPI.single.uiStubs).padStart(4)} | ${String(metrics.vue3CompositionAPI.single.vuexModules).padStart(4)} | ${String(metrics.vue3CompositionAPI.single.globalObjects).padStart(6)} | ${String(metrics.vue3CompositionAPI.single.mockFunctions).padStart(6)} | ${metrics.vue3CompositionAPI.single.dcr}`);
    console.log(`MigratedMultiComponent (Composition)   | ${String(metrics.vue3CompositionAPI.multi.uiStubs).padStart(4)} | ${String(metrics.vue3CompositionAPI.multi.vuexModules).padStart(4)} | ${String(metrics.vue3CompositionAPI.multi.globalObjects).padStart(6)} | ${String(metrics.vue3CompositionAPI.multi.mockFunctions).padStart(6)} | ${metrics.vue3CompositionAPI.multi.dcr}`);

    const dcrSI_Options = metrics.vue2.single.dcr > 0 && metrics.vue3OptionsAPI.single.dcr > 0 ? (metrics.vue2.single.dcr / metrics.vue3OptionsAPI.single.dcr).toFixed(0) : '-';
    const dcrMI_Options = metrics.vue2.multi.dcr > 0 && metrics.vue3OptionsAPI.multi.dcr > 0 ? (metrics.vue2.multi.dcr / metrics.vue3OptionsAPI.multi.dcr).toFixed(0) : '-';
    const dcrSI_Composition = metrics.vue2.single.dcr > 0 && metrics.vue3CompositionAPI.single.dcr > 0 ? (metrics.vue2.single.dcr / metrics.vue3CompositionAPI.single.dcr).toFixed(0) : '-';
    const dcrMI_Composition = metrics.vue2.multi.dcr > 0 && metrics.vue3CompositionAPI.multi.dcr > 0 ? (metrics.vue2.multi.dcr / metrics.vue3CompositionAPI.multi.dcr).toFixed(0) : '-';

    console.log('\n' + '='.repeat(80));
    console.log('Выводы по DCR:');
    console.log(`  • После вынесения логики (Options API + Composable): снижение в ${dcrSI_Options}–${dcrMI_Options} раз`);
    console.log(`  • После полной миграции (Composition API): снижение в ${dcrSI_Composition}–${dcrMI_Composition} раз`);
    console.log('Это означает, что тесты требуют меньше зависимостей после миграции');

    console.log('\n\n📈 МЕТРИКА 2: TI (Testability Index) - индекс тестируемости\n');
    console.log('Что показывает: соотношение полезной бизнес-логики к объёму тестового кода');
    console.log('Формула: TI = Бизнес-логика / (Строки тестов + Инфраструктура)');
    console.log('Инфраструктура: стабы компонентов, моки Vuex, глобальных объектов, вызовы mount()');
    console.log('Интерпретация: чем выше TI, тем эффективнее тесты (больше проверки логики, меньше настройки)');
    console.log('-'.repeat(80));
    console.log('Компонент                              | Logic | Tests | Infra | TI');
    console.log('-'.repeat(80));
    // Vue 2 (Original)
    console.log(`SingleComponent (Vue 2)                | ${String(metrics.vue2.single.businessLogicLines).padStart(5)} | ${String(metrics.vue2.single.testLines).padStart(5)} | ${String(metrics.vue2.single.infrastructureLines).padStart(5)} | ${metrics.vue2.single.ti}`);
    console.log(`MultiComponent (Vue 2)                 | ${String(metrics.vue2.multi.businessLogicLines).padStart(5)} | ${String(metrics.vue2.multi.testLines).padStart(5)} | ${String(metrics.vue2.multi.infrastructureLines).padStart(5)} | ${metrics.vue2.multi.ti}`);
    // Migration Stage 1: Options API + Composable
    console.log(`MigratedSingleComponent (Options+Comp) | ${String(metrics.vue3OptionsAPI.single.businessLogicLines).padStart(5)} | ${String(metrics.vue3OptionsAPI.single.testLines).padStart(5)} | ${String(metrics.vue3OptionsAPI.single.infrastructureLines).padStart(5)} | ${metrics.vue3OptionsAPI.single.ti}`);
    console.log(`MigratedMultiComponent (Options+Comp)  | ${String(metrics.vue3OptionsAPI.multi.businessLogicLines).padStart(5)} | ${String(metrics.vue3OptionsAPI.multi.testLines).padStart(5)} | ${String(metrics.vue3OptionsAPI.multi.infrastructureLines).padStart(5)} | ${metrics.vue3OptionsAPI.multi.ti}`);
    // Migration Stage 2: Full Composition API
    console.log(`MigratedSingleComponent (Composition)  | ${String(metrics.vue3CompositionAPI.single.businessLogicLines).padStart(5)} | ${String(metrics.vue3CompositionAPI.single.testLines).padStart(5)} | ${String(metrics.vue3CompositionAPI.single.infrastructureLines).padStart(5)} | ${metrics.vue3CompositionAPI.single.ti}`);
    console.log(`MigratedMultiComponent (Composition)   | ${String(metrics.vue3CompositionAPI.multi.businessLogicLines).padStart(5)} | ${String(metrics.vue3CompositionAPI.multi.testLines).padStart(5)} | ${String(metrics.vue3CompositionAPI.multi.infrastructureLines).padStart(5)} | ${metrics.vue3CompositionAPI.multi.ti}`);

    const tiSI_Options = metrics.vue2.single.ti > 0 ? (metrics.vue3OptionsAPI.single.ti / metrics.vue2.single.ti).toFixed(1) : '-';
    const tiMI_Options = metrics.vue2.multi.ti > 0 ? (metrics.vue3OptionsAPI.multi.ti / metrics.vue2.multi.ti).toFixed(1) : '-';
    const tiSI_Composition = metrics.vue2.single.ti > 0 ? (metrics.vue3CompositionAPI.single.ti / metrics.vue2.single.ti).toFixed(1) : '-';
    const tiMI_Composition = metrics.vue2.multi.ti > 0 ? (metrics.vue3CompositionAPI.multi.ti / metrics.vue2.multi.ti).toFixed(1) : '-';

    console.log('\n' + '='.repeat(80));
    console.log('Выводы по TI:');
    console.log(`  • После вынесения логики (Options API + Composable): улучшение в ${tiSI_Options}–${tiMI_Options} раз`);
    console.log(`  • После полной миграции (Composition API): улучшение в ${tiSI_Composition}–${tiMI_Composition} раз`);
    console.log('Это означает, что тесты стали более эффективными после миграции');

    console.log('\n\n📉 МЕТРИКА 3: CR (Business Code Reduction) - сокращение объема бизнес-логики\n');
    console.log('Что показывает: насколько сократилась бизнес-логика после миграции на Composition API');
    console.log('Формула: CR = (Vue2 логика - Vue3 логика) / Vue2 логика × 100%');
    console.log('Сравниваются строки бизнес-логики: export default блок (Vue 2) vs composable + <script setup> (Vue 3)');
    console.log('Интерпретация: положительное значение — код сократился, отрицательное — увеличился');
    console.log('-'.repeat(110));
    console.log('Компонент                              | Vue2 Logic | Vue3 Options+Comp | CR% (Options) | Vue3 Composition+Comp | CR% (Composition)');
    console.log('-'.repeat(110));

    // CR для Migration Stage 1: Options API + Composable
    const singleCR_Options = CodeAnalyzer.calculateCR(metrics.vue2.single.businessLogicLines, metrics.vue3OptionsAPI.single.businessLogicLines);
    const multiCR_Options = CodeAnalyzer.calculateCR(metrics.vue2.multi.businessLogicLines, metrics.vue3OptionsAPI.multi.businessLogicLines);

    // CR для Migration Stage 2: Full Composition API
    const singleCR_Composition = CodeAnalyzer.calculateCR(metrics.vue2.single.businessLogicLines, metrics.vue3CompositionAPI.single.businessLogicLines);
    const multiCR_Composition = CodeAnalyzer.calculateCR(metrics.vue2.multi.businessLogicLines, metrics.vue3CompositionAPI.multi.businessLogicLines);

    console.log(`SingleComponent                        | ${String(metrics.vue2.single.businessLogicLines).padStart(10)} | ${String(metrics.vue3OptionsAPI.single.businessLogicLines).padStart(17)} | ${String(singleCR_Options.toFixed(1)).padStart(13)} | ${String(metrics.vue3CompositionAPI.single.businessLogicLines).padStart(19)} | ${String(singleCR_Composition.toFixed(1)).padStart(16)}`);
    console.log(`MultiComponent                         | ${String(metrics.vue2.multi.businessLogicLines).padStart(10)} | ${String(metrics.vue3OptionsAPI.multi.businessLogicLines).padStart(17)} | ${String(multiCR_Options.toFixed(1)).padStart(13)} | ${String(metrics.vue3CompositionAPI.multi.businessLogicLines).padStart(19)} | ${String(multiCR_Composition.toFixed(1)).padStart(16)}`);

    console.log('\n' + '='.repeat(80));
    console.log('Выводы по CR:');
    if (multiCR_Options > 0) {
        console.log(`  • После вынесения логики (Options API + Composable): бизнес-логика сократилась на ${multiCR_Options.toFixed(1)}% для MultiComponent`);
    } else {
        console.log(`  • После вынесения логики (Options API + Composable): бизнес-логика увеличилась на ${Math.abs(multiCR_Options).toFixed(1)}% для MultiComponent`);
    }
    if (multiCR_Composition > 0) {
        console.log(`  • После полной миграции (Composition API): бизнес-логика сократилась на ${multiCR_Composition.toFixed(1)}% для MultiComponent`);
    } else {
        console.log(`  • После полной миграции (Composition API): бизнес-логика увеличилась на ${Math.abs(multiCR_Composition).toFixed(1)}% для MultiComponent`);
    }
    if (singleCR_Options > 0) {
        console.log(`  • Для SingleComponent объем сократился на ${singleCR_Options.toFixed(1)}% (Options+Comp)`);
    } else {
        console.log(`  • Для SingleComponent объем увеличился на ${Math.abs(singleCR_Options).toFixed(1)}% (Options+Comp)`);
    }
    if (singleCR_Composition > 0) {
        console.log(`  • Для SingleComponent объем сократился на ${singleCR_Composition.toFixed(1)}% (Composition)`);
    } else {
        console.log(`  • Для SingleComponent объем увеличился на ${Math.abs(singleCR_Composition).toFixed(1)}% (Composition)`);
    }

    console.log('\n\n📄 ДОП: Общий объем файлов (LOC) - для справки\n');
    console.log('Показывает полный объем файлов включая template, style, импорты, комментарии');
    console.log('Не используется для расчёта CR, так как включает инфраструктурный код');
    console.log('-'.repeat(100));
    console.log('Компонент                              | Vue2 Total LOC | Options+Comp Total | Composition Total | Δ Options (%) | Δ Composition (%)');
    console.log('-'.repeat(100));

    // Рассчитываем изменения в % для LOC
    const singleLocDeltaOptions = metrics.vue2.single.totalLOC > 0
        ? ((metrics.vue3OptionsAPI.single.totalLOC - metrics.vue2.single.totalLOC) / metrics.vue2.single.totalLOC * 100).toFixed(1)
        : '0.0';
    const multiLocDeltaOptions = metrics.vue2.multi.totalLOC > 0
        ? ((metrics.vue3OptionsAPI.multi.totalLOC - metrics.vue2.multi.totalLOC) / metrics.vue2.multi.totalLOC * 100).toFixed(1)
        : '0.0';
    const singleLocDeltaComposition = metrics.vue2.single.totalLOC > 0
        ? ((metrics.vue3CompositionAPI.single.totalLOC - metrics.vue2.single.totalLOC) / metrics.vue2.single.totalLOC * 100).toFixed(1)
        : '0.0';
    const multiLocDeltaComposition = metrics.vue2.multi.totalLOC > 0
        ? ((metrics.vue3CompositionAPI.multi.totalLOC - metrics.vue2.multi.totalLOC) / metrics.vue2.multi.totalLOC * 100).toFixed(1)
        : '0.0';

    console.log(`SingleComponent                        | ${String(metrics.vue2.single.totalLOC).padStart(14)} | ${String(metrics.vue3OptionsAPI.single.totalLOC).padStart(18)} | ${String(metrics.vue3CompositionAPI.single.totalLOC).padStart(17)} | ${String(singleLocDeltaOptions).padStart(13)} | ${String(singleLocDeltaComposition).padStart(17)}`);
    console.log(`MultiComponent                         | ${String(metrics.vue2.multi.totalLOC).padStart(14)} | ${String(metrics.vue3OptionsAPI.multi.totalLOC).padStart(18)} | ${String(metrics.vue3CompositionAPI.multi.totalLOC).padStart(17)} | ${String(multiLocDeltaOptions).padStart(13)} | ${String(multiLocDeltaComposition).padStart(17)}`);

    console.log('\n' + '='.repeat(80));
    console.log('Анализ изменения объема кода:');
    console.log('Увеличение общего объема кода при миграции объясняется следующими факторами:');
    console.log('  1. Вынесение логики в отдельные composable-файлы добавляет:');
    console.log('     - Экспорты функций и переменных');
    console.log('     - Дополнительную структуру для переиспользования');
    console.log('     - Комментарии и документацию API');
    console.log('  2. Migration overhead - временное дублирование для поддержки двух подходов');
    console.log('  3. Более явная структура Composition API требует больше строк для импортов хуков');
    console.log('Важно: CR метрика измеряет только бизнес-логику, а не общий объем файлов');

    console.log('\n' + '='.repeat(80));
    console.log('✅ Сбор метрик завершен!\n');
    console.log('Краткое резюме:');
    console.log(`  • DCR: снижение в ${dcrSI_Options}–${dcrMI_Options} раз после вынесения логики, в ${dcrSI_Composition}–${dcrMI_Composition} раз после полной миграции`);
    console.log(`  • TI: улучшение в ${tiSI_Options}–${tiMI_Options} раз после вынесения логики, в ${tiSI_Composition}–${tiMI_Composition} раз после полной миграции`);
    if (multiCR_Composition > 0) {
        console.log(`  • CR: сокращение бизнес-логики на ${multiCR_Composition.toFixed(1)}% для сложных компонентов (Composition API)`);
    } else {
        console.log(`  • CR: увеличение бизнес-логики на ${Math.abs(multiCR_Composition).toFixed(1)}% для сложных компонентов (Composition API)`);
    }
    console.log('');

    return {
        metrics,
        improvements: {
            dcr: {
                single: { options: dcrSI_Options, composition: dcrSI_Composition },
                multi: { options: dcrMI_Options, composition: dcrMI_Composition }
            },
            ti: {
                single: { options: tiSI_Options, composition: tiSI_Composition },
                multi: { options: tiMI_Options, composition: tiMI_Composition }
            },
            cr: {
                single: { options: parseFloat(singleCR_Options.toFixed(1)), composition: parseFloat(singleCR_Composition.toFixed(1)) },
                multi: { options: parseFloat(multiCR_Options.toFixed(1)), composition: parseFloat(multiCR_Composition.toFixed(1)) }
            }
        }
    };
}

if (require.main === module) collectMetrics();
module.exports = { collectMetrics, CodeAnalyzer, MetricsCalculator };