import { useRef, useState } from 'react';
import { input } from '../player/input';

const R = 52;

/** 모바일 가상 조이스틱 (왼쪽 하단) */
export function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<[number, number]>([0, 0]);
  const active = useRef<number | null>(null);

  const update = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    setKnob([dx, dy]);
    input.joyX = dx / R;
    input.joyY = -dy / R;
  };
  const end = () => {
    active.current = null;
    setKnob([0, 0]);
    input.joyX = 0;
    input.joyY = 0;
  };

  return (
    <div
      ref={base}
      className="joystick"
      onPointerDown={(e) => {
        active.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => active.current === e.pointerId && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="joystick-knob" style={{ transform: `translate(${knob[0]}px, ${knob[1]}px)` }} />
    </div>
  );
}
