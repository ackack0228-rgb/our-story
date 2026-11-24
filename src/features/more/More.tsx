import { useState } from 'react'
import { SubTabs } from '../../components/SubTabs'
import { BucketList } from './BucketList'
import { MoodTracker } from './MoodTracker'
import { Archive } from './Archive'
import { TravelVote } from './TravelVote'
import { MonthlyRecap } from './MonthlyRecap'
import { StampGame } from './StampGame'
import type { ReviewDraft } from '../../lib/archive'
import type { YearMonth } from '../../lib/recap'

type SubTab = 'bucket' | 'mood' | 'archive' | 'vote' | 'recap' | 'game'

const SUBTABS: { key: SubTab; label: string }[] = [
  { key: 'bucket', label: '버킷리스트' },
  { key: 'mood', label: '감정온도계' },
  { key: 'archive', label: '후기' },
  { key: 'vote', label: '여행투표' },
  { key: 'recap', label: '돌아보기' },
  { key: 'game', label: '게임' },
]

// recapMonth: set when the home screen's "돌아보기가 나왔어요" card was pressed — opens on that month's recap.
export function More({ recapMonth = null }: { recapMonth?: YearMonth | null }) {
  const [tab, setTab] = useState<SubTab>(recapMonth ? 'recap' : 'bucket')
  // Set when a bucket list item was just finished: the 후기 form opens filled in for it.
  const [draft, setDraft] = useState<ReviewDraft | null>(null)

  function changeTab(next: SubTab) {
    setDraft(null)
    setTab(next)
  }

  function startReview(next: ReviewDraft) {
    setDraft(next)
    setTab('archive')
  }

  return (
    <div>
      <SubTabs tabs={SUBTABS} active={tab} onChange={changeTab} layout="grid" />
      {tab === 'bucket' && <BucketList onReview={startReview} />}
      {tab === 'mood' && <MoodTracker />}
      {tab === 'archive' && <Archive draft={draft} />}
      {tab === 'vote' && <TravelVote />}
      {tab === 'recap' && <MonthlyRecap startAt={recapMonth} />}
      {tab === 'game' && <StampGame />}
    </div>
  )
}
