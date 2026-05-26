const token = new URLSearchParams(window.location.search).get('token') || '';
const state = {
    session: null,
    draftJobs: {
        first: {},
        second: {}
    }
};
const logos = {
    lol: '/assets/lol/lol_00_logo.png',
    ow: '/assets/ow/ow_00_logo.png',
    ff14: '/assets/ff14/ff14_00_logo.png'
};

const elements = {
    loadingView: document.querySelector('#loadingView'),
    errorView: document.querySelector('#errorView'),
    errorText: document.querySelector('#errorText'),
    createView: document.querySelector('#createView'),
    manageView: document.querySelector('#manageView'),
    gameLogo: document.querySelector('#gameLogo'),
    pageTitle: document.querySelector('#pageTitle'),
    statusBadge: document.querySelector('#statusBadge'),
    notice: document.querySelector('#notice'),
    createForm: document.querySelector('#createForm'),
    createContentField: document.querySelector('#createContentField'),
    createContent: document.querySelector('#createContent'),
    createDatetime: document.querySelector('#createDatetime'),
    eventTitle: document.querySelector('#eventTitle'),
    eventDatetime: document.querySelector('#eventDatetime'),
    eventDetails: document.querySelector('#eventDetails'),
    capacityText: document.querySelector('#capacityText'),
    roster: document.querySelector('#roster'),
    joinForm: document.querySelector('#joinForm'),
    preferenceFields: document.querySelector('#preferenceFields'),
    firstChoices: document.querySelector('#firstChoices'),
    firstJobField: document.querySelector('#firstJobField'),
    firstJobChoice: document.querySelector('#firstJobChoice'),
    firstJobIcon: document.querySelector('#firstJobIcon'),
    fixedChoice: document.querySelector('#fixedChoice'),
    secondChoices: document.querySelector('#secondChoices'),
    secondJobField: document.querySelector('#secondJobField'),
    secondJobChoice: document.querySelector('#secondJobChoice'),
    secondJobIcon: document.querySelector('#secondJobIcon'),
    joinButton: document.querySelector('#joinButton'),
    leaveButton: document.querySelector('#leaveButton'),
    editForm: document.querySelector('#editForm'),
    editContentField: document.querySelector('#editContentField'),
    editContent: document.querySelector('#editContent'),
    editDatetime: document.querySelector('#editDatetime'),
    editDetails: document.querySelector('#editDetails'),
    closeButton: document.querySelector('#closeButton')
};

boot();

async function boot() {
    bindEvents();

    if (!token) {
        showFatalError('リンクが正しくありません。Discordから開き直してください。');
        return;
    }

    try {
        state.session = await request(`/api/act/session?token=${encodeURIComponent(token)}`);
        render();
    } catch (error) {
        showFatalError(error.message);
    }
}

function bindEvents() {
    elements.createForm.addEventListener('submit', createAct);
    elements.joinForm.addEventListener('submit', saveParticipation);
    elements.leaveButton.addEventListener('click', leaveParticipation);
    elements.editForm.addEventListener('submit', editAct);
    elements.closeButton.addEventListener('click', toggleClosed);
    elements.fixedChoice.addEventListener('change', updatePreferenceControls);
    elements.firstChoices.addEventListener('change', updatePreferenceControls);
    elements.secondChoices.addEventListener('change', updatePreferenceControls);
    elements.firstJobChoice.addEventListener('change', function() {
        rememberJobSelection('first', elements.firstJobChoice);
        updateJobIcon(elements.firstJobChoice, elements.firstJobIcon, state.session.party.preference.jobsByRole);
    });
    elements.secondJobChoice.addEventListener('change', function() {
        rememberJobSelection('second', elements.secondJobChoice);
        updateJobIcon(elements.secondJobChoice, elements.secondJobIcon, state.session.party.preference.jobsByRole);
    });
}

function render() {
    elements.loadingView.classList.add('hidden');
    elements.errorView.classList.add('hidden');

    if (state.session.kind === 'create') {
        renderCreate();
        return;
    }

    renderManage();
}

