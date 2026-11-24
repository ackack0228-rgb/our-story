import { useState } from 'react'
import { useSession } from '../../hooks/useSession'
import { useAnswers } from '../../hooks/useAnswers'
import { computeDday, nextMilestone, todayLocalISODate } from '../../lib/date'
import { cardStatus, questionFor } from '../../lib/answers'
import { recapToAnnounce, type YearMonth } from '../../lib/recap'
import { PokeButton } from './PokeButton'
import { OnThisDay } from './OnThisDay'
import { UpcomingEvents } from './UpcomingEvents'
import { RecapNotice } from './RecapNotice'
import { BalanceGame } from './BalanceGame'
import { QuestionChat } from './QuestionChat'
import styles from './Home.module.css'

export function Home({ onOpenRecap }: { onOpenRecap?: (month: YearMonth) => void }) {
  const { me, settings: room } = useSession()
  const answers = useAnswers()
  const [chatOpen, setChatOpen] = useState(false)

  const diff = room.startDate ? computeDday(room.startDate) : null
  const milestone = diff !== null ? nextMilestone(diff) : null
  const today = todayLocalISODate()
  const partnerName = me === 'A' ? room.nameB : room.nameA
  const lastMonth = recapToAnnounce(today)

  return (
    <div>
      <div className={styles.stampCard}>
        <div className={styles.label}>TOGETHER SINCE</div>
        <div className={styles.ddayNum}>{diff !== null ? `D+${diff}` : 'D+?'}</div>
        <div className={styles.sub}>
          {room.startDate ? `${room.startDate} 부터` : '⚙ 눌러서 만난 날짜를 설정해주세요'}
        </div>
        {diff !== null && milestone !== null && (
          <div className={styles.milestone}>
            {diff === milestone
              ? `🎉 오늘이 D+${milestone}!`
              : `다음 기념일 D+${milestone} 까지 ${milestone - diff}일 남았어요`}
          </div>
        )}
      </div>

      <PokeButton />

      {lastMonth && onOpenRecap && <RecapNotice month={lastMonth} onOpen={() => onOpenRecap(lastMonth)} />}

      <UpcomingEvents />

      <OnThisDay />

      <div className={styles.sectionTitle}>💭 오늘의 질문</div>
      <button type="button" className={styles.questionCard} onClick={() => setChatOpen(true)}>
        <div className={styles.qText}>&quot;{questionFor(answers.items, today)}&quot;</div>
        <div className={styles.qStatus}>{cardStatus(answers.items, today, me, partnerName)}</div>
      </button>

      <div className={styles.sectionTitle}>⚖️ 오늘의 밸런스 게임</div>
      <BalanceGame />

      {chatOpen && (
        <QuestionChat answers={answers.items} error={answers.error} onSend={answers.send} onClose={() => setChatOpen(false)} />
      )}
    </div>
  )
}
