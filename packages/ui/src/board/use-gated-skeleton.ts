import { useEffect, useRef, useState } from 'react';
import { gateSkeleton, type SkeletonGate } from './gate-skeleton.js';

export function useGatedSkeleton(loading: boolean): boolean {
  const [visible, setVisible] = useState(false);
  const gateRef = useRef<SkeletonGate | undefined>(undefined);

  useEffect(() => {
    const gate = gateSkeleton(setVisible);
    gateRef.current = gate;
    return gate.dispose;
  }, []);

  useEffect(() => {
    gateRef.current?.setLoading(loading);
  }, [loading]);

  return visible;
}
