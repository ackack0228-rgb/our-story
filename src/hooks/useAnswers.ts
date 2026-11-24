import { useCollection } from './useCollection'
import { useSession } from './useSession'
import { createItem } from '../lib/api'
import { todayLocalISODate } from '../lib/date'
import { ANSWER_MAX, isAnswer, questionFor } from '../lib/answers'

export function useAnswers() {
  const { me } = useSession()
  const { items, loading, error, refresh } = useCollection<unknown>('answers')
  const answers = items.filter(isAnswer)

  return {
    items: answers,
    loading,
    error,
    // Always files under today: a chat left open past midnight must not write into yesterday.
    send: async (text: string) => {
      const date = todayLocalISODate()
      await createItem('answers', {
        date,
        question: questionFor(answers, date),
        text: text.trim().slice(0, ANSWER_MAX),
        sender: me,
      })
      await refresh()
    },
  }
}
