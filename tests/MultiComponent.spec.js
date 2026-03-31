import { shallowMount } from '@vue/test-utils';
import { createStore } from 'vuex'; // Импортируем createStore
import { vi, describe, it, expect } from 'vitest';
import MultiComponent from '../src/MultiComponent.vue';

// Мокаем API
vi.mock('../src/api', () => ({
    getDashboardData: vi.fn().mockResolvedValue({
        actions: [],
        dates: [],
        materials: []
    }),
    cancelRequest: vi.fn()
}));

// Мокаем глобальный window
global.window = {
    appellant: { isAuthorized: true, canSubmitToTypeA: true },
    participants: [{ id: 1, fio: 'Test User' }],
    examTypes: [],
    isSubmissionDeniedByVendor: false,
    lastSubmittedRequest: false,
};

// Выносим все заглушки компонентов в одну константу для чистоты кода
const STUBS = {
    PageLoading: true,
    EjText: true,
    Button: true,
    Stack: true,
    Columns: true,
    Column: true,
    InfoState: true,
    RequestCard: true,
    AppealCard: true,
    MaterialLink: true,
    Hr: true,
    Spacer: true,
    ModalComponent: true,
    Table2: true,
    RadioGroup: true,
    ContextMenu: true,
    WithdrawModal: true,
    UploaderModal: true,
    AppealFormModal: true,
    FormComponent: true,
    FormHeader: true,
    FormBody: true,
    FormGroup: true,
    SelectComponent: true
};

describe('MultiComponent.vue (Legacy)', () => {
    
    // Создаем РЕАЛЬНЫЙ экземпляр Vuex Store, но с моковыми данными
    const createMockStore = () => {
        return createStore({
            modules: {
                dashboardStore: { // Важно: неймспейс должен совпадать с тем, что в компоненте
                    namespaced: true,
                    state: {
                        eventTypesMenu: [],
                        stages: [],
                        stageNameMap: {},
                        activeTypesByStages: {},
                        scheduleResults: { results: [] },
                        userAppeals: []
                    },
                    getters: {
                        eventsByMonths: () => [],
                        months: () => []
                    },
                    actions: {
                        // Мокаем экшены, которые вызываются в created() хуке
                        init: vi.fn(() => Promise.resolve()),
                        loadDashboardData: vi.fn(() => Promise.resolve()),
                    },
                    mutations: {
                        // Если компонент использует commit, можно добавить заглушки здесь
                    }
                }
            }
        });
    };

    it('Сценарий 1: Корректная фильтрация строк апелляций', async () => {
        const wrapper = shallowMount(MultiComponent, {
            global: {
                plugins: [createMockStore()], // Передаем реальный стор как плагин
                mocks: {
                    $alert: vi.fn()
                },
                stubs: STUBS // Используем константу (глобальный уровень)
            }
        });

        // Тестируем логику фильтрации
        wrapper.vm.appealRows = [
            { id: 1, examForm: 'Тип А', subject: 'Math' },
            { id: 2, examForm: 'Тип Б', subject: 'History' },
            { id: 3, examForm: 'Тип А', subject: 'Physics' },
        ];

        expect(wrapper.vm.filteredAppealRows.length).toBe(3);

        wrapper.vm.appealFilter = 'Тип А';
        
        expect(wrapper.vm.filteredAppealRows.length).toBe(2);
        expect(wrapper.vm.filteredAppealRows[0].subject).toBe('Math');
    });

    it('Сценарий 2: Вычисление цвета кнопки отправки (computed)', async () => {
        const wrapper = shallowMount(MultiComponent, {
            global: {
                plugins: [createMockStore()], // Передаем реальный стор как плагин
                mocks: {
                    $alert: vi.fn()
                },
                stubs: STUBS // Используем ту же константу, чтобы не было warnings
            }
        });
        
        // Проверка вычисляемого свойства
        expect(wrapper.vm.submitButtonColor).toBe('blue');

        wrapper.vm.appellant = { isAuthorized: false };
        expect(wrapper.vm.submitButtonColor).toBe('red');
    });
});