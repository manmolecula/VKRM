<!-- (Вариант ДО миграции) -->
<!-- 
1. Смешение ответственности (Mixed Concerns):
Компонент перегружен обязанностями (God Object). В одном файле смешаны:
- Управление сложным UI (модальные окна, контекстные меню, вкладки).
- Бизнес-логика (права доступа `canSubmitToTypeA`, фильтрация `filteredAppealRows`).
- Сетевые запросы и работа с Vuex (`mapState`, `mapActions`).
Это усложняет поддержку: изменение логики фильтрации может случайно сломать работу модальных окон.

2. Зависимость от глобального окружения (Global Window Dependency):
Прямое обращение к `window` объекту внутри `data()` (например, `window.appellant`, `window.participants`).
Это делает компонент жестко привязанным к конкретной среде выполнения.
Тестирование такого компонента требует сложного мокания глобального объекта `window`, что часто приводит к хрупким тестам.

3. "Раздутый" объект состояния (Bloated State):
Объект `data()` содержит более 20 полей, включая вложенные структуры для управления модальными окнами (`modals`) и конфигурациями таблиц.
Логика переключения видимости модалок (`modals.appealSubjects.visible = true`) разбросана по методам,
что затрудняет отслеживание состояния интерфейса.

4. Проблемы с Vuex (Tight Coupling):
Использование `mapState` и `mapActions` создает сильную связность с конкретным модулем стора (`dashboardStore`).
Компонент невозможно переиспользовать в другом контексте без подключения этого же стора.
Переход на Composition API позволяет абстрагировать источник данных.
-->

