<!-- (Вариант ДО миграции) -->
<!-- 
1. Дублирование состояния (State Duplication):
В data() присутствуют два похожих объекта: searchForm и filters.
searchForm — то, что ввел пользователь.
filters — то, что отправилось на сервер.
Это приводит к сложной синхронизации в методах handleSearch и handleChangePage. Это типичный антипаттерн "Single Source of Truth" нарушения.

2. Смешение ответственности (Mixed Concerns):
Компонент одновременно управляет:
Состоянием UI (загрузка, ошибки).
Состоянием формы.
Логикой пагинации.
Сетевыми запросами.
Любое изменение логики (например, изменение формата даты или способа пагинации) требует редактирования этого большого файла.

3. Отсутствие переиспользования:
Логика пагинации (currentRange, handleChangePage) и загрузки данных (loading, error, try-catch) копируется из компонента в компонент. В Options API сложно вынести это переиспользуемым образом без миксинов (которые имеют свои минусы).

4. Реактивность:
Весь объект entries является реактивным, включая большие массивы данных. В Vue 2 это может создавать лишние накладные расходы на наблюдение (observation) за большими списками. 
-->

<template>
    <div>
        <PageLoading v-if="page.loading" />
        <InfoState
            v-else-if="page.error"
            image-src="/img/error-placeholder.svg"
            title="Ошибка загрузки данных">
            {{ page.error }}
        </InfoState>
        <div v-else>
            <Stack :gap="4" direction="column">
                <!-- Фильтры -->
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
                        @click="handleSearch"
                    >
                        Найти
                    </BaseButton>
                </Card>
                <Spacer />

                <!-- Таблица -->
                <Table
                    v-if="page.ready"
                    with-borders
                    colored-rows
                    :rows="entries.data"
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
                <Stack v-if="page.ready" horizontal-align="space-between">
                    <TextTag color="secondary">
                        {{ currentRange }} из {{ entries.pagination.total }}
                    </TextTag>
                    <Pagination
                        v-if="entries.pagination.pages > 1"
                        show-go-to
                        :total="entries.pagination.pages"
                        :value="entries.pagination.page"
                        @input="handleChangePage"
                    />
                </Stack>
            </Stack>
        </div>
    </div>
</template>

<script>
// --- ЗАКОММЕНТИРОВАНО ДЛЯ ТЕСТА (файлы отсутствуют) ---
// import Card from '@/components/ui/Card';
// import PageLoading from '@/components/ui/PageLoading';
// import InfoState from '@/components/ui/InfoState';
// import Stack from '@/components/ui/Stack';
// import Spacer from '@/components/ui/Spacer';
// import InputText from '@/components/ui/InputText';
// import BaseButton from '@/components/ui/Button';
// import SelectComponent from '@/components/ui/Select';
// import Pagination from '@/components/ui/Pagination';
// import FormGroup from '@/components/ui/FormGroup';
// import Table from '@/components/ui/Table';
// import { TextTag } from '@/components/ui/Typography';
// import { StatusType } from '@/enums/StatusType';

// --- ОСТАВЛЕНО (нужно для логики) ---
import format from 'date-fns/format';
import { getLogEntries } from '@/api/activity-log';

// Заглушка для Enum, чтобы не падал шаблон
const StatusType = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE'
};

export default {
    components: {
        // Все компоненты убраны, так как импорты закомментированы.
        // В тесте мы будем использовать stubs (заглушки).
    },
    data() {
        return {
            StatusType, // Прокидываем заглушку enum в шаблон
            page: {
                loading: false,
                error: null,
                ready: false,
            },
            searchForm: {
                query: null,
                group: null,
            },
            // Дублирование состояния: searchForm хранит ввод, filters хранит примененные значения
            filters: {
                query: null,
                group: null,
            },
            entries: {
                pagination: {
                    total: 1,
                    per_page: 1,
                    pages: 1,
                    page: 1,
                },
                data: [],
            },
            columns: [
                { key: 'id', title: 'ID' },
                { key: 'name', title: 'ФИО' },
                { key: 'timestamp', title: 'Дата' },
                { key: 'status', title: 'Статус' },
            ],
            groupOptions: [],
        };
    },
    computed: {
        currentRange() {
            const { page, per_page, total } = this.entries.pagination;
            const start = ((page - 1) * per_page) + 1;
            const end = Math.min(page * per_page, total);
            return `${start}-${end}`;
        },
    },
    mounted() {
        this.handleSearch();
    },
    methods: {
        async loadEntries(params = {}) {
            this.page.loading = true;
            this.page.error = null;
            this.page.ready = false;

            try {
                const response = await getLogEntries({
                    page: this.entries.pagination.page,
                    group_id: this.filters.group,
                    search_query: this.filters.query,
                });

                this.entries.data = response.items;
                this.entries.pagination = response.pagination;
                this.groupOptions = [
                    { value: null, label: 'Все группы' },
                    ...response.filters.groups,
                ];

                this.page.ready = true;
            } catch (err) {
                this.page.error = err.message;
            } finally {
                this.page.loading = false;
            }
        },
        handleSearch() {
            this.entries.pagination.page = 1;
            // Перенос данных из формы в фильтры
            this.filters.query = this.searchForm.query;
            this.filters.group = this.searchForm.group;
            this.loadEntries();
        },
        handleChangePage(newPage) {
            this.entries.pagination.page = newPage;
            // Восстановление значений в форме при смене страницы (чтобы пользователь видел, по чем ищет)
            this.searchForm.query = this.filters.query || null;
            this.searchForm.group = this.filters.group || null;
            this.loadEntries();
        },
        formatDate(date) {
            return format(date, 'yyyy-MM-dd HH:mm:ss');
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