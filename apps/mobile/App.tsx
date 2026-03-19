import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { loadMobileConfig } from './src/api/config';
import { fetchOrganizerEventDetailsBundle } from './src/api/event-details';
import { ApiClientError } from './src/api/http';
import { type EventListScope, fetchOrganizerEvents } from './src/api/events';
import { mapEventDetailsToViewModel } from './src/features/event-details/event-details-model';
import { mapEventToCardModel } from './src/features/events-list/event-card-model';

type LoadStatus = 'idle' | 'loading' | 'error' | 'success';

const scopeOptions: EventListScope[] = ['upcoming', 'past', 'all'];

export default function App() {
  const configResult = useMemo(() => loadMobileConfig(), []);
  const [scope, setScope] = useState<EventListScope>('upcoming');
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [events, setEvents] = useState<ReturnType<typeof mapEventToCardModel>[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [detailsStatus, setDetailsStatus] = useState<LoadStatus>('idle');
  const [detailsErrorMessage, setDetailsErrorMessage] = useState<string | null>(null);
  const [eventDetails, setEventDetails] = useState<ReturnType<typeof mapEventDetailsToViewModel> | null>(null);

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
    if (selectedEventId) {
      void loadEventDetails();
    }
  }, [selectedEventId, loadEventDetails]);

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

  if (selectedEventId) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <Pressable
          onPress={() => {
            setSelectedEventId(null);
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
            </View>
          </ScrollView>
        ) : null}
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
                setSelectedEventId(item.id);
                setDetailsStatus('idle');
                setDetailsErrorMessage(null);
                setEventDetails(null);
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
