import { describe, it, expect, vi } from 'vitest'

// Используем @. Путь: @ (=src) -> MigratedSingleComponent -> composables -> файл
import { useMigratedSingleComponentLogic } from '@/MigratedSingleComponent/composables/useMigratedSingleComponentLogic.js'

// Мокаем API
vi.mock('@/api/activity-log', () => ({
  getLogEntries: vi.fn(() => Promise.resolve({
    items: [
        { id: 99, name: 'Тестовая Запись', timestamp: Date.now(), status: 'ACTIVE' }
    ],
    pagination: { total: 1, per_page: 10, pages: 1, page: 1 },
    filters: { groups: [{ value: 'A', label: 'Группа А' }] }
  }))
}))

describe('Тестирование useMigratedSingleComponentLogic', () => {
  it('Функция handleSearch должна обновлять entries', async () => {
    // ИЗМЕНЕНО: Вызов новой функции
    const { entries, isLoading, handleSearch } = useMigratedSingleComponentLogic()

    expect(entries.value).toHaveLength(0)

    await handleSearch({ query: 'тест', group: null })

    expect(isLoading.value).toBe(false)
    expect(entries.value).toHaveLength(1)
    expect(entries.value[0].name).toBe('Тестовая Запись')
  })
})