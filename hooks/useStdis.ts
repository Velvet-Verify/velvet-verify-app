// hooks/useStdis.ts
import { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/src/firebase/config';

export function useStdis() {
  const [stdis, setStdis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const db = getFirestore(firebaseApp);

  const loadStdis = async () => {
    setLoading(true);
    try {
      const stdisCol = collection(db, 'STDI');
      const snapshot = await getDocs(stdisCol);
      const stdisList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // console.log('Fetched STDIs:', stdisList); 
      setStdis(stdisList);
    } catch (error) {
      console.error('Error loading STDIs:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStdis();
  }, []);

  return { stdis, loading, refreshStdis: loadStdis };
}
