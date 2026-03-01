// src/api/activity-log.js
// Это фейковая функция для тестов.
// В реальном приложении здесь был бы axios.get(...)
export const getLogEntries = async (params) => {
  console.log('API Mock called with:', params);
  return {
    items: [
        { id: 1, name: 'Тест из Мока', timestamp: Date.now(), status: 'ACTIVE' }
    ],
    pagination: { total: 1, per_page: 10, pages: 1, page: 1 },
    filters: { groups: [] }
  };
};