// tests/SingleComponent.spec.js
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SingleComponent from '@/SingleComponent.vue'

// 1. Мокаем API (должно быть ДО тестов)
vi.mock('@/api/activity-log', () => ({
  getLogEntries: vi.fn(() => Promise.resolve({
    items: [
        { id: 1, name: 'Старый Тест', timestamp: Date.now(), status: 'ACTIVE' }
    ],
    pagination: { total: 1, per_page: 10, pages: 1, page: 1 },
    filters: { groups: [] }
  }))
}))

describe('Тестирование SingleComponent (Vue 2)', () => {
  it('должен загрузить данные (тяжелый тест)', async () => {
    // 2. МОНТИРОВАНИЕ: Настройка окружения (внутри теста)
    const wrapper = mount(SingleComponent, {
      global: {
        // Полный список заглушек, чтобы убрать warnings
        stubs: {
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
        },
        mocks: {
          $t: (key) => key,      // Мок перевода
          $style: { filterCard: 'css-class-mock' } // Мок CSS модулей
        }
      }
    })

    // 3. Ждем завершения промиса в mounted
    // Используем небольшую задержку, так как метод асинхронный
    await new Promise(r => setTimeout(r, 100))
    
    // 4. ПРОВЕРКА: Лезем в "внутренности" через wrapper.vm
    expect(wrapper.vm.page.ready).toBe(true)
    expect(wrapper.vm.entries.data).toHaveLength(1)
    
    console.log('Тест Vue 2 прошел, но потребовал много настроек')
  })
})