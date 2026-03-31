import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils' 
import SingleComponent from '@/SingleComponent.vue'

vi.mock('@/api/activity-log', () => ({
  getLogEntries: vi.fn()
}))

describe('SingleComponent.vue (Подход Vue 2 Options API)', () => {

  // ИНТЕГРАЦИОННЫЙ ПОДХОД: Требуется монтировать компонент и стабить все дочерние UI-элементы
  const REQUIRED_STUBS = {
    'PageLoading': true,
    'InfoState': true,
    'Stack': true,
    'Card': true,
    'FormGroup': true,
    'InputText': true,
    'SelectComponent': true,
    'BaseButton': true,
    'Table': true,
    'Pagination': true,
    'TextTag': true,
    'Spacer': true
  }

  // Мокаем глобальные свойства экземпляра ($t, $style), так как компонент от них зависит
  const REQUIRED_MOCKS = {
    $t: (key) => key,
    $style: { filterCard: 'mock-css-class' }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Сценарий 1: Успешная загрузка данных при монтировании', async () => {
    const { getLogEntries } = await import('@/api/activity-log')
    getLogEntries.mockResolvedValueOnce({
      items: [{ id: 1, name: 'Тест', timestamp: '2023-01-01', status: 'ACTIVE' }],
      pagination: { total: 1, per_page: 10, pages: 1, page: 1 },
      filters: { groups: [] }
    })

    // ИНТЕГРАЦИОННЫЙ ТЕСТ: Создаём экземпляр компонента с заглушками и моками
    const wrapper = mount(SingleComponent, {
      global: { stubs: REQUIRED_STUBS, mocks: REQUIRED_MOCKS }
    })

    // Ждём завершения всех асинхронных операций внутри компонента
    await flushPromises()

    // ПРОВЕРКА: Доступ к данным только через wrapper.vm, так как логика инкапсулирована в компоненте
    expect(wrapper.vm.page.ready).toBe(true)
    expect(wrapper.vm.page.loading).toBe(false)
    expect(wrapper.vm.entries.data).toHaveLength(1)
  })

  it('Сценарий 2: Обработка ошибки сети', async () => {
    const { getLogEntries } = await import('@/api/activity-log')
    getLogEntries.mockRejectedValueOnce(new Error('Сервер недоступен'))

    const wrapper = mount(SingleComponent, {
      global: { stubs: REQUIRED_STUBS, mocks: REQUIRED_MOCKS }
    })

    await flushPromises()

    // ПРОВЕРКА: Ошибка отражается в реактивном состоянии компонента
    expect(wrapper.vm.page.error).toBe('Сервер недоступен')
    expect(wrapper.vm.page.ready).toBe(false)
  })

  it('Сценарий 3: Вычисление диапазона пагинации (computed)', async () => {
    const { getLogEntries } = await import('@/api/activity-log')
    getLogEntries.mockResolvedValueOnce({
      items: [], pagination: { total: 55, per_page: 10, pages: 6, page: 1 }, filters: { groups: [] }
    })

    const wrapper = mount(SingleComponent, {
      global: { stubs: REQUIRED_STUBS, mocks: REQUIRED_MOCKS }
    })

    await flushPromises()

    // ПРОВЕРКА: computed-свойства доступны через wrapper.vm
    expect(wrapper.vm.currentRange).toBe('1-10')
    
    // Мутируем состояние напрямую — в Vue 2 это триггерит пересчёт computed
    wrapper.vm.entries.pagination.page = 6
    
    await wrapper.vm.$nextTick() 
    
    expect(wrapper.vm.currentRange).toBe('51-55')
  })
})