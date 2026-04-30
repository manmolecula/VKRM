<!-- (Вариант миграции с вынесением логики в composable, но с сохранением Options API) -->
<!--
Этот компонент демонстрирует промежуточный подход:
- Логика вынесена в переиспользуемый composable (как в Composition API)
- Но компонент использует Options API (export default { ... })
- Это позволяет сравнить: достаточно ли вынести логику, или Composition API дает дополнительные преимущества

Сравнение подходов:
| Характеристика | SingleComponent (Vue 2) | MigratedSingleComponent (Vue 3 + Options) | MigratedSingleComponent (Vue 3 + Composition) |
| **Размер файла** | Весь код в одном файле (~230 строк) | Логика вынесена (~140 строк в компоненте) | Логика вынесена (~175 строк в компоненте) |
| **Переиспользование** | Копипаст методов | Импорт функции useActivityLogLogic | Импорт функции useMigratedSingleComponentLogic |
| **Реактивность данных** | Глубокая (избыточная) | shallowRef (оптимизация) | shallowRef (оптимизация) |
| **Читаемость** | data() разбросан, methods отдельно | Логика в composable, компонент чище | Логика в composable, setup() явный |
| **Тестируемость** | Нужен монтаж компонента | Можно тестировать composable изолированно | Можно тестировать composable изолированно |
| **Синтаксис** | this.entries, this.methods | this.entries через деструктуризацию | Прямые ref.value |
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

<script>
// Импорт UI-компонентов (Options API стиль)
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
import { StatusType } from '@/enums/StatusType';

// Импорт composable с бизнес-логикой
import { useActivityLogLogic } from './composables/useActivityLogLogic';

export default {
    components: {
        Card,
        PageLoading,
        InfoState,
        Stack,
        Spacer,
        InputText,
        BaseButton,
        SelectComponent,
        Pagination,
        FormGroup,
        Table,
        TextTag,
    },

    // Внедряем composable в Options API через данные
    // Это ключевое отличие от Composition API - мы должны связать reactive данные с options
    data() {
        // Инициализируем composable один раз для экземпляра компонента
        const logic = useActivityLogLogic();

        return {
            StatusType,
            // Деструктурируем состояния из composable
            isLoading: logic.isLoading,
            error: logic.error,
            isReady: logic.isReady,
            entries: logic.entries,
            pagination: logic.pagination,
            groupOptions: logic.groupOptions,
            currentRange: logic.currentRange,

            // Локальное состояние формы (остается в компоненте)
            searchForm: {
                query: null,
                group: null,
            },

            // Статические данные (колонки таблицы)
            columns: [
                { key: 'id', title: 'ID' },
                { key: 'name', title: 'ФИО' },
                { key: 'timestamp', title: 'Дата' },
                { key: 'status', title: 'Статус' },
            ],

            // Сохраняем ссылки на методы из composable
            _logic: logic,
        };
    },

    mounted() {
        // Вызываем initial загрузку
        this._logic.handleSearch({ query: null, group: null });
    },

    methods: {
        // Методы-обертки для вызова логики из composable
        onSearchClick() {
            this._logic.handleSearch({
                query: this.searchForm.query,
                group: this.searchForm.group
            });
        },

        handleChangePage(newPage) {
            this._logic.handleChangePage(newPage);
        },

        formatDate(date) {
            return this._logic.formatDate(date);
        },
    },
};
</script>

<style lang="less" module>
.filterCard {
    display: grid;
    grid-template-columns: auto 220px 160px;
    gap: 16px;
    align-items: flex-end;
}
</style>