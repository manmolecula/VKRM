import { describe, it, expect, vi, beforeEach } from 'vitest'

// Импортируем ТОЛЬКО чистую логику. Сам Vue компонент здесь не участвует!
import { useMigratedSingleComponentLogic } from '@/MigratedSingleComponent/composables/useMigratedSingleComponentLogic.js'

// Гибкий мок API
vi.mock('@/api/activity-log', () => ({
  getLogEntries: vi.fn()
}))

describe('useMigratedSingleComponentLogic (Подход Vue 3 Composition API)', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Сценарий 1: Успешная загрузка данных по запросу', async () => {
    const { getLogEntries } = await import('@/api/activity-log')
    getLogEntries.mockResolvedValueOnce({
      items: [{ id: 1, name: 'Тест', timestamp: '2023-01-01', status: 'ACTIVE' }],
      pagination: { total: 1, per_page: 10, pages: 1, page: 1 },
      filters: { groups: [{ value: 'A', label: 'Группа А' }] }
    })

    // МОДУЛЬНЫЙ ПОДХОД: Просто вызываем функцию. Нет создания DOM, нет заглушек UI.
    const { entries, isLoading, isReady, handleSearch } = useMigratedSingleComponentLogic()

    expect(entries.value).toHaveLength(0)

    // Вызываем метод напрямую и нативно awaited ждем результат
    await handleSearch({ query: 'тест', group: null })

    // ПРОВЕРКА: Обращаемся к переменным напрямую, без wrapper.vm
    expect(isLoading.value).toBe(false)
    expect(isReady.value).toBe(true)
    expect(entries.value).toHaveLength(1)
    expect(entries.value[0].name).toBe('Тест')
  })

  it('Сценарий 2: Обработка ошибки сети', async () => {
    const { getLogEntries } = await import('@/api/activity-log')
    getLogEntries.mockRejectedValueOnce(new Error('Сервер недоступен'))

    const { error, isReady, handleSearch } = useMigratedSingleComponentLogic()

    await handleSearch({ query: null, group: null })

    // ПРОВЕРКА: Максимально читаемо
    expect(error.value).toBe('Сервер недоступен')
    expect(isReady.value).toBe(false)
  })

  it('Сценарий 3: Вычисление диапазона пагинации (computed)', async () => {
    const { getLogEntries } = await import('@/api/activity-log')
    getLogEntries.mockResolvedValueOnce({
      items: [], pagination: { total: 55, per_page: 10, pages: 6, page: 1 }, filters: { groups: [] }
    })

    const { pagination, currentRange, handleChangePage } = useMigratedSingleComponentLogic()

    // Инициализируем стейт
    await handleChangePage(1)

    // ПРОВЕРКА: Обычная проверка JS значения
    expect(currentRange.value).toBe('1-10')

    // Имитируем смену страницы (просто меняем реактивную переменную)
    pagination.value.page = 6
    // Вычисляемые свойства в Vue 3 обновляются синхронно при изменении зависимостей
    expect(currentRange.value).toBe('51-55')
  })
})