import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { createOrganizerEvent } from './src/api/create-event';
import { loadMobileConfig } from './src/api/config';
import { fetchOrganizerEventDetailsBundle } from './src/api/event-details';
import { replaceEventReminders } from './src/api/event-reminders';
import { ApiClientError } from './src/api/http';
import { createOrReuseInviteLink } from './src/api/invite-link';
import {
  getPublicInvite,
  submitPublicRsvp,
  type PublicInviteResponse,
  type PublicRsvpStatus,
  type SubmitPublicRsvpResponse,
} from './src/api/public-invite';
import { type EventListScope, fetchOrganizerEvents } from './src/api/events';
import { parseReminderOffsetsInput } from './src/features/event-details/reminder-editor-model';
import {
  buildCreateEventPayloadFromForm,
  type CreateEventFormInput,
} from './src/features/create-event/create-event-form-model';
import { mapEventDetailsToViewModel } from './src/features/event-details/event-details-model';
import { mapInviteLinkToViewModel } from './src/features/event-details/invite-link-model';
import { mapEventToCardModel } from './src/features/events-list/event-card-model';
import { mapPublicInviteToViewModel } from './src/features/public-invite/public-invite-model';
import { buildPublicRsvpPayloadFromForm } from './src/features/public-invite/public-rsvp-form-model';

type LoadStatus = 'idle' | 'loading' | 'error' | 'success';

const scopeOptions: EventListScope[] = ['upcoming', 'past', 'all'];
const initialCreateForm: CreateEventFormInput = {
  title: '',
  description: '',
  location: '',
  startsAt: '',
  timezone: '',
  capacityLimit: '',
};