<template>
    <PageLoading v-if="isLoading" />
    <div v-else :key="eventsByMonths.length" class="dashboard-container">
        <!-- Секция подачи заявлений -->
        <section class="section-block">
            <Columns gutter="big" base-twelve>
                <Column v-if="!isSubmissionDeniedByVendor" :width="8">
                    <Stack
                        class="submission-panel" direction="column"
                        :gap="3"
                        :padding-size="5">
                        <Stack horizontal-align="space-between">
                            <EjText var="heading-2" class="submission-title">
                                Дистанционная подача заявок
                            </EjText>
                            <Button
                                v-if="authAction"
                                :color="submitButtonColor"
                                :href="authAction.url"
                                tag="a"
                                outline>
                                {{ authAction.label }}
                            </Button>
                        </Stack>
                        <Stack v-if="!authAction" vertical-align="flex-start" :gap="5">
                            <Stack
                                v-if="submitRequestActions.length"
                                class="submission-types" direction="column"
                                :gap="3"
                                :padding-size="5"
                                horizontal-align="flex-start">
                                Выберите одно из доступных действий и заполните форму:
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
                            </Stack>
                            <Stack
                                v-if="modalAction"
                                class="submission-types" direction="column"
                                :gap="3"
                                :padding-size="5"
                                horizontal-align="flex-start">
                                Выберите действие:
                                <Button
                                    color="blue"
                                    outline
                                    @click="modals.appealSubjects.visible = true">
                                Открыть список доступных предметов
                                </Button>
                            </Stack>
                        </Stack>
                    </Stack>
                </Column>
                <Column :width="4">
                    <Stack
                        v-if="!isLastRequestOnAppoint(lastSubmittedRequest)"
                        class="dates-panel"
                        direction="column"
                        :padding-size="5"
                        vertical-align="flex-start"
                        :gap="4"
                    >
                        <EjText var="heading-3" class="dates-title">
                            Даты приема заявок:
                        </EjText>
                        <Stack
                            direction="column"
                            :gap="3">
                            <InfoState
                                v-if="!submissionDates || !submissionDates.length"
                                title="Данные отсутствуют"
                                image-src="@/assets/img/empty.png"
                            />
                            <Stack
                                v-for="dateItem in submissionDates"
                                v-else
                                :key="dateItem.id" class="dates-list"
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
            <Columns class="cards-container" gutter="big" base-twelve>
                <Column v-if="!authAction" :width="8">
                    <Stack v-if="requestCards && requestCards.length" direction="column">
                        <Stack
                            direction="column" :gap="5">
                            <EjText var="heading-2" class="list-title">
                                Заявки
                            </EjText>
                            <Stack direction="column" :gap="4" fill>
                                <RequestCard
                                    v-for="(card, index) in requestCards" :key="index"
                                    :status="card.status"
                                    :comment="card.comment"
                                    :location="card.location"
                                    :date="card.date" />
                            </Stack>
                        </Stack>
                        <Spacer size="big" />
                        <Stack
                            v-if="appealCards && appealCards.length"
                            direction="column" :gap="5">
                            <EjText var="heading-2" class="appeal-list-title">
                                Апелляции
                            </EjText>
                            <Stack direction="column" :gap="4" fill>
                                <AppealCard
                                    v-for="(card, index) in appealCards" :key="index"
                                    :status="card.status"
                                    :comment="card.comment"
                                    :date="card.date"
                                    :pra-date="card.praDate"
                                    :pra-location="card.praLocation"
                                    :skk-date="card.skkDate"
                                    :skk-location="card.skkLocation"
                                    :verdict="card.verdict" />
                            </Stack>
                        </Stack>
                    </Stack>
                    <Stack v-else direction="column">
                        <EjText var="heading-2" class="list-title">
                            Заявки
                        </EjText>
                        <InfoState
                            title="Заявки отсутствуют"
                            image-src="@/assets/img/empty-list.png"
                        />
                    </Stack>
                </Column>
                <Column :width="4">
                    <Stack
                        v-if="(documents && documents.length) || canAddDocuments"
                        direction="column" :gap="5">
                        <EjText var="heading-2" class="document-title">
                            Полезные материалы
                        </EjText>
                        <Stack :padding-size="5" class="document-list">
                            <ul class="userful-materials">
                                <li v-for="doc in documents" :key="doc.id">
                                    <MaterialLink :material="doc" />
                                </li>
                            </ul>
                        </Stack>
                        <template v-if="canAddDocuments">
                            <Hr />
                            <Button color="green" @click="modals.materialsUploader = true">
                                Добавить материал
                            </Button>
                        </template>
                    </Stack>
                </Column>
            </Columns>
        </section>

        <!-- Модальные окна -->
        <ModalComponent
            :visible.sync="modals.appealSubjects.visible"
            :loading="modals.appealSubjects.loading"
            title="Доступные предметы для подачи заявления"
            :width="1050"
            :show-footer="false"
            :before-accept-hide="onSubmitPage">
            <Stack direction="column" :gap="5">
                Выберите экзамен
                <RadioGroup
                    v-model="appealFilter"
                    class="radio-group"
                    :options="appealFilterOptions"
                />
                <Table2
                    :columns="appealColumns"
                    :data="filteredAppealRows"
                    hide-footer>
                    <template #cell(examdate)="{ value }">
                        {{ formatDate(value) }}
                    </template>
                    <template #cell(submissiondates)="{ value }">
                        {{ formatDate(value.start) }}-{{ formatDate(value.end) }}
                    </template>
                    <template #cell(appealbutton)="{ value }">
                        <Button
                            color="blue"
                            tag="a"
                            target="_blank"
                            :href="`/submit-action?request_type=3${ value }`">
                            Подать
                        </Button>
                    </template>
                </Table2>
            </Stack>
        </ModalComponent>

        <ContextMenu
            :target="contextConfig.target"
            :visible.sync="contextConfig.show">
            <component
                :is="contextComponent"
                v-bind="contextProps">
                {{ contextConfig.content }}
            </component>
        </ContextMenu>

        <ContextMenu
            :target="scoreContextConfig.target"
            :visible.sync="scoreContextConfig.show"
            :closable="false"
            align-vertical="top"
            align-horizontal="left">
            <div>Балл: <b>{{ scoreContextConfig.primary_score }}</b></div>
        </ContextMenu>

        <WithdrawModal v-if="modals.withdrawAppeal" :visible.sync="modals.withdrawAppeal" @withdraw="withdrawAction" />
        <UploaderModal v-if="canAddDocuments" :visible.sync="modals.materialsUploader" />
        
        <AppealFormModal
            v-if="modals.attachAppeal"
            :id="attachingAppeal.id"
            :subject-id="attachingAppeal.subject_id"
            :title="attachingAppeal.subject_name"
            :visible.sync="modals.attachAppeal" />

        <ModalComponent
            :visible.sync="openModal"
            :scroll="'none'"
            :width="700"
            :show-header="false"
            :show-footer="true"
            :before-accept-hide="onSubmitPage"
            accept-button-text="Далее"
            white
        >
            <form-component
                class="modal-form"
                label-layout="vertical"
                layout="flow">
                <FormHeader>
                    Подача заявления {{ submittableTitle }}
                </FormHeader>
                <FormBody>
                    <form-group :cols="6" label="Тип экзамена">
                        <SelectComponent
                            v-model="checkedExamType"
                            :options="examTypeOptions"
                            fill
                        />
                    </form-group>
                    <Spacer />
                    <form-group :cols="6" label="Заявитель">
                        <div class="form-control-centered">
                            {{ applicantData.fio }}
                        </div>
                    </form-group>
                    <form-group :cols="6" label="Участник">
                        <SelectComponent
                            v-model="checkedParticipant"
                            :options="participantOptions"
                            fill
                        />
                    </form-group>
                </FormBody>
            </form-component>
        </ModalComponent>
    </div>
