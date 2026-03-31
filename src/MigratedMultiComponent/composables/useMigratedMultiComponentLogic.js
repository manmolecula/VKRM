import { ref, shallowRef, computed } from 'vue';
// import { useStore } from 'vuex'; // УБРАНО: Избавились от жесткой связности
import { getDashboardData } from '@/api';
import { parseISO, format, isValid } from 'date-fns';

// Утилита
const formatDate = (date) => {
    const parsed = parseISO(date);
    return isValid(parsed) ? format(parsed, 'dd.MM.yyyy') : '';
};

export function useMultiComponentLogic(initialState = {}) {

    // --- State ---
    const isLoading = ref(true);

    // ОПТИМИЗАЦИЯ: Использование shallowRef для больших списков данных.
    // Vue не будет рекурсивно обходить элементы массивов, экономя память и CPU.
    const requestCards = shallowRef([]);
    const appealCards = shallowRef([]);
    const submissionDates = shallowRef([]);
    const documents = shallowRef([]);
    const appealRows = shallowRef([]);
    
    // Обычный ref для небольших конфигураций
    const actions = ref([]);
    const participants = ref(initialState.participants || []);
    
    const appellant = ref(initialState.appellant || {});
    
    const modals = ref({
        materialsUploader: false,
        withdrawAppeal: false,
        attachAppeal: false,
        appealSubjects: { visible: false, loading: false, error: null },
    });

    const appealFilter = ref('all');
    const checkedParticipant = ref('');
    const checkedExamType = ref('');

    // --- Computed ---
    const filteredAppealRows = computed(() => {
        if (appealFilter.value === 'all') {
            return appealRows.value;
        }
        return appealRows.value.filter(row => row.examForm === appealFilter.value);
    });

    const authAction = computed(() => {
        if (!actions.value || !Array.isArray(actions.value)) return null;
        return actions.value.find(action => action.key === 'auth');
    });

    const submitRequestActions = computed(() => {
        if (!actions.value || !Array.isArray(actions.value)) return [];
        return actions.value.filter(action => action.key === 'submit_request');
    });

    const submitButtonColor = computed(() => {
        return !appellant.value.isAuthorized ? 'red' : 'blue';
    });

    const participantOptions = computed(() => {
        return participants.value.map(item => ({
            label: item.fio,
            value: item.id,
        }));
    });

    // --- Methods ---
    
    // Замена хука created() и вызовов Vuex
    async function initialize() {
        isLoading.value = true;
        try {
            const data = await getDashboardData();
            
            // ВАЖНО: При использовании shallowRef нужно перезаписывать ссылку целиком (.value = ...),
            // а не мутировать массив (push/splice), иначе реактивность не сработает.
            actions.value = data.actions || [];
            submissionDates.value = data.dates || [];
            documents.value = data.materials || [];
            
            // В реальном приложении здесь мог бы быть вызов стора:
            // const store = useStore();
            // await store.dispatch('dashboardStore/init');
        } catch (e) {
            console.error(e);
        } finally {
            isLoading.value = false;
        }
    }

    // Инкапсуляция управления состоянием UI (вместо прямой мутации в шаблоне)
    function openSubmissionModal() {
        modals.value.appealSubjects.visible = true;
    }

    return {
        // State
        isLoading,
        requestCards,
        appealCards,
        modals,
        appealFilter,
        appealRows,
        submissionDates,
        documents,
        
        // Computed
        filteredAppealRows,
        authAction,
        submitRequestActions,
        submitButtonColor,
        participantOptions,
        
        // Methods
        formatDate,
        initialize,
        openSubmissionModal
    };
}