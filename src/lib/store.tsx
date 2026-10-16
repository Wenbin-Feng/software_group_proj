import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createSeed } from '../data/seed';
import { id, restoreState, type DemoState, type Material } from './domain';

export const STORAGE_KEY = 'luma.demo.v1';
function useDemoStore() {
  const [loaded] = useState(() => {
    try {
      return restoreState(localStorage.getItem(STORAGE_KEY));
    } catch {
      return { state: createSeed(), recovered: false };
    }
  });
  const [state, setState] = useState<DemoState>(loaded.state);
  const [recovery, setRecovery] = useState(loaded.recovered);
  const [storageError, setStorageError] = useState('');
  const [notice, setNotice] = useState('');
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const urlsRef = useRef<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const notify = useCallback((message: string) => {
    setNotice(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(''), 3800);
  }, []);
  useEffect(() => {
    // Preserve unreadable saved data until the user explicitly chooses recovery.
    if (recovery) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStorageError('');
    } catch {
      setStorageError(
        'Browser storage is unavailable or full. Changes will last for this session only.',
      );
    }
  }, [state, recovery]);
  useEffect(
    () => () => {
      Object.values(urlsRef.current).forEach(URL.revokeObjectURL);
      clearTimeout(timer.current);
    },
    [],
  );
  const user = state.users.find((u) => u.id === state.currentUserId);
  const switchUser = (userId: string | null) => setState((s) => ({ ...s, currentUserId: userId }));
  const reset = () => {
    Object.values(urlsRef.current).forEach(URL.revokeObjectURL);
    urlsRef.current = {};
    setFileUrls({});
    setState(createSeed());
    setRecovery(false);
    notify('Demo data restored. Choose an identity to begin.');
  };
  const registerFile = async (
    file: File,
    courseId: string,
    category: string,
    existingId?: string,
  ) => {
    if (file.size > 25 * 1024 * 1024) throw new Error('Choose a file smaller than 25 MB.');
    const materialId = existingId || id();
    const isText = /\.(md|txt)$/i.test(file.name);
    const body = isText ? await file.text() : '';
    // Binary content stays in this session; only metadata and plain text are persisted.
    if (urlsRef.current[materialId]) URL.revokeObjectURL(urlsRef.current[materialId]);
    const url = URL.createObjectURL(file);
    urlsRef.current = { ...urlsRef.current, [materialId]: url };
    setFileUrls({ ...urlsRef.current });
    const material: Material = {
      id: materialId,
      courseId,
      title: file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' '),
      filename: file.name,
      kind: isText ? 'Guide' : /\.pdf$/i.test(file.name) ? 'PDF' : 'File',
      size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      category,
      body,
      seeded: false,
      topic: 'upload',
      mime: file.type,
      uploadedAt: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date()),
    };
    setState((s) => ({
      ...s,
      materials: existingId
        ? s.materials.map((m) => (m.id === existingId ? { ...m, body, mime: material.mime } : m))
        : [...s.materials, material],
    }));
    return material;
  };
  const removeFile = (materialId: string) => {
    if (urlsRef.current[materialId]) {
      URL.revokeObjectURL(urlsRef.current[materialId]);
      delete urlsRef.current[materialId];
      setFileUrls({ ...urlsRef.current });
    }
    setState((s) => ({ ...s, materials: s.materials.filter((m) => m.id !== materialId) }));
  };
  return {
    state,
    setState,
    user,
    switchUser,
    reset,
    recovery,
    storageError,
    notice,
    notify,
    fileUrls,
    registerFile,
    removeFile,
  };
}
const AppContext = createContext<ReturnType<typeof useDemoStore> | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const value = useDemoStore();
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('AppProvider missing');
  return context;
}
