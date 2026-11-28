import { z } from 'zod'

// Os esquemas precisam ser criados sem compilação dinâmica sob a CSP do gateway.
z.config({ jitless: true })