function renderCreate() {
    const session = state.session;

    setHeader(session.game, session.modeLabel, '');
    elements.createView.classList.remove('hidden');
    elements.manageView.classList.add('hidden');
    elements.createContentField.classList.toggle('hidden', session.game !== 'ff14');
    elements.createContent.required = session.game === 'ff14';
    elements.createDatetime.value = toDateTimeLocalInput(session.defaultDatetime);
}

function renderManage() {
    const session = state.session;
    const party = session.party;
    const joinedCount = party.preference
        ? party.preference.participants.length
        : party.participants.length;

    setHeader(party.game, party.title, session.isClosed ? '締切' : '募集中');
    elements.createView.classList.add('hidden');
    elements.manageView.classList.remove('hidden');
    elements.eventTitle.textContent = party.title;
    elements.eventDatetime.textContent = `日時: ${party.datetime}`;
    elements.eventDetails.textContent = `詳細: ${party.details}`;
    elements.capacityText.textContent = `${joinedCount} / ${party.maxParticipants}`;
    renderRoster(party, session);
    renderJoinForm(party, session);
    renderEditForm(party, session);
}

function setHeader(game, title, status) {
    elements.pageTitle.textContent = title;
    elements.gameLogo.src = logos[game];
    elements.gameLogo.alt = `${game} logo`;
    elements.gameLogo.classList.add('visible');
    elements.statusBadge.classList.toggle('hidden', !status);
    elements.statusBadge.classList.toggle('closed', status === '締切');
    elements.statusBadge.textContent = status;
    document.body.dataset.game = game;
}

