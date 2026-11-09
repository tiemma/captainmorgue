import { useEffect, useState } from 'react';
import type { IncidentEvent, IncidentState } from './service-client';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

export function useIncident() {
  const [state, setState] = useState<IncidentState | null>(null);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [connection, setConnection] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stream = new EventSource('/stream');
    let backlog = new Map<number, IncidentEvent>();
    let hydrated = false;
    let active = true;

    stream.onopen = () => {
      backlog = new Map();
      hydrated = false;
    };

    stream.addEventListener('event', (message) => {
      if (!active) return;
      try {
        const event: IncidentEvent = JSON.parse((message as MessageEvent<string>).data);
        if (!event || !Number.isSafeInteger(event.seq) || event.seq < 1 || typeof event.incident_id !== 'string' || typeof event.text !== 'string' || typeof event.actor !== 'string') {
          throw new Error('Invalid incident event');
        }
        if (backlog.has(event.seq)) return;
        backlog.set(event.seq, event);
        if (backlog.size > 1000) backlog.delete(backlog.keys().next().value!);
        if (hydrated) setEvents([...backlog.values()]);
      } catch {
        setError('An incident event could not be read. Waiting for the next update.');
      }
    });

    stream.addEventListener('state', (message) => {
      if (!active) return;
      try {
        const snapshot: IncidentState = JSON.parse((message as MessageEvent<string>).data);
        if (!snapshot || typeof snapshot.incident?.id !== 'string' || !snapshot.people || typeof snapshot.people !== 'object') {
          throw new Error('Invalid incident state');
        }
        setState(snapshot);
        setEvents([...backlog.values()].filter((event) => event.incident_id === snapshot.incident.id));
        setConnection('connected');
        setError(null);
        hydrated = true;
      } catch {
        setError('The incident snapshot could not be read. Waiting for the next update.');
      }
    });

    stream.onerror = () => {
      if (!active) return;
      setConnection('reconnecting');
      setError('Connection lost. Reconnecting to the incident service.');
    };

    return () => {
      active = false;
      stream.close();
    };
  }, []);

  return { state, events, connection, error };
}
