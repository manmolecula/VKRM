// Вся логика работы с данными (API, состояние, фильтры)
import { ref, shallowRef, computed } from 'vue';
import { getLogEntries } from '@/api/activity-log';
import format from 'date-fns/format';

export function useMigratedSingleComponentLogic() {
    // Состояние UI
    const isLoading = ref(false);
    const error = ref(null);
    const isReady = ref(false);

    // Данные (используем shallowRef для оптимизации больших списков)
    const entries = shallowRef([]);
    const pagination = ref({
        total: 1,
        per_page: 1,
        pages: 1,
        page: 1,
    });

    // Опции для селектов (вынесены из компонента)
    const groupOptions = ref([]);

    // Внутреннее состояние примененных фильтров
    const appliedFilters = ref({
        query: null,
        group: null,
    });

    // Вычисляемый диапазон для пагинации
    const currentRange = computed(() => {
        const { page, per_page, total } = pagination.value;
        const start = ((page - 1) * per_page) + 1;
        const end = Math.min(page * per_page, total);
        return `${start}-${end}`;
    });

    // Метод загрузки данных
    const fetchEntries = async () => {
        isLoading.value = true;
        error.value = null;
        isReady.value = false;

        try {
            const response = await getLogEntries({
                page: pagination.value.page,
                group_id: appliedFilters.value.group,
                search_query: appliedFilters.value.query,
            });

            // shallowRef требует присвоения нового значения для обновления
            entries.value = response.items;
            pagination.value = response.pagination;
            
            // Обновляем опции групп
            groupOptions.value = [
                { value: null, label: 'Все группы' },
                ...response.filters.groups,
            ];

            isReady.value = true;
        } catch (err) {
            error.value = err.message || 'Неизвестная ошибка';
        } finally {
            isLoading.value = false;
        }
    };

    // Обработчик поиска
    const handleSearch = (formData) => {
        pagination.value.page = 1; // Сброс пагинации при новом поиске
        appliedFilters.value = { ...formData }; // Фиксируем фильтры
        fetchEntries();
    };

    // Обработчик смены страницы
    const handleChangePage = (newPage) => {
        pagination.value.page = newPage;
        fetchEntries();
    };

    // Утилита форматирования
    const formatDate = (date) => {
        return format(new Date(date), 'yyyy-MM-dd HH:mm:ss');
    };

    return {
        // Состояния
        isLoading,
        error,
        isReady,
        entries,
        pagination,
        groupOptions,
        currentRange,
        
        // Методы
        handleSearch,
        handleChangePage,
        formatDate,
    };
}