function renderRoster(party, session) {
    elements.roster.replaceChildren();

    if (!party.preference) {
        const list = document.createElement('div');
        list.className = 'slot-list';

        for (let index = 0; index < party.maxParticipants; index += 1) {
            const participant = party.participants[index];
            list.append(buildSlot(participant, session, '', party));
        }

        elements.roster.append(list);
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'roster-grid';

    for (const target of party.preference.targets) {
        const row = document.createElement('div');
        const roleChoice = party.preference.choices.find(function(choice) {
            return choice.key === target.key;
        });
        const assigned = party.preference.participants.filter(function(participant) {
            return participant.assignedRole === target.key;
        });
        const label = document.createElement('div');
        const slots = document.createElement('div');

        row.className = 'roster-row';
        label.className = 'role-label';
        label.append(buildImage(roleChoice.asset, ''));
        label.append(document.createTextNode(target.label));
        slots.className = 'slot-list';

        for (let index = 0; index < target.capacity; index += 1) {
            const participant = assigned[index];
            const annotation = getPreferenceAnnotation(participant, party);

            slots.append(buildSlot(participant, session, annotation, party));
        }

        row.append(label, slots);
        grid.append(row);
    }

    elements.roster.append(grid);
}

function buildSlot(participant, session, annotation, party) {
    const slot = document.createElement('div');

    const isOwnSlot = Boolean(participant && participant.userId === session.ownPreference?.userId);

    slot.className = `slot${participant ? '' : ' empty'}${isOwnSlot ? ' own' : ''}`;

    if (!participant) {
        slot.textContent = '空き';
        return slot;
    }

    const displayedJob = getDisplayedJob(party, participant);

    if (displayedJob) {
        slot.append(buildImage(displayedJob.asset, ''));
    }

    slot.append(document.createTextNode(participant.displayName || '参加者'));

    if (annotation?.asset) {
        const icon = buildImage(annotation.asset, annotation.label);

        icon.className = 'preference-icon';
        icon.title = annotation.label;
        slot.append(icon);
    } else if (annotation?.text) {
        const tag = document.createElement('span');

        tag.className = 'preference-tag';
        tag.textContent = annotation.text;
        slot.append(tag);
    }

    return slot;
}

function getPreferenceAnnotation(participant, party) {
    if (!participant) {
        return null;
    }

    if (participant.firstChoice === party.preference.flexibleKey) {
        const flexibleChoice = party.preference.choices.find(function(choice) {
            return choice.key === party.preference.flexibleKey;
        });

        return flexibleChoice ? {
            asset: flexibleChoice.asset,
            label: flexibleChoice.label
        } : null;
    }

    if (participant.fixed) {
        return {
            text: '必須'
        };
    }

    return participant.firstChoice !== participant.assignedRole ? {
        text: '第2希望'
    } : null;
}

function getDisplayedJob(party, participant) {
    if (party.game !== 'ff14' || !party.preference?.jobsByRole) {
        return null;
    }

    if (participant.firstChoice === party.preference.flexibleKey) {
        return null;
    }

    let jobKey = `${participant.assignedRole}_any`;

    if (participant.firstChoice === participant.assignedRole && participant.jobKey) {
        jobKey = participant.jobKey;
    } else if (participant.secondChoice === participant.assignedRole && participant.secondJobKey) {
        jobKey = participant.secondJobKey;
    }

    return (party.preference.jobsByRole[participant.assignedRole] || []).find(function(job) {
        return job.key === jobKey;
    }) || null;
}

function renderJoinForm(party, session) {
    elements.joinForm.classList.toggle('hidden', session.isClosed);
    elements.leaveButton.classList.toggle('hidden', !session.isJoined || session.isClosed);

    if (!party.preference) {
        elements.preferenceFields.classList.add('hidden');
        elements.joinButton.textContent = session.isJoined ? '参加済み' : '参加';
        elements.joinButton.disabled = session.isJoined;
        return;
    }

    elements.preferenceFields.classList.remove('hidden');
    elements.joinButton.disabled = false;
    elements.joinButton.textContent = session.isJoined ? '参加内容を更新' : '参加を保存';
    state.draftJobs = {
        first: {},
        second: {}
    };
    elements.firstChoices.replaceChildren();

    for (const choice of party.preference.choices) {
        elements.firstChoices.append(buildRoleChoice(
            choice,
            'firstChoice',
            (session.ownPreference?.firstChoice || party.preference.flexibleKey) === choice.key
        ));
    }

    elements.fixedChoice.checked = Boolean(session.ownPreference?.fixed);
    renderSecondChoices(party, session.ownPreference?.secondChoice || '');
    elements.firstJobChoice.dataset.role = '';
    elements.secondJobChoice.dataset.role = '';
    updatePreferenceControls();
}

function renderSecondChoices(party, selectedChoice) {
    elements.secondChoices.replaceChildren(buildRoleChoice({
        key: '',
        label: '指定なし',
        asset: ''
    }, 'secondChoice', !selectedChoice));

    for (const choice of party.preference.choices) {
        if (!choice.flexible) {
            elements.secondChoices.append(buildRoleChoice(choice, 'secondChoice', selectedChoice === choice.key));
        }
    }
}

function updatePreferenceControls() {
    const party = state.session?.party;

    if (!party?.preference) {
        return;
    }

    const firstChoice = getSelectedFirstChoice();
    const secondChoice = getSelectedSecondChoice();
    const flexible = firstChoice === party.preference.flexibleKey;
    const fixed = elements.fixedChoice.checked && !flexible;

    elements.fixedChoice.disabled = flexible;

    if (flexible) {
        elements.fixedChoice.checked = false;
    }

    setChoiceGroupDisabled(elements.secondChoices, fixed || flexible, firstChoice);

    if (secondChoice === firstChoice) {
        selectChoice(elements.secondChoices, '');
    }

    syncJobSelector(
        'first',
        elements.firstJobField,
        elements.firstJobChoice,
        elements.firstJobIcon,
        firstChoice,
        party,
        state.session.ownPreference?.firstChoice === firstChoice ? state.session.ownPreference.jobKey : ''
    );
    const activeSecondChoice = getSelectedSecondChoice();
    const secondEnabled = !fixed && !flexible && Boolean(activeSecondChoice);

    syncJobSelector(
        'second',
        elements.secondJobField,
        elements.secondJobChoice,
        elements.secondJobIcon,
        secondEnabled ? activeSecondChoice : '',
        party,
        state.session.ownPreference?.secondChoice === activeSecondChoice ? state.session.ownPreference.secondJobKey : ''
    );
}

function renderEditForm(party, session) {
    elements.editForm.classList.toggle('hidden', !session.isCreator);

    if (!session.isCreator) {
        return;
    }

    elements.editContentField.classList.toggle('hidden', party.game !== 'ff14');
    elements.editContent.required = party.game === 'ff14';
    elements.editContent.value = party.contentName || '';
    elements.editDatetime.value = toDateTimeLocalInput(party.datetimeInput, party.scheduledAt);
    elements.editDetails.value = party.details || '';
    elements.closeButton.classList.toggle('hidden', session.isClosed && !session.canReopen);
    elements.closeButton.textContent = session.isClosed ? '募集を再開' : '締め切る';
    elements.closeButton.className = `${session.isClosed ? 'secondary' : 'danger'} command-button`;
}

async function createAct(event) {
    event.preventDefault();
    setButtonsDisabled(true);

    try {
        const result = await request('/api/act/create', {
            method: 'POST',
            body: {
                token: token,
                contentName: elements.createContent.value,
                datetime: toActDateTimeInput(elements.createDatetime.value),
                details: elements.createForm.elements.details.value
            }
        });

        window.location.assign(result.manageUrl);
    } catch (error) {
        showNotice(error.message, true);
        setButtonsDisabled(false);
    }
}

async function saveParticipation(event) {
    event.preventDefault();
    const party = state.session.party;
    const preference = party.preference ? {
        firstChoice: getSelectedFirstChoice(),
        fixed: elements.fixedChoice.checked,
        secondChoice: isSecondChoiceDisabled() ? '' : getSelectedSecondChoice(),
        jobKey: elements.firstJobField.classList.contains('hidden') ? '' : elements.firstJobChoice.value,
        secondJobKey: elements.secondJobField.classList.contains('hidden') ? '' : elements.secondJobChoice.value
    } : {};

    await actOnParty('join', {
        preference: preference
    }, '参加内容を保存しました。');
}

async function leaveParticipation() {
    await actOnParty('leave', {}, '参加を取り消しました。');
}

async function editAct(event) {
    event.preventDefault();
    await actOnParty('edit', {
        fields: {
            contentName: elements.editContent.value,
            datetime: toActDateTimeInput(elements.editDatetime.value),
            details: elements.editDetails.value
        }
    }, '募集を更新しました。');
}

async function toggleClosed() {
    await actOnParty(state.session.isClosed ? 'reopen' : 'close', {}, state.session.isClosed ? '募集を再開しました。' : '募集を締め切りました。');
}

async function actOnParty(action, body, successMessage) {
    setButtonsDisabled(true);

    try {
        state.session = await request(`/api/act/${state.session.party.id}/${action}`, {
            method: 'POST',
            body: {
                ...body,
                token: token
            }
        });
        renderManage();
        showNotice(successMessage, false);
    } catch (error) {
        showNotice(error.message, true);
    } finally {
        setButtonsDisabled(false);
        renderManage();
    }
}

async function request(url, options = {}) {
    const response = await fetch(url, {
        method: options.method || 'GET',
        headers: options.body ? {
            'Content-Type': 'application/json'
        } : undefined,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.error || '処理に失敗しました。');
    }

    return payload;
}

function getSelectedFirstChoice() {
    return elements.firstChoices.querySelector('input:checked')?.value || '';
}

function getSelectedSecondChoice() {
    return elements.secondChoices.querySelector('input:checked')?.value || '';
}

function isSecondChoiceDisabled() {
    return Boolean(elements.secondChoices.querySelector('input:not([value=""]):not(:disabled)') === null);
}

function buildRoleChoice(choice, name, checked) {
    const option = document.createElement('label');
    const input = document.createElement('input');
    const icon = document.createElement('span');
    const label = document.createElement('span');

    option.className = 'choice-option';
    input.type = 'radio';
    input.name = name;
    input.value = choice.key;
    input.checked = checked;
    icon.className = `choice-icon${choice.asset ? '' : ' empty-icon'}`;

    if (choice.asset) {
        icon.append(buildImage(choice.asset, ''));
    }

    label.className = 'choice-text';
    label.textContent = choice.label;
    option.append(input, icon, label);

    return option;
}

function setChoiceGroupDisabled(container, disabled, excludedValue) {
    container.querySelectorAll('input').forEach(function(input) {
        const inputDisabled = input.value !== '' && (disabled || input.value === excludedValue);

        input.disabled = inputDisabled;
        input.closest('.choice-option').classList.toggle('disabled', inputDisabled);
    });
}

function selectChoice(container, value) {
    const input = container.querySelector(`input[value="${value}"]`);

    if (input) {
        input.checked = true;
    }
}

function syncJobSelector(bucket, field, select, icon, roleKey, party, savedValue) {
    rememberJobSelection(bucket, select);

    const jobs = party.preference.jobsByRole[roleKey] || [];

    field.classList.toggle('hidden', jobs.length === 0);

    if (jobs.length === 0) {
        select.dataset.role = '';
        return;
    }

    if (select.dataset.role !== roleKey) {
        select.replaceChildren();

        for (const job of jobs) {
            select.append(new Option(job.label, job.key));
        }

        select.dataset.role = roleKey;
    }

    const value = state.draftJobs[bucket][roleKey] || savedValue || jobs[0].key;
    select.value = jobs.some(function(job) {
        return job.key === value;
    }) ? value : jobs[0].key;
    rememberJobSelection(bucket, select);
    updateJobIcon(select, icon, party.preference.jobsByRole);
}

function rememberJobSelection(bucket, select) {
    if (select.dataset.role && select.value) {
        state.draftJobs[bucket][select.dataset.role] = select.value;
    }
}

function updateJobIcon(select, icon, jobsByRole) {
    const job = (jobsByRole[select.dataset.role] || []).find(function(candidate) {
        return candidate.key === select.value;
    });

    icon.src = job?.asset || '';
    icon.classList.toggle('hidden', !job);
}

function toActDateTimeInput(value) {
    const match = String(value || '').match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}:\d{2})$/u);

    return match ? `${match[1]}/${match[2]} ${match[3]}` : '';
}

