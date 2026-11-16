import { create } from 'zustand';
import { HOLES } from '../world/golfCourse';

export const MAX_STROKES = 8;

interface GolfState {
  hole: number;
  strokes: number[];
  power: number;
  aiming: boolean;
  resting: boolean;
  message: string | null;
  finished: boolean;
  resetN: number;
  addStroke: () => void;
  setAim: (aiming: boolean, power: number) => void;
  setResting: (v: boolean) => void;
  flash: (msg: string | null) => void;
  nextHole: () => void;
  restart: () => void;
}

export const useGolf = create<GolfState>((set) => ({
  hole: 0,
  strokes: HOLES.map(() => 0),
  power: 0,
  aiming: false,
  resting: true,
  message: null,
  finished: false,
  resetN: 0,
  addStroke: () =>
    set((s) => {
      const strokes = [...s.strokes];
      strokes[s.hole] += 1;
      return { strokes };
    }),
  setAim: (aiming, power) => set({ aiming, power }),
  setResting: (resting) => set({ resting }),
  flash: (message) => set({ message }),
  nextHole: () =>
    set((s) => (s.hole + 1 >= HOLES.length ? { finished: true, message: null } : { hole: s.hole + 1, message: null, resetN: s.resetN + 1 })),
  restart: () => set((s) => ({ hole: 0, strokes: HOLES.map(() => 0), finished: false, message: null, power: 0, aiming: false, resetN: s.resetN + 1 })),
}));