export default function App() {
  const configResult = useMemo(() => loadMobileConfig(), []);
  const [screen, setScreen] = useState<'list' | 'details' | 'create' | 'public-invite'>('list');
  const [scope, setScope] = useState<EventListScope>('upcoming');
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [events, setEvents] = useState<ReturnType<typeof mapEventToCardModel>[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [detailsStatus, setDetailsStatus] = useState<LoadStatus>('idle');
  const [detailsErrorMessage, setDetailsErrorMessage] = useState<string | null>(null);
  const [eventDetails, setEventDetails] = useState<ReturnType<typeof mapEventDetailsToViewModel> | null>(null);
  const [createForm, setCreateForm] = useState<CreateEventFormInput>(initialCreateForm);
  const [createStatus, setCreateStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<LoadStatus>('idle');
  const [inviteLink, setInviteLink] = useState<Awaited<ReturnType<typeof createOrReuseInviteLink>> | null>(null);
  const [inviteErrorMessage, setInviteErrorMessage] = useState<string | null>(null);
  const [isReminderEditing, setIsReminderEditing] = useState(false);
  const [reminderInput, setReminderInput] = useState('');
  const [reminderErrorMessage, setReminderErrorMessage] = useState<string | null>(null);
  const [reminderSaveStatus, setReminderSaveStatus] = useState<'idle' | 'saving'>('idle');
  const [publicInviteToken, setPublicInviteToken] = useState<string | null>(null);
  const [publicInviteStatus, setPublicInviteStatus] = useState<LoadStatus>('idle');
  const [publicInviteErrorMessage, setPublicInviteErrorMessage] = useState<string | null>(null);
  const [publicInviteResponse, setPublicInviteResponse] = useState<PublicInviteResponse | null>(null);
  const [publicRsvpInput, setPublicRsvpInput] = useState<{
    guestName: string;
    guestEmail: string;
    status: PublicRsvpStatus | '';
  }>({
    guestName: '',
    guestEmail: '',
    status: '',
  });
  const [publicRsvpFieldErrors, setPublicRsvpFieldErrors] = useState<{
    guestName?: string;
    guestEmail?: string;
    status?: string;
  }>({});
  const [publicRsvpErrorMessage, setPublicRsvpErrorMessage] = useState<string | null>(null);
  const [publicRsvpStatus, setPublicRsvpStatus] = useState<'idle' | 'submitting'>('idle');
  const [publicRsvpSuccess, setPublicRsvpSuccess] = useState<SubmitPublicRsvpResponse | null>(null);

  const loadEvents = useCallback(async () => {
    if (!configResult.ok) {
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const response = await fetchOrganizerEvents({
        baseUrl: configResult.value.apiBaseUrl,
        scope,
        devUserId: configResult.value.devUserId,
        includeDevUserHeader: configResult.value.isDevelopment,
      });

      setEvents(response.events.map(mapEventToCardModel));
      setStatus('success');
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unexpected failure while loading events');
      }
      setStatus('error');
    }
  }, [configResult, scope]);

  const loadEventDetails = useCallback(async () => {
    if (!configResult.ok || !selectedEventId) {
      return;
    }

    setDetailsStatus('loading');
    setDetailsErrorMessage(null);

    try {
      const bundle = await fetchOrganizerEventDetailsBundle({
        baseUrl: configResult.value.apiBaseUrl,
        eventId: selectedEventId,
        devUserId: configResult.value.devUserId,
        includeDevUserHeader: configResult.value.isDevelopment,
      });

      setEventDetails(mapEventDetailsToViewModel(bundle));
      setDetailsStatus('success');
    } catch (error) {
      if (error instanceof ApiClientError) {
        setDetailsErrorMessage(error.message);
      } else {
        setDetailsErrorMessage('Unexpected failure while loading event details');
      }
      setDetailsStatus('error');
    }
  }, [configResult, selectedEventId]);

  useEffect(() => {
    if (configResult.ok) {
      void loadEvents();
    }
  }, [configResult, loadEvents]);

  useEffect(() => {
    if (screen === 'details' && selectedEventId) {
      void loadEventDetails();
    }
  }, [screen, selectedEventId, loadEventDetails]);

  const updateCreateFormField = useCallback(
    (field: keyof CreateEventFormInput, value: string) => {
      setCreateForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const submitCreateEvent = useCallback(async () => {
    if (!configResult.ok || createStatus === 'submitting') {
      return;
    }

    const buildResult = buildCreateEventPayloadFromForm(createForm);
    if (!buildResult.ok) {
      setCreateErrorMessage(buildResult.message);
      setCreateStatus('error');
      return;
    }

    setCreateStatus('submitting');
    setCreateErrorMessage(null);

    try {
      const createdEvent = await createOrganizerEvent({
        baseUrl: configResult.value.apiBaseUrl,
        payload: buildResult.payload,
        devUserId: configResult.value.devUserId,
        includeDevUserHeader: configResult.value.isDevelopment,
      });

      setCreateForm(initialCreateForm);
      setSelectedEventId(createdEvent.id);
      setDetailsStatus('idle');
      setDetailsErrorMessage(null);
      setEventDetails(null);
      setCreateStatus('idle');
      setScreen('details');
      void loadEvents();
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.kind === 'network') {
          setCreateErrorMessage('Could not submit event. Check network and try again.');
        } else if (error.kind === 'http' && error.status === 400) {
          setCreateErrorMessage('Could not create event. Please verify your inputs and try again.');
        } else {
          setCreateErrorMessage(error.message);
        }
      } else {
        setCreateErrorMessage('Unexpected failure while creating event');
      }
      setCreateStatus('error');
    }
  }, [configResult, createForm, createStatus, loadEvents]);

  const createInviteLink = useCallback(async () => {
    if (!configResult.ok || !selectedEventId || inviteStatus === 'loading') {
      return;
    }

    setInviteStatus('loading');
    setInviteErrorMessage(null);

    try {
      const response = await createOrReuseInviteLink({
        baseUrl: configResult.value.apiBaseUrl,
        eventId: selectedEventId,
        devUserId: configResult.value.devUserId,
        includeDevUserHeader: configResult.value.isDevelopment,
      });

      setInviteLink(response);
      setInviteStatus('success');
    } catch (error) {
      if (error instanceof ApiClientError) {
        setInviteErrorMessage(error.message);
      } else {
        setInviteErrorMessage('Unexpected failure while creating invite link');
      }
      setInviteStatus('error');
    }
  }, [configResult, inviteStatus, selectedEventId]);

  const shareInviteLink = useCallback(async () => {
    if (!inviteLink) {
      return;
    }

    try {
      await Share.share({
        message: inviteLink.url,
        url: inviteLink.url,
      });
    } catch (error) {
      setInviteErrorMessage(error instanceof Error ? error.message : 'Could not open share dialog');
    }
  }, [inviteLink]);

  const startReminderEditing = useCallback(() => {
    if (!eventDetails) {
      return;
    }

    setReminderInput(eventDetails.reminders.map((reminder) => reminder.offsetMinutes).join(', '));
    setReminderErrorMessage(null);
    setIsReminderEditing(true);
  }, [eventDetails]);

  const cancelReminderEditing = useCallback(() => {
    setIsReminderEditing(false);
    setReminderInput('');
    setReminderErrorMessage(null);
    setReminderSaveStatus('idle');
  }, []);

  const saveReminders = useCallback(async () => {
    if (!configResult.ok || !selectedEventId || reminderSaveStatus === 'saving') {
      return;
    }

    const parseResult = parseReminderOffsetsInput(reminderInput);
    if (!parseResult.ok) {
      setReminderErrorMessage(parseResult.message);
      return;
    }

    setReminderSaveStatus('saving');
    setReminderErrorMessage(null);

    try {
      await replaceEventReminders({
        baseUrl: configResult.value.apiBaseUrl,
        eventId: selectedEventId,
        offsetsMinutes: parseResult.offsetsMinutes,
        devUserId: configResult.value.devUserId,
        includeDevUserHeader: configResult.value.isDevelopment,
      });

      await loadEventDetails();
      setIsReminderEditing(false);
      setReminderInput('');
      setReminderErrorMessage(null);
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.kind === 'http' && error.status === 400) {
          setReminderErrorMessage(error.message);
        } else if (error.kind === 'network') {
          setReminderErrorMessage('Could not save reminders. Check network and try again.');
        } else {
          setReminderErrorMessage('Could not save reminders. Please try again.');
        }
      } else {
        setReminderErrorMessage('Unexpected failure while saving reminders.');
      }
    } finally {
      setReminderSaveStatus('idle');
    }
  }, [configResult, loadEventDetails, reminderInput, reminderSaveStatus, selectedEventId]);

  const loadPublicInvite = useCallback(async () => {
    if (!configResult.ok || !publicInviteToken) {
      return;
    }

    setPublicInviteStatus('loading');
    setPublicInviteErrorMessage(null);

    try {
      const response = await getPublicInvite({
        baseUrl: configResult.value.apiBaseUrl,
        token: publicInviteToken,
      });

      setPublicInviteResponse(response);
      setPublicInviteStatus('success');
    } catch (error) {
      if (error instanceof ApiClientError) {
        setPublicInviteErrorMessage(error.message);
      } else {
        setPublicInviteErrorMessage('Could not load public invite. Please try again.');
      }
      setPublicInviteStatus('error');
    }
  }, [configResult, publicInviteToken]);

  useEffect(() => {
    if (screen === 'public-invite') {
      void loadPublicInvite();
    }
  }, [loadPublicInvite, screen]);

  const submitPublicInviteRsvp = useCallback(async () => {
    if (!configResult.ok || !publicInviteToken || publicRsvpStatus === 'submitting') {
      return;
    }

    const parseResult = buildPublicRsvpPayloadFromForm(publicRsvpInput);

    if (!parseResult.ok) {
      setPublicRsvpFieldErrors(parseResult.fieldErrors);
      setPublicRsvpErrorMessage(parseResult.message);
      return;
    }

    setPublicRsvpStatus('submitting');
    setPublicRsvpFieldErrors({});
    setPublicRsvpErrorMessage(null);

    try {
      const response = await submitPublicRsvp({
        baseUrl: configResult.value.apiBaseUrl,
        token: publicInviteToken,
        payload: parseResult.payload,
      });

      setPublicRsvpInput(parseResult.payload);
      setPublicRsvpSuccess(response);
      await loadPublicInvite();
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.kind === 'network') {
          setPublicRsvpErrorMessage('Could not submit RSVP. Check network and try again.');
        } else if (error.kind === 'http') {
          setPublicRsvpErrorMessage('Could not save RSVP. Please verify your input and retry.');
        } else {
          setPublicRsvpErrorMessage('Could not save RSVP. Please retry.');
        }
      } else {
        setPublicRsvpErrorMessage('Unexpected failure while submitting RSVP.');
      }
    } finally {
      setPublicRsvpStatus('idle');
    }
  }, [configResult, loadPublicInvite, publicInviteToken, publicRsvpInput, publicRsvpStatus]);

  if (!configResult.ok) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <Text style={styles.title}>Organizer Home</Text>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Configuration error</Text>
          <Text style={styles.errorText}>{configResult.error}</Text>
          <Text style={styles.errorText}>Set values in apps/mobile/.env and restart Expo.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'public-invite') {
    if (!publicInviteToken) {
      return (
        <SafeAreaView style={styles.container}>
          <StatusBar style="auto" />
          <Pressable onPress={() => setScreen('details')} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back to event details</Text>
          </Pressable>
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Missing invite token</Text>
            <Text style={styles.errorText}>Cannot load invite preview without a token.</Text>
          </View>
        </SafeAreaView>
      );
    }

    const inviteView = publicInviteResponse ? mapPublicInviteToViewModel(publicInviteResponse) : null;

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <Pressable onPress={() => setScreen('details')} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to event details</Text>
        </Pressable>
        <Pressable onPress={() => void loadPublicInvite()} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh invite preview</Text>
        </Pressable>

        {publicInviteStatus === 'loading' ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" />
            <Text style={styles.stateText}>Loading public invite...</Text>
          </View>
        ) : null}

        {publicInviteStatus === 'error' ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Could not load public invite</Text>
            <Text style={styles.errorText}>{publicInviteErrorMessage ?? 'Please try again.'}</Text>
            <Pressable onPress={() => void loadPublicInvite()} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {inviteView && publicInviteStatus === 'success' ? (
          <ScrollView contentContainerStyle={styles.detailsContent}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{inviteView.event.title}</Text>
              <Text style={styles.cardText}>{inviteView.event.descriptionLabel}</Text>
              <Text style={styles.cardText}>{inviteView.event.startsAtLabel}</Text>
              <Text style={styles.cardText}>{inviteView.event.timezoneLabel}</Text>
              <Text style={styles.cardText}>{inviteView.event.locationLabel}</Text>
              <Text style={styles.cardText}>{inviteView.event.capacityLabel}</Text>
              <Text style={styles.cardText}>{inviteView.expiryLabel}</Text>
              <Text style={styles.cardText}>{inviteView.tokenLabel}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Public RSVP summary</Text>
              <Text style={styles.cardText}>{inviteView.summary.goingLabel}</Text>
              <Text style={styles.cardText}>{inviteView.summary.maybeLabel}</Text>
              <Text style={styles.cardText}>{inviteView.summary.notGoingLabel}</Text>
              <Text style={styles.cardText}>{inviteView.summary.totalLabel}</Text>
              <Text style={styles.cardText}>{inviteView.summary.confirmedGoingLabel}</Text>
              <Text style={styles.cardText}>{inviteView.summary.waitlistedGoingLabel}</Text>
              <Text style={styles.cardText}>{inviteView.summary.remainingSpotsLabel}</Text>
              <Text style={styles.cardText}>{inviteView.summary.isFullLabel}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Submit RSVP</Text>
              <TextInput
                value={publicRsvpInput.guestName}
                onChangeText={(value) => setPublicRsvpInput((prev) => ({ ...prev, guestName: value }))}
                placeholder="Guest name"
                style={styles.input}
                editable={publicRsvpStatus !== 'submitting'}
              />
              {publicRsvpFieldErrors.guestName ? (
                <Text style={styles.errorText}>{publicRsvpFieldErrors.guestName}</Text>
              ) : null}

              <TextInput
                value={publicRsvpInput.guestEmail}
                onChangeText={(value) => setPublicRsvpInput((prev) => ({ ...prev, guestEmail: value }))}
                placeholder="guest@example.com"
                style={styles.input}
                editable={publicRsvpStatus !== 'submitting'}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              {publicRsvpFieldErrors.guestEmail ? (
                <Text style={styles.errorText}>{publicRsvpFieldErrors.guestEmail}</Text>
              ) : null}

              <View style={styles.scopeRow}>
                {[
                  { label: 'Going', value: 'going' },
                  { label: 'Maybe', value: 'maybe' },
                  { label: 'Not going', value: 'not_going' },
                ].map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      setPublicRsvpInput((prev) => ({ ...prev, status: option.value as PublicRsvpStatus }))
                    }
                    style={[styles.scopeButton, publicRsvpInput.status === option.value && styles.scopeButtonActive]}
                    disabled={publicRsvpStatus === 'submitting'}
                  >
                    <Text
                      style={[
                        styles.scopeButtonText,
                        publicRsvpInput.status === option.value && styles.scopeButtonTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {publicRsvpFieldErrors.status ? <Text style={styles.errorText}>{publicRsvpFieldErrors.status}</Text> : null}

              {publicRsvpErrorMessage ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorTitle}>Could not submit RSVP</Text>
                  <Text style={styles.errorText}>{publicRsvpErrorMessage}</Text>
                </View>
              ) : null}

              {publicRsvpSuccess ? (
                <View style={styles.subCard}>
                  <Text style={styles.cardText}>
                    RSVP saved for {publicRsvpSuccess.guestName} ({publicRsvpSuccess.guestEmail})
                  </Text>
                  <Text style={styles.cardText}>
                    RSVP saved: {publicRsvpSuccess.status} ({publicRsvpSuccess.attendanceState}
                    {publicRsvpSuccess.waitlistPosition === null ? '' : ` #${publicRsvpSuccess.waitlistPosition}`})
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => void submitPublicInviteRsvp()}
                style={[styles.refreshButton, publicRsvpStatus === 'submitting' && styles.disabledButton]}
                disabled={publicRsvpStatus === 'submitting'}
              >
                <Text style={styles.refreshText}>
                  {publicRsvpStatus === 'submitting' ? 'Submitting RSVP...' : 'Submit RSVP'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : null}
      </SafeAreaView>
    );
  }

  if (screen === 'details' && selectedEventId) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <Pressable
          onPress={() => {
            setScreen('list');
            setSelectedEventId(null);
            setInviteStatus('idle');
            setInviteErrorMessage(null);
            setInviteLink(null);
            cancelReminderEditing();
            setPublicInviteToken(null);
            setPublicInviteStatus('idle');
            setPublicInviteErrorMessage(null);
            setPublicInviteResponse(null);
            setPublicRsvpInput({ guestName: '', guestEmail: '', status: '' });
            setPublicRsvpFieldErrors({});
            setPublicRsvpErrorMessage(null);
            setPublicRsvpStatus('idle');
            setPublicRsvpSuccess(null);
            void loadEvents();
          }}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back to events</Text>
        </Pressable>

        <Pressable onPress={() => void loadEventDetails()} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh details</Text>
        </Pressable>

        {detailsStatus === 'loading' ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" />
            <Text style={styles.stateText}>Loading event details...</Text>
          </View>
        ) : null}

        {detailsStatus === 'error' ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Could not load event details</Text>
            <Text style={styles.errorText}>{detailsErrorMessage ?? 'Backend may be unavailable.'}</Text>
            <Pressable onPress={() => void loadEventDetails()} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {detailsStatus === 'success' && eventDetails ? (
          <ScrollView contentContainerStyle={styles.detailsContent}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{eventDetails.event.title}</Text>
              <Text style={styles.cardText}>{eventDetails.event.startsAtLabel}</Text>
              <Text style={styles.cardText}>{eventDetails.event.timezoneLabel}</Text>
              <Text style={styles.cardText}>{eventDetails.event.locationLabel}</Text>
              <Text style={styles.cardText}>{eventDetails.event.descriptionLabel}</Text>
              <Text style={styles.cardText}>{eventDetails.event.capacityLabel}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>RSVP summary</Text>
              <Text style={styles.cardText}>{eventDetails.summary.totalLabel}</Text>
              <Text style={styles.cardText}>{eventDetails.summary.goingLabel}</Text>
              <Text style={styles.cardText}>{eventDetails.summary.maybeLabel}</Text>
              <Text style={styles.cardText}>{eventDetails.summary.notGoingLabel}</Text>
              <Text style={styles.cardText}>{eventDetails.summary.confirmedGoingLabel}</Text>
              <Text style={styles.cardText}>{eventDetails.summary.waitlistedGoingLabel}</Text>
              <Text style={styles.cardText}>{eventDetails.summary.remainingSpotsLabel}</Text>
              <Text style={styles.cardText}>{eventDetails.summary.isFullLabel}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Attendees</Text>
              {eventDetails.attendees.length === 0 ? (
                <Text style={styles.cardText}>{eventDetails.attendeesEmptyMessage}</Text>
              ) : (
                eventDetails.attendees.map((attendee) => (
                  <View key={attendee.key} style={styles.subCard}>
                    <Text style={styles.cardText}>{attendee.guestName}</Text>
                    <Text style={styles.cardText}>{attendee.guestEmail}</Text>
                    <Text style={styles.cardText}>{attendee.statusLabel}</Text>
                    <Text style={styles.cardText}>{attendee.attendanceStateLabel}</Text>
                    {attendee.waitlistLabel ? <Text style={styles.cardText}>{attendee.waitlistLabel}</Text> : null}
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Reminders</Text>
              {!isReminderEditing ? (
                <>
                  {eventDetails.reminders.length === 0 ? (
                    <Text style={styles.cardText}>{eventDetails.remindersEmptyMessage}</Text>
                  ) : (
                    eventDetails.reminders.map((reminder) => (
                      <View key={reminder.key} style={styles.subCard}>
                        <Text style={styles.cardText}>{reminder.offsetLabel}</Text>
                        <Text style={styles.cardText}>{reminder.sendAtLabel}</Text>
                      </View>
                    ))
                  )}
                  <Pressable onPress={startReminderEditing} style={styles.refreshButton}>
                    <Text style={styles.refreshText}>Edit reminders</Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.reminderEditor}>
                  <Text style={styles.cardText}>Reminder offsets (minutes, comma separated)</Text>
                  <TextInput
                    value={reminderInput}
                    onChangeText={setReminderInput}
                    placeholder="1440, 120, 30"
                    style={styles.input}
                    editable={reminderSaveStatus !== 'saving'}
                    keyboardType="numbers-and-punctuation"
                  />
                  <Text style={styles.subtitle}>Use comma-separated minutes, for example: 1440, 120, 30</Text>
                  {reminderErrorMessage ? <Text style={styles.errorText}>{reminderErrorMessage}</Text> : null}
                  <View style={styles.createActions}>
                    <Pressable
                      onPress={() => void saveReminders()}
                      style={[styles.refreshButton, reminderSaveStatus === 'saving' && styles.disabledButton]}
                      disabled={reminderSaveStatus === 'saving'}
                    >
                      <Text style={styles.refreshText}>
                        {reminderSaveStatus === 'saving' ? 'Saving reminders...' : 'Save reminders'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={cancelReminderEditing}
                      style={styles.cancelButton}
                      disabled={reminderSaveStatus === 'saving'}
                    >
                      <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Invite link</Text>
              {inviteStatus === 'loading' ? (
                <View style={styles.centerState}>
                  <ActivityIndicator size="small" />
                  <Text style={styles.stateText}>Creating invite link...</Text>
                </View>
              ) : null}

              {(() => {
                const inviteView =
                  inviteStatus === 'error' && !inviteLink
                    ? mapInviteLinkToViewModel(null, inviteErrorMessage)
                    : mapInviteLinkToViewModel(inviteLink);

                return (
                  <View style={styles.inviteContent}>
                    <Text style={styles.cardText}>{inviteView.stateLabel}</Text>
                    {inviteView.urlLabel ? <Text style={styles.cardText}>{inviteView.urlLabel}</Text> : null}
                    {inviteView.tokenLabel ? <Text style={styles.cardText}>{inviteView.tokenLabel}</Text> : null}
                    {inviteView.expiresAtLabel ? <Text style={styles.cardText}>{inviteView.expiresAtLabel}</Text> : null}
                    {inviteView.statusLabel ? <Text style={styles.cardText}>{inviteView.statusLabel}</Text> : null}
                    {inviteStatus !== 'error' && inviteErrorMessage ? (
                      <Text style={styles.errorText}>Share failed: {inviteErrorMessage}</Text>
                    ) : null}
                  </View>
                );
              })()}

              <View style={styles.inviteActions}>
                <Pressable
                  onPress={() => void createInviteLink()}
                  style={[styles.refreshButton, inviteStatus === 'loading' && styles.disabledButton]}
                  disabled={inviteStatus === 'loading'}
                >
                  <Text style={styles.refreshText}>Create or reuse invite link</Text>
                </Pressable>

                {inviteLink ? (
                  <>
                    <Pressable onPress={() => void shareInviteLink()} style={styles.createButton}>
                      <Text style={styles.refreshText}>Share invite link</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setPublicInviteToken(inviteLink.token);
                        setPublicInviteStatus('idle');
                        setPublicInviteErrorMessage(null);
                        setPublicInviteResponse(null);
                        setPublicRsvpFieldErrors({});
                        setPublicRsvpErrorMessage(null);
                        setPublicRsvpSuccess(null);
                        setScreen('public-invite');
                      }}
                      style={styles.backButton}
                    >
                      <Text style={styles.backButtonText}>Preview invite</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            </View>
          </ScrollView>
        ) : null}
      </SafeAreaView>
    );
  }

  if (screen === 'create') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <Text style={styles.title}>Create event</Text>
        <Text style={styles.subtitle}>Fill the form and submit to create a new organizer event.</Text>

        <ScrollView contentContainerStyle={styles.formContent}>
          <TextInput
            value={createForm.title}
            onChangeText={(value) => updateCreateFormField('title', value)}
            placeholder="Friday Board Games"
            style={styles.input}
            editable={createStatus !== 'submitting'}
          />
          <TextInput
            value={createForm.description}
            onChangeText={(value) => updateCreateFormField('description', value)}
            placeholder="Bring drinks if you want"
            style={styles.input}
            editable={createStatus !== 'submitting'}
          />
          <TextInput
            value={createForm.location}
            onChangeText={(value) => updateCreateFormField('location', value)}
            placeholder="Prospekt Mira 10"
            style={styles.input}
            editable={createStatus !== 'submitting'}
          />
          <TextInput
            value={createForm.startsAt}
            onChangeText={(value) => updateCreateFormField('startsAt', value)}
            placeholder="2026-03-25T19:30:00.000Z"
            style={styles.input}
            editable={createStatus !== 'submitting'}
            autoCapitalize="none"
          />
          <TextInput
            value={createForm.timezone}
            onChangeText={(value) => updateCreateFormField('timezone', value)}
            placeholder="Europe/Moscow"
            style={styles.input}
            editable={createStatus !== 'submitting'}
            autoCapitalize="none"
          />
          <TextInput
            value={createForm.capacityLimit}
            onChangeText={(value) => updateCreateFormField('capacityLimit', value)}
            placeholder="8"
            style={styles.input}
            editable={createStatus !== 'submitting'}
            keyboardType="number-pad"
          />

          {createStatus === 'submitting' ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="small" />
              <Text style={styles.stateText}>Creating event...</Text>
            </View>
          ) : null}

          {createErrorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Could not create event</Text>
              <Text style={styles.errorText}>{createErrorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.createActions}>
            <Pressable
              onPress={() => void submitCreateEvent()}
              style={[styles.refreshButton, createStatus === 'submitting' && styles.disabledButton]}
              disabled={createStatus === 'submitting'}
            >
              <Text style={styles.refreshText}>Create event</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setCreateErrorMessage(null);
                setCreateStatus('idle');
                setScreen('list');
              }}
              style={styles.cancelButton}
              disabled={createStatus === 'submitting'}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Organizer Home</Text>
      <Text style={styles.subtitle}>{configResult.value.apiBaseUrl}</Text>

      <View style={styles.scopeRow}>
        {scopeOptions.map((scopeOption) => (
          <Pressable
            key={scopeOption}
            onPress={() => {
              setScope(scopeOption);
            }}
            style={[styles.scopeButton, scope === scopeOption && styles.scopeButtonActive]}
          >
            <Text style={[styles.scopeButtonText, scope === scopeOption && styles.scopeButtonTextActive]}>
              {scopeOption.charAt(0).toUpperCase() + scopeOption.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={() => void loadEvents()} style={styles.refreshButton}>
        <Text style={styles.refreshText}>Refresh</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          setCreateErrorMessage(null);
          setCreateStatus('idle');
          setScreen('create');
        }}
        style={styles.createButton}
      >
        <Text style={styles.refreshText}>Create event</Text>
      </Pressable>

      {status === 'loading' ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" />
          <Text style={styles.stateText}>Loading events...</Text>
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Could not load events</Text>
          <Text style={styles.errorText}>{errorMessage ?? 'Backend may be unavailable.'}</Text>
          <Pressable onPress={() => void loadEvents()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {status === 'success' && events.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.stateText}>No events for this scope yet.</Text>
        </View>
      ) : null}

      {status === 'success' && events.length > 0 ? (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setScreen('details');
                setSelectedEventId(item.id);
                setDetailsStatus('idle');
                setDetailsErrorMessage(null);
                setEventDetails(null);
                setInviteStatus('idle');
                setInviteErrorMessage(null);
                setInviteLink(null);
                cancelReminderEditing();
                setPublicInviteToken(null);
                setPublicInviteStatus('idle');
                setPublicInviteErrorMessage(null);
                setPublicInviteResponse(null);
                setPublicRsvpInput({ guestName: '', guestEmail: '', status: '' });
                setPublicRsvpFieldErrors({});
                setPublicRsvpErrorMessage(null);
                setPublicRsvpStatus('idle');
                setPublicRsvpSuccess(null);
              }}
              style={styles.card}
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardText}>{item.startsAtLabel}</Text>
              <Text style={styles.cardText}>{item.timezoneLabel}</Text>
              <Text style={styles.cardText}>{item.locationLabel}</Text>
              <Text style={styles.cardText}>{item.capacityLabel}</Text>
              <Text style={styles.cardText}>{item.rsvpSummaryLabel}</Text>
              <Text style={styles.cardText}>{item.inviteLinkLabel}</Text>
              <Text style={styles.cardText}>{item.reminderLabel}</Text>
            </Pressable>
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7fb',
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 12,
    color: '#4b5563',
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scopeButton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scopeButtonActive: {
    backgroundColor: '#2563eb',
  },
  scopeButtonText: {
    color: '#111827',
    fontWeight: '500',
  },
  scopeButtonTextActive: {
    color: '#ffffff',
  },
  refreshButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  refreshText: {
    color: '#fff',
    fontWeight: '600',
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  stateText: {
    color: '#374151',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  errorTitle: {
    fontWeight: '700',
    color: '#991b1b',
  },
  errorText: {
    color: '#7f1d1d',
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#b91c1c',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  createButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  formContent: {
    gap: 10,
    paddingBottom: 30,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#d1d5db',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
  },
  createActions: {
    gap: 8,
  },
  inviteActions: {
    gap: 8,
    marginTop: 8,
  },
  inviteContent: {
    gap: 4,
  },
  reminderEditor: {
    gap: 8,
  },
  cancelButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#6b7280',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cancelText: {
    color: '#fff',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  listContent: {
    gap: 10,
    paddingBottom: 40,
  },
  detailsContent: {
    gap: 10,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  subCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 8,
    gap: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  cardText: {
    color: '#374151',
    fontSize: 13,
  },
});
