// 'YYYY-MM-DD' pieces shared by the modules that keep dates as strings.
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const pad2 = (n: number) => String(n).padStart(2, '0')