</template>

<script>
import {
    mapActions, mapGetters, mapMutations, mapState,
} from 'vuex';

import parseISO from 'date-fns/parseISO';
import format from 'date-fns/format';
import isValid from 'date-fns/isValid';

import { cancelRequest, getDashboardData } from '@/api';

// --- ЗАКОММЕНТИРОВАНО ДЛЯ ТЕСТА (файлы отсутствуют) ---
// import PageLoading from '@/components/page-loading';
// import Button from '@/components/button';
// import Columns from '@/components/columns';
// import Column from '@/components/column';
// import Table2 from '@/components/table2';
// import Spacer from '@/components/spacer';
// import Hr from '@/components/hr';
// import Stack from '@/components/stack';
// import RadioGroup from '@/components/radio-group';
// import AppealFormModal from './AppealFormModal.vue';
// import RequestCard from './RequestCard.vue';
// import AppealCard from './AppealCard.vue';
// import SelectComponent from '@/components/select';
// import FormComponent from '@/components/form';
// import FormGroup from '@/components/form-group';
// import FormHeader from '@/components/form-header';
// import FormBody from '@/components/form-body';
// import ModalComponent from '@/components/modal';
// import { EjText } from '@/components/typography';
// import InfoState from '@/components/info-state';
// import MaterialsUploader from './MaterialsUploader';
// import WithdrawModal from './WithdrawModal';
// import MaterialLink from './MaterialLink';
// import { REQUEST_TYPES } from './consts';

// --- ОСТАВЛЕНО (нужно для логики) ---
// getDashboardData и cancelRequest импортируются выше из @/api

