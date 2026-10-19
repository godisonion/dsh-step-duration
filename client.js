window.__ModuleLoader__.load({
  id: '@godisonion/dsh-step-duration',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const KIND = 'step-duration'
    const NS = 'step-duration'

    /** UI copy for the step timing row. */
    const zh = {
      'row.step': '第 {step} 步',
      'row.aria': '第 {step} 步，持续 {duration}',
      'duration.seconds': '{value} 秒',
      'duration.minutes': '{minutes} 分 {seconds} 秒',
    }

    const en = {
      'row.step': 'Step {step}',
      'row.aria': 'Step {step}, {duration}',
      'duration.seconds': '{value}s',
      'duration.minutes': '{minutes}m {seconds}s',
    }

    /** Inherit the host's work-details rhythm and typography. */
    const ROW_STYLE = {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      minWidth: 0,
      color: 'var(--dsw-alias-label-secondary)',
      fontSize: '12px',
      lineHeight: '18px',
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
    }
    const LABEL_STYLE = { flex: 'none' }
    const VALUE_STYLE = { flex: 'none', fontVariantNumeric: 'tabular-nums' }
    const ICON_STYLE = { flex: 'none', display: 'block' }

    /** Small original clock glyph; currentColor inherits the row color. */
    function ClockIcon() {
      return h('svg', {
        viewBox: '0 0 16 16',
        width: 12,
        height: 12,
        'aria-hidden': true,
        focusable: 'false',
        style: ICON_STYLE,
      },
        h('circle', {
          cx: 8,
          cy: 8,
          r: 6.25,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
        }),
        h('path', {
          d: 'M8 4.5v3.7l2.4 1.3',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    /**
     * Format one step duration for the current locale.
     * Under a minute keeps one decimal; longer durations use whole minutes.
     * @param {number} ms - elapsed milliseconds, already clamped to non-negative.
     * @param {(key: string, vars?: object) => string} t - locale translator.
     * @returns {string} localized duration text.
     */
    function formatDuration(ms, t) {
      const seconds = ms / 1000
      if (seconds < 60) {
        const rounded = Math.round(seconds * 10) / 10
        if (rounded < 60) return t('duration.seconds', { value: rounded.toFixed(1) })
        return t('duration.minutes', { minutes: 1, seconds: 0 })
      }
      const totalSeconds = Math.round(seconds)
      return t('duration.minutes', {
        minutes: Math.floor(totalSeconds / 60),
        seconds: totalSeconds % 60,
      })
    }

    /**
     * One step's timing marker. It stays live while the step and its Turn are
     * open, settles on step/end, and freezes at Turn end when no step/end exists.
     */
    const StepDurationRow = React.memo(function StepDurationRow({ node, t, useChat }) {
      const data = node.data
      const turn = data === undefined ? undefined : data.turn
      const turnStatus = useChat((snapshot) => {
        const location = turn === undefined ? undefined : snapshot.timeline.turns.get(turn)
        return location === undefined ? undefined : location.status
      })
      const turnEndTime = useChat((snapshot) => {
        const location = turn === undefined ? undefined : snapshot.timeline.turns.get(turn)
        return location === undefined ? undefined : location.end === undefined ? undefined : location.end.time
      })

      const [now, setNow] = React.useState(() => Date.now())
      const storedEnd = data === undefined ? null : data.endedAt
      const endedAt = Number.isFinite(storedEnd) ? storedEnd : null
      const live = endedAt === null && turnStatus !== 'closed'

      React.useEffect(() => {
        if (!live) return undefined
        const timer = setInterval(() => {
          setNow(Date.now())
        }, 1000)
        return () => clearInterval(timer)
      }, [live])

      if (data === undefined || !Number.isFinite(data.startedAt)) return null

      let endTime = endedAt
      if (endTime === null) {
        if (turnStatus === 'closed') {
          if (!Number.isFinite(turnEndTime)) return null
          endTime = turnEndTime
        } else {
          endTime = Math.max(now, data.startedAt)
        }
      }

      const durationMs = Math.max(0, endTime - data.startedAt)
      const duration = formatDuration(durationMs, t)
      const label = t('row.step', { step: data.step })

      return h('div', {
        style: ROW_STYLE,
        'data-step-duration': data.step,
        'data-state': live ? 'live' : 'final',
        'aria-label': t('row.aria', { step: data.step, duration }),
      },
        h(ClockIcon),
        h('span', { style: LABEL_STYLE }, label),
        h('span', { 'aria-hidden': true }, '·'),
        h('span', { style: VALUE_STYLE }, duration),
      )
    })

    /** One marker per model step, anchored immediately before that step's work rows. */
    const definition = {
      kind: KIND,
      target: 'chat',
      match(event) {
        if (event.type === 'step/start') {
          return { id: `${event.data.turn}:${event.data.step}`, role: 'start' }
        }
        if (event.type === 'step/end') {
          return { id: `${event.data.turn}:${event.data.step}`, role: 'update' }
        }
        return null
      },
      start(_context, match) {
        if (match.event.type !== 'step/start') {
          throw new Error('step-duration start requires step/start')
        }
        return {
          turn: match.event.data.turn,
          step: match.event.data.step,
          startedAt: match.event.time,
          endedAt: null,
        }
      },
      update(context, match) {
        if (match.event.type !== 'step/end') return context.state
        return {
          ...context.state,
          endedAt: match.event.time,
        }
      },
      buildViewNode(context) {
        const start = context.start
        const state = context.state
        if (start === undefined || state === undefined) return null
        if (start.location.kind !== 'step') return null
        if (!Number.isFinite(state.startedAt)) return null
        return {
          key: context.key,
          kind: KIND,
          id: context.id,
          target: 'chat',
          anchorSeq: start.event.seq + 0.02,
          location: start.location,
          visibility: 'visible',
          data: {
            turn: state.turn,
            step: state.step,
            startedAt: state.startedAt,
            endedAt: state.endedAt,
          },
        }
      },
    }

    /** Register the definition, dictionaries, and the keyed Chat renderer. */
    function apply(ctx) {
      ctx.effect(() => ctx.uiConversation.events.register(definition), 'step-duration: definition')
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'step-duration: dictionaries')
      ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
        name: 'conversation.chat.node',
        key: KIND,
        locale: NS,
      }, StepDurationRow))
    }

    return {
      inject: ['slots', 'locale', 'uiConversation'],
      apply,
    }
  },
})
