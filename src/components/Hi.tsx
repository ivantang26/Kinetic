import { useState } from 'preact/hooks';
export default function Hi() { const [n, s] = useState(0); return <button onClick={() => s(n + 1)}>{n}</button>; }
