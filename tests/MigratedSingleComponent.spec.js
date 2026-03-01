// tests/MigratedSingleComponent.spec.js
import { describe, it, expect, vi } from 'vitest'

// Путь изменился: теперь заходим в src
import { MigratedSingleComponent } from '../src/MigratedSingleComponent/composables/MigratedSingleComponent.js'

// Мокаем API (путь должен совпадать с тем, что в composable)
vi.mock('@/api/activity-log', () => ({
  getLogEntries: vi.fn(() => Promise.resolve({
    items: [
        { id: 99, name: 'Тестовая Запись', timestamp: Date.now(), status: 'ACTIVE' }
    ],
    pagination: { total: 1, per_page: 10, pages: 1, page: 1 },
    filters: { groups: [{ value: 'A', label: 'Группа А' }] }
  }))
}))

describe('Тестирование MigratedSingleComponent Composable', () => {
  it('Функция handleSearch должна обновлять entries', async () => {
    // 1. Вызываем функцию
    const { entries, isLoading, handleSearch } = MigratedSingleComponent()

    // 2. Проверяем начальное состояние
    expect(entries.value).toHaveLength(0)

    // 3. Вызываем поиск
    await handleSearch({ query: 'тест', group: null })

    // 4. Проверяем результат (данные из мока)
    expect(isLoading.value).toBe(false)
    expect(entries.value).toHaveLength(1)
    expect(entries.value[0].name).toBe('Тестовая Запись')
  })
})