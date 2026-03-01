<!-- (Вариант ПОСЛЕ миграции) -->
 <!-- 
| Характеристика | Vue 2 (Options API) | Vue 3 (Composition API) |
| **Размер файла логики** | Весь код в одном файле (200+ строк) | Вынесено в `MigratedSingleComponent.js` (~100 строк) |
| **Переиспользование** | Копипаст методов `loadEntries` | Импорт функции `MigratedSingleComponent` |
| **Реактивность данных** | Глубокая (избыточная для таблиц) | `shallowRef` (оптимизация памяти) |
| **Читаемость** | `data()` разбросан, `methods` отдельно | Логика сгруппирована по смыслу в composable |
| **Тестируемость** | Нужен монтаж компонента | Можно тестировать `MigratedSingleComponent` изолированно | 
-->

<!-- 
«В ходе миграции компонента MigratedSingleComponent 
была применена стратегия извлечения логики (Logic Extraction).
Бизнес-логика взаимодействия с сервером и управление состоянием 
пагинации были инкапсулированы в композиционную функцию MigratedSingleComponent.
Это позволило использовать shallowRef для хранения массива записей,
что критически важно для высоконагруженных компонентов, так как снижает
нагрузку на сборщик мусора и инициализацию реактивности при больших
объемах данных. Компонент представления стал "тонким" и отвечает
только за рендеринг UI». 


Изолированность: Мы тестируем чистую бизнес-логику, а не "верстку и логику вместе".
Скорость: Тест запускается за миллисекунды, так как не нужно инициализировать Vue-компонент и виртуальный DOM.
Простота: Не нужно думать про wrapper.vm, mount, shallowMount. Работаем с чистыми переменными (ref.value).
-->


<template>
    <div>
        <PageLoading v-if="isLoading" />
        <InfoState
            v-else-if="error"
            image-src="/img/error-placeholder.svg"
            title="Ошибка загрузки данных">
            {{ error }}
        </InfoState>
        <div v-else>
            <Stack :gap="4" direction="column">
                <!-- Форма поиска -->
                <Card :class="$style.filterCard" borders>
                    <FormGroup label-layout="vertical" label="Поиск">
                        <InputText
                            v-model="searchForm.query"
                            fill
                            size="big"
                            placeholder="Введите запрос..."
                        />
                    </FormGroup>
                    <FormGroup label-layout="vertical" label="Группа">
                        <SelectComponent
                            v-model="searchForm.group"
                            fill
                            size="big"
                            placeholder="Выберите группу"
                            :options="groupOptions"
                        />
                    </FormGroup>
                    <BaseButton
                        fill
                        size="big"
                        color="blue"
                        @click="onSearchClick"
                    >
                        Найти
                    </BaseButton>
                </Card>
                <Spacer />

                <!-- Таблица -->
                <Table
                    v-if="isReady"
                    with-borders
                    colored-rows
                    :rows="entries"
                    :columns="columns">
                    <template #body-id="{ entry }">
                        {{ entry.id }}
                    </template>
                    <template #body-name="{ entry }">
                        {{ entry.name }}
                    </template>
                    <template #body-timestamp="{ entry }">
                        {{ formatDate(entry.timestamp) }}
                    </template>
                    <template #body-status="{ entry }">
                        <TextTag v-if="entry.status === StatusType.ACTIVE" color="green">
                            Активен
                        </TextTag>
                        <TextTag v-if="entry.status === StatusType.INACTIVE" color="tertiary">
                            Неактивен
                        </TextTag>
                    </template>
                </Table>

                <!-- Пагинация -->
                <Stack v-if="isReady" horizontal-align="space-between">
                    <TextTag color="secondary">
                        {{ currentRange }} из {{ pagination.total }}
                    </TextTag>
                    <Pagination
                        v-if="pagination.pages > 1"
                        show-go-to
                        :total="pagination.pages"
                        :value="pagination.page"
                        @input="handleChangePage"
                    />
                </Stack>
            </Stack>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

// Импорт UI-компонентов (полный список)
import Card from '@/components/ui/Card';
import PageLoading from '@/components/ui/PageLoading';
import InfoState from '@/components/ui/InfoState';
import Stack from '@/components/ui/Stack';
import Spacer from '@/components/ui/Spacer';
import InputText from '@/components/ui/InputText';
import BaseButton from '@/components/ui/Button';
import SelectComponent from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import FormGroup from '@/components/ui/FormGroup';
import Table from '@/components/ui/Table';
import { TextTag } from '@/components/ui/Typography';

// Импорт нашей логики (Composable)
import { MigratedSingleComponent } from './composables/MigratedSingleComponent';
// Импорт Enum
import { StatusType } from '@/enums/StatusType';

// 1. Инициализируем composable
// Получаем все необходимые реактивные переменные и методы из функции
const {
    isLoading,
    error,
    isReady,
    entries,
    pagination,
    groupOptions,
    currentRange,
    handleSearch,
    handleChangePage,
    formatDate
} = MigratedSingleComponent();

// 2. Локальное состояние формы
// Используем ref, так как в <script setup> нет объекта data()
const searchForm = ref({
    query: null,
    group: null,
});

// 3. Статические данные
// Колонки таблицы не являются реактивными данными, это конфигурация
const columns = [
    { key: 'id', title: 'ID' },
    { key: 'name', title: 'ФИО' },
    { key: 'timestamp', title: 'Дата' },
    { key: 'status', title: 'Статус' },
];

// 4. Методы-обертки (Wrapper methods)
// Связываем события шаблона с логикой composable
const onSearchClick = () => {
    // Передаем текущее состояние формы в функцию поиска
    handleSearch({
        query: searchForm.value.query,
        group: searchForm.value.group
    });
};

// 5. Lifecycle Hooks
// Если нужно выполнить поиск при загрузке (как в старой версии mounted)
onMounted(() => {
    handleSearch({ query: null, group: null }); 
});
</script>

<style lang="less" module>
.filterCard {
    display: grid;
    grid-template-columns: auto 220px 160px;
    gap: 16px;
    align-items: flex-end;
}
</style>