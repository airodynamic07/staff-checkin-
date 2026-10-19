import type { DatesSetArg, EventClickArg } from '@fullcalendar/core'
import enGbLocale from '@fullcalendar/core/locales/en-gb'
import thLocale from '@fullcalendar/core/locales/th'
import interactionPlugin from '@fullcalendar/interaction'
import luxonPlugin from '@fullcalendar/luxon3'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { VisitEditDialog } from '../../components/VisitEditDialog'
import { listProfiles, listVisits } from '../../lib/api'
import { toCalendarEvents } from '../../lib/calendar'
import { errorMessage } from '../../lib/errors'
import { addDays, bangkokDate, durationMinutes, formatDuration, TZ } from '../../lib/time'
import type { Profile, VisitFull } from '../../lib/types'

export default function Timetable() {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()
  const userId = params.get('staff') ?? ''
  const [people, setPeople] = useState<Profile[]>([])
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [visits, setVisits] = useState<VisitFull[]>([])
  const [fullDay, setFullDay] = useState(false)
  const [editing, setEditing] = useState<VisitFull | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listProfiles().then((p) => setPeople(p.filter((x) => x.active))).catch((e) => setError(errorMessage(t, e)))
  }, [t])

  const load = useCallback(() => {
    if (!userId || !range) {
      setVisits([])
      return
    }
    listVisits({ ...range, userId }).then(setVisits).catch((e) => setError(errorMessage(t, e)))
  }, [userId, range, t])
  useEffect(load, [load])

  function onDates(arg: DatesSetArg) {
    // arg.end is exclusive midnight; the calendar works in Bangkok time.
    const from = bangkokDate(arg.start)
    const to = addDays(bangkokDate(arg.end), -1)
    setRange((r) => (r && r.from === from && r.to === to ? r : { from, to }))
  }

  function onEventClick(arg: EventClickArg) {
    const v = visits.find((x) => x.id === arg.event.id)
    if (v) setEditing(v)
  }

  const total = visits.reduce((s, v) => s + durationMinutes(v), 0)

  return (
    <div className="stack">
      <h1>{t('nav.timetable')}</h1>
      <div className="row">
        <label style={{ minWidth: 220 }}>
          {t('manager.staff')}
          <select value={userId} onChange={(e) => setParams(e.target.value ? { staff: e.target.value } : {})}>
            <option value="">{t('manager.pickStaff')}</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </label>
        <label className="inline">
          <input type="checkbox" checked={fullDay} onChange={(e) => setFullDay(e.target.checked)} />
          {t('manager.fullDay')}
        </label>
        <span className="spacer" />
        {userId && <strong>{t('app.total')}: {formatDuration(total)}</strong>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin, luxonPlugin]}
        initialView="timeGridWeek"
        timeZone={TZ}
        locales={[thLocale, enGbLocale]}
        locale={i18n.language === 'th' ? 'th' : 'en-gb'}
        firstDay={1}
        allDaySlot={false}
        nowIndicator
        slotMinTime={fullDay ? '00:00' : '06:00'}
        slotMaxTime={fullDay ? '24:00' : '22:00'}
        height="auto"
        headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
        events={toCalendarEvents(visits)}
        datesSet={onDates}
        eventClick={onEventClick}
      />
      {editing && (
        <VisitEditDialog
          visit={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}
