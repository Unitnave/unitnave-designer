import { useCallback, useMemo, useRef, useState, useEffect } from 'react'

/**
 * useUndoRedo - historial simple para estados inmutables
 * API: saveState, undo, redo, canUndo, canRedo, stateInfo
 */
export function useUndoRedo(initialState = null, options = {}) {
  const { maxHistory = 50, onStateRestored } = options

  const [past, setPast] = useState([])
  const [present, setPresent] = useState(initialState)
  const [future, setFuture] = useState([])

  const pastRef = useRef(past)
  const presentRef = useRef(present)
  const futureRef = useRef(future)

  useEffect(() => { pastRef.current = past }, [past])
  useEffect(() => { presentRef.current = present }, [present])
  useEffect(() => { futureRef.current = future }, [future])

  const saveState = useCallback((nextState, label = '') => {
    const prev = presentRef.current

    setPast((p) => {
      const nextPast = prev == null ? p : [...p, { state: prev, label, ts: Date.now() }]
      return nextPast.length > maxHistory ? nextPast.slice(nextPast.length - maxHistory) : nextPast
    })

    setPresent(nextState)
    setFuture([])
  }, [maxHistory])

  const undo = useCallback(() => {
    const p = pastRef.current
    if (!p.length) return null

    const prevEntry = p[p.length - 1]
    const curr = presentRef.current

    setPast((x) => x.slice(0, -1))
    setFuture((f) => [{ state: curr, label: 'redo', ts: Date.now() }, ...f])
    setPresent(prevEntry.state)

    onStateRestored?.(prevEntry.state, 'undo')
    return prevEntry.state
  }, [onStateRestored])

  const redo = useCallback(() => {
    const f = futureRef.current
    if (!f.length) return null

    const nextEntry = f[0]
    const curr = presentRef.current

    setFuture((x) => x.slice(1))
    setPast((p) => {
      const nextPast = curr == null ? p : [...p, { state: curr, label: 'undo', ts: Date.now() }]
      return nextPast.length > maxHistory ? nextPast.slice(nextPast.length - maxHistory) : nextPast
    })
    setPresent(nextEntry.state)

    onStateRestored?.(nextEntry.state, 'redo')
    return nextEntry.state
  }, [maxHistory, onStateRestored])

  const canUndo = past.length > 0
  const canRedo = future.length > 0

  const stateInfo = useMemo(() => {
    const current = past.length + 1
    const total = past.length + 1 + future.length
    return { current, total }
  }, [past.length, future.length])

  return { saveState, undo, redo, canUndo, canRedo, stateInfo, present }
}
