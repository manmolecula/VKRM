import { useMultiComponentLogic } from '../src/MigratedMultiComponent/composables/useMigratedMultiComponentLogic';
import { vi, describe, it, expect } from 'vitest';

// Мокаем API
vi.mock('../src/api', () => ({
    getDashboardData: vi.fn().mockResolvedValue({
        actions: [{ key: 'auth', url: 'http://test.com', label: 'Login' }],
        dates: [],
        materials: []
    }),
}));

describe('useMultiComponentLogic (Composable)', () => {
    
    it('Сценарий 1: Корректная фильтрация строк апелляций', () => {
        const initialState = { appellant: {}, participants: [] };
        const { appealFilter, filteredAppealRows, appealRows } = useMultiComponentLogic(initialState);

        appealRows.value = [
            { id: 1, examForm: 'Тип А', subject: 'Math' },
            { id: 2, examForm: 'Тип Б', subject: 'History' },
            { id: 3, examForm: 'Тип А', subject: 'Physics' },
        ];

        appealFilter.value = 'Тип А';

        expect(filteredAppealRows.value.length).toBe(2);
        expect(filteredAppealRows.value[0].subject).toBe('Math');
    });

    it('Сценарий 2: Вычисление цвета кнопки отправки (computed)', () => {
        const stateUnauthorized = { appellant: { isAuthorized: false } };
        const { submitButtonColor: color1 } = useMultiComponentLogic(stateUnauthorized);
        expect(color1.value).toBe('red');

        const stateAuthorized = { appellant: { isAuthorized: true } };
        const { submitButtonColor: color2 } = useMultiComponentLogic(stateAuthorized);
        expect(color2.value).toBe('blue');
    });
});