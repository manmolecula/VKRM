import { useMultiComponentLogicOptions } from '../src/MigratedMultiComponent/OptionsAPI/composables/useMigratedMultiComponentLogic';
import { vi, describe, it, expect } from 'vitest';

// Мокаем API
vi.mock('../src/api', () => ({
    getDashboardData: vi.fn().mockResolvedValue({
        actions: [{ key: 'auth', url: 'http://test.com', label: 'Login' }],
        dates: [],
        materials: []
    }),
}));

describe('useMultiComponentLogicOptions (Composable для Options API)', () => {

    it('Сценарий 1: Корректная фильтрация строк апелляций', () => {
        const initialState = { appellant: {}, participants: [] };
        const { appealFilter, filteredAppealRows, appealRows } = useMultiComponentLogicOptions(initialState);

        appealRows.value = [
            { id: 1, examForm: 'Тип А', subject: 'Math' },
            { id: 2, examForm: 'Тип Б', subject: 'History' },
            { id: 3, examForm: 'Тип А', subject: 'Physics' },
        ];

        appealFilter.value = 'Тип А';

        expect(filteredAppealRows.value.length).toBe(2);
        expect(filteredAppealRows.value[0].subject).toBe('Math');
        expect(filteredAppealRows.value[1].subject).toBe('Physics');
    });

    it('Сценарий 2: Вычисление цвета кнопки отправки (computed)', () => {
        const stateUnauthorized = { appellant: { isAuthorized: false } };
        const { submitButtonColor: color1 } = useMultiComponentLogicOptions(stateUnauthorized);
        expect(color1.value).toBe('red');

        const stateAuthorized = { appellant: { isAuthorized: true } };
        const { submitButtonColor: color2 } = useMultiComponentLogicOptions(stateAuthorized);
        expect(color2.value).toBe('blue');
    });

    it('Сценарий 3: Поиск действия авторизации (computed find)', () => {
        const initialState = { appellant: {}, participants: [] };
        const logic = useMultiComponentLogicOptions(initialState);

        // Нужно установить appealRows перед actions, так как они оба shallowRef
        logic.appealRows.value = [];

        logic.actions.value = [
            { key: 'submit_request', url: 'http://submit.com', label: 'Submit' },
            { key: 'auth', url: 'http://auth.com', label: 'Auth' },
            { key: 'logout', url: 'http://logout.com', label: 'Logout' },
        ];

        expect(logic.authAction.value).toBeDefined();
        expect(logic.authAction.value.key).toBe('auth');
        expect(logic.authAction.value.url).toBe('http://auth.com');
    });
});