<!-- (Вариант ПОСЛЕ миграции) -->
<!-- 
| Характеристика | Vue 2 (Options API) | Vue 3 (Composition API) |
| **Размер файла компонента** | Весь код в одном файле (450+ строк) | Тонкий view-слой (~100 строк) |
| **Управление состоянием** | Смешение local data, Vuex (mapState) и window | Инкапсуляция в `useMultiComponentLogic` |
| **Тестируемость** | Нужен mount + моки Vuex + моки DOM | Тестируется чистая JS-логика фильтрации |
-->

<template>
    <PageLoading v-if="isLoading" />
    <div v-else class="dashboard-container">
        <!-- Секция подачи заявлений -->
        <section class="section-block">
            <Columns gutter="big" base-twelve>
                <Column :width="8">
                    <Stack class="submission-panel" direction="column" :gap="3" :padding-size="5">
                        <Stack horizontal-align="space-between">
                            <EjText var="heading-2">Дистанционная подача заявок</EjText>
                            <Button
                                v-if="authAction"
                                :color="submitButtonColor"
                                :href="authAction.url"
                                tag="a"
                                outline>
                                {{ authAction.label }}
                            </Button>
                        </Stack>
                        
                        <!-- Кнопки действий -->
                        <Stack v-if="!authAction" vertical-align="flex-start" :gap="5">
                            <Stack direction="column" :gap="2">
                                <Button
                                    v-for="(action, index) in submitRequestActions"
                                    :key="index"
                                    color="blue"
                                    outline
                                    tag="a"
                                    target="_blank"
                                    :href="action.url">
                                    {{ action.label }}
                                </Button>
                            </Stack>
                            <Button color="blue" outline @click="openSubmissionModal">
                                Открыть список доступных предметов
                            </Button>
                        </Stack>
                    </Stack>
                </Column>
                
                <!-- Правая колонка с датами -->
                <Column :width="4">
                    <Stack class="dates-panel" direction="column" :padding-size="5">
                        <EjText var="heading-3">Даты приема заявок:</EjText>
                        <Stack direction="column" :gap="3">
                            <Stack 
                                v-for="dateItem in submissionDates" 
                                :key="dateItem.id" 
                                horizontal-align="space-between">
                                <p>{{ dateItem.name }}</p>
                                <p class="dates-period">
                                    {{ dateItem.dateFrom }} - {{ dateItem.dateTo }}
                                </p>
                            </Stack>
                        </Stack>
                    </Stack>
                </Column>
            </Columns>
        </section>

        <!-- Модальные окна (упрощено для демонстрации) -->
        <ModalComponent
            :visible.sync="modals.appealSubjects.visible"
            title="Доступные предметы"
            :show-footer="false">
            <Stack direction="column" :gap="5">
                <RadioGroup v-model="appealFilter" :options="filterOptions" />
                <Table2 :columns="appealColumns" :data="filteredAppealRows" hide-footer>
                    <template #cell(examdate)="{ value }">
                        {{ formatDate(value) }}
                    </template>
                </Table2>
            </Stack>
        </ModalComponent>
    </div>
</template>

<script setup>
import { onMounted } from 'vue'; // ДОБАВЛЕНО для хука жизненного цикла
import { useMultiComponentLogic } from './composables/useMultiComponentLogic';

// Импорт UI-компонентов
import PageLoading from '@/components/page-loading';
import Columns from '@/components/columns';
import Column from '@/components/column';
import Stack from '@/components/stack';
import Button from '@/components/button';
import EjText from '@/components/typography';
import ModalComponent from '@/components/modal';
import Table2 from '@/components/table2';
import RadioGroup from '@/components/radio-group';

// 1. Инициализация контекста (Dependency Injection)
// В реальном приложении эти данные могли бы приходить через Props или Provide/Inject
const initialState = {
    appellant: window.appellant || {},
    participants: window.participants || [],
};

// 2. Вся бизнес-логика инкапсулирована в composable
const {
    isLoading,
    submissionDates,
    modals,
    appealFilter,
    filteredAppealRows,
    authAction,
    submitRequestActions,
    submitButtonColor,
    formatDate,
    openSubmissionModal,
    initialize, // ДОБАВЛЕНО
} = useMultiComponentLogic(initialState);

// 3. Статичные данные для представления (не зависят от бизнес-логики)
const filterOptions = [
    { label: 'Все', value: 'all' },
    { label: 'Тип А', value: 'Тип А' },
];
const appealColumns = [
    { code: 'examdate', field: 'examDate', label: 'Дата' },
    { code: 'examsubject', field: 'examSubject', label: 'Предмет' },
];

// 4. Жизненный цикл (замена хуков created/mounted)
onMounted(() => {
    initialize();
});
</script>

<style lang="less" module>
.dashboard-container { padding: 20px; }
.submission-panel { background: #f5f5f5; border-radius: 16px; }
.dates-panel { background: #f5f5f5; border-radius: 16px; }
.dates-period { font-size: 12px; color: #999; }
.section-block { margin: 50px 0; }
</style>