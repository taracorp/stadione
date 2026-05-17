import { useEffect, useState } from 'react';
import {
  fetchTrainingAcademies,
  fetchTrainingCoaches,
  fetchTrainingPrograms,
  fetchTrainingEvents,
} from '../services/trainingEcosystemService.js';

function useAsyncList(loader) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const data = await loader();
        if (active) setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        if (active) setError(err?.message || 'Unknown error');
      } finally {
        if (active) setLoading(false);
      }
    }

    run();
    return () => {
      active = false;
    };
  }, [loader]);

  return { items, loading, error };
}

export function useTrainingAcademies() {
  const { items, loading, error } = useAsyncList(fetchTrainingAcademies);
  return { academies: items, loading, error };
}

export function useTrainingCoaches() {
  const { items, loading, error } = useAsyncList(fetchTrainingCoaches);
  return { coaches: items, loading, error };
}

export function useTrainingPrograms() {
  const { items, loading, error } = useAsyncList(fetchTrainingPrograms);
  return { programs: items, loading, error };
}

export function useTrainingEvents() {
  const { items, loading, error } = useAsyncList(fetchTrainingEvents);
  return { events: items, loading, error };
}
