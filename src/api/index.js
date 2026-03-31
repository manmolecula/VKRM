// Агрегируем все API методы здесь
import { getLogEntries } from './activity-log';

// Добавляем методы, нужные для MultiComponent
export const getDashboardData = async () => {
    // Мок-ответ для тестов и работы
    return {
        actions: [
            { key: 'auth', url: '/auth', label: 'Войти' }
        ],
        dates: [
            { id: 1, name: 'Основной этап', dateFrom: '01.06', dateTo: '20.06' }
        ],
        materials: []
    };
};

export const cancelRequest = async (payload) => {
    console.log('Cancel request mock', payload);
    return { res: true };
};

export { getLogEntries };