function toDateTimeLocalInput(input, scheduledAt = '') {
    if (scheduledAt) {
        const date = new Date(scheduledAt);

        if (!Number.isNaN(date.getTime())) {
            return formatLocalDateTime(date);
        }
    }

    const match = String(input || '').match(/^(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/u);

    if (!match) {
        return '';
    }

    const now = new Date();
    let date = new Date(now.getFullYear(), Number(match[1]) - 1, Number(match[2]), Number(match[3]), Number(match[4]));

    if (date.getTime() < now.getTime()) {
        date = new Date(now.getFullYear() + 1, Number(match[1]) - 1, Number(match[2]), Number(match[3]), Number(match[4]));
    }

    return formatLocalDateTime(date);
}

function formatLocalDateTime(date) {
    return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}T${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
}

function padNumber(value) {
    return String(value).padStart(2, '0');
}

function buildImage(src, alt) {
    const image = document.createElement('img');

    image.src = src;
    image.alt = alt;

    return image;
}

function setButtonsDisabled(disabled) {
    document.querySelectorAll('button').forEach(function(button) {
        button.disabled = disabled;
    });
}

function showNotice(message, isError) {
    elements.notice.textContent = message;
    elements.notice.classList.toggle('error', isError);
    elements.notice.classList.remove('hidden');
    window.setTimeout(function() {
        elements.notice.classList.add('hidden');
    }, 4000);
}

function showFatalError(message) {
    elements.loadingView.classList.add('hidden');
    elements.errorView.classList.remove('hidden');
    elements.errorText.textContent = message;
    elements.pageTitle.textContent = '募集';
}
