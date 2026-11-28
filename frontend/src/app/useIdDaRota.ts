import { useParams } from 'react-router'
import { lerIdPositivo } from '@/lib/identificador'

/** `:id` da rota como inteiro positivo seguro, ou `null` se inválido. */
export function useIdDaRota(): number | null {
  return lerIdPositivo(useParams().id)
}