export default {
    name: 'MultiComponent',
    components: {
        // Все компоненты убраны, так как импорты закомментированы.
        // В тесте мы будем использовать stubs (заглушки).
    },
    data() {
        return {
            requestCards: [],

            currentDateTimestamp: (new Date()).getTime(),
            isLoading: true,
            isWithdrawLoading: false,
            withdrawId: null,
            isSubmissionDeniedByVendor: window.isSubmissionDeniedByVendor || false,
            isActivePeriod: window.isActivePeriod || false,
            canAddDocuments: window.canAddDocuments || false,
            appellant: window.appellant || {},
            lastSubmittedRequest: window.lastSubmittedRequest || false,

            actions: null,
            submissionDates: null,
            documents: null,

            attachingAppeal: null,

            contextConfig: {
                content: null,
                show: false,
                target: null,
                type: null,
            },

            scoreContextConfig: {
                primary_score: null,
                show: false,
                target: null,
            },

            modals: {
                materialsUploader: false,
                withdrawAppeal: false,
                attachAppeal: false,
                appealSubjects: {
                    visible: false,
                    loading: false,
                    error: null,
                },
            },

            submittableTitle: null,
            openModal: false,
            blockParticipantSelect: false,
            participantIsEmpty: false,
            currentExam: null,

            checkedParticipant: '',
            checkedExamType: '',
            currentParticipant: '',

            applicantData: window.applicantData || {},
            participants: window.participants || {},
            examTypes: window.examTypes || {},

            appealFilter: 'all',
            appealColumns: [
                {
                    code: 'examdate', field: 'examDate', label: 'Дата', nowrap: true,
                },
                {
                    code: 'examform', field: 'examForm', label: 'Форма', nowrap: true,
                },
                {
                    code: 'examsubject', field: 'examSubject', label: 'Предмет', nowrap: true,
                },
                {
                    code: 'submissiondates', field: 'submissionDates', label: 'Даты подачи', nowrap: true,
                },
                {
                    code: 'appealbutton', field: 'appealButton',
                },
            ],
            appealRows: [],
        };
    },
    computed: {
        ...mapState('dashboardStore', [
            'eventTypesMenu',
            'stages',
            'stageNameMap',
            'activeTypesByStages',
            'scheduleResults',
            'userAppeals',
        ]),
        ...mapGetters('dashboardStore', ['eventsByMonths', 'months']),

        filteredAppealRows() {
            if (this.appealFilter === 'all') {
                return this.appealRows;
            }
            return this.appealRows.filter(row => row.examForm === this.appealFilter);
        },

        appealFilterOptions() {
            let exams11 = [
                {
                    key: 1,
                    label: 'Тип А',
                    value: 'Тип А',
                },
                {
                    key: 2,
                    label: 'Тип Б',
                    value: 'Тип Б',
                },
            ];
            return [
                {
                    key: 0,
                    label: 'Все',
                    value: 'all',
                },
                ...exams11
            ];
        },

        contextComponent() {
            switch (this.contextConfig.type) {
                case 'list':
                    return 'ListComponent'; 
                default:
                    return 'div';
            }
        },

        contextProps() {
            switch (this.contextConfig.type) {
                case 'list':
                    return {
                        list: this.contextConfig.content,
                    };
                default:
                    return {};
            }
        },

        authAction() {
            if (!this.actions || !Array.isArray(this.actions)) return null;
            return this.actions.find(action => action.key === 'auth');
        },

        modalAction() {
            if (!this.actions || !Array.isArray(this.actions)) return null;
            return this.actions.find(action => action.key === 'modal_action');
        },

        submitRequestActions() {
            if (!this.actions || !Array.isArray(this.actions)) return [];
            return this.actions.filter(action => action.key === 'submit_request');
        },

        canSubmitToTypeA() {
            return this.appellant?.canSubmitToTypeA === true;
        },

        isAuthorized() {
            return this.appellant?.isAuthorized === true;
        },

        submitButtonColor() {
            return !this.appellant.isAuthorized ? 'red' : 'blue';
        },

        participantOptions() {
            return this.participants.map(item => ({
                label: item.fio,
                value: item.id,
            }));
        },
        examTypeOptions() {
            return this.examTypes.map(type => ({
                label: type.name,
                value: type.key,
            }));
        },
    },

    async created() {
        await this.init();
        await this.loadDashboardData();
        this.isLoading = false;
        if (this.participants.length) {
            this.currentParticipant = this.participants[0].id;
        }
    },

    methods: {
        ...mapActions('dashboardStore', ['init']),
        ...mapMutations('dashboardStore', ['toggleTypeActive']),

        async loadDashboardData() {
            try {
                let data = await getDashboardData();
                this.actions = data.actions;
                this.submissionDates = data.dates;
                this.documents = data.materials;
            } catch (e) {
                console.error(e);
            }
        },

        formatDate(date) {
            let parsed = parseISO(date);
            return isValid(parsed) ? format(parsed, 'dd.MM.yyyy') : '';
        },

        isLastRequestOnAppoint(lastRequest) {
            if (!lastRequest) {
                return false;
            }
            return lastRequest.isOnAppoint;
        },

        async withdrawAction(fileObject = null) {
            this.isWithdrawLoading = true;
            let response;
            try {
                response = await cancelRequest({
                    requestId: this.withdrawId,
                    file: fileObject,
                });
            } catch (error) {
                response = error;
            }

            if (response?.res === true) {
                document.location.reload();
            } else {
                let errorMessage = response?.error || 'Ошибка операции';
                this.$alert(errorMessage, true);
            }

            this.isWithdrawLoading = false;
        },

        attachAppeal(appeal) {
            this.modals.attachAppeal = true;
            this.attachingAppeal = appeal;
        },

        onSubmitPage() {
            if (this.checkedParticipant === '' || this.checkedExamType === '') {
                this.$alert('Заполните все поля');
                return;
            }
            let options = {
                exam_type: this.checkedExamType,
                participant: this.checkedParticipant,
            };
            let link = this.getLink(options);
            window.open(link, '_blank');
        },
        getLink(options = {}) {
            return `/submit-action?type=${options.exam_type}&user=${options.participant}`;
        },
    },
};
</script>

<style lang="less" module>
.dashboard-container {
    padding: 20px;
}

.submission-panel {
    border-radius: 16px;
    background-color: #f5f5f5;
}

.submission-title,
.dates-title,
.document-title,
.list-title,
.appeal-list-title {
    color: #333;
}

.submission-types,
.dates-list {
    border-radius: 8px;
    background-color: #FFFFFF;
}

.dates-panel {
    border-radius: 16px;
    background-color: #f5f5f5;
    height: 100%;
}

.dates-list {
    padding: 0 10px !important;
}

.dates-period {
    font-size: 12px;
    color: #999;
}

.document-list {
    border: 1px solid #eee;
    border-radius: 16px;
}

.cards-container {
    display: flex;
    justify-content: flex-end;
}

.modal-form {
    max-width: 820px;
}

.section-block {
    margin: 50px 0;
}

.userful-materials {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.radio-group {
    display: flex !important;
    gap: 20px !important;
}

.form-control-centered {
    display: flex;
    align-items: center;
}
</